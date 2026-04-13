import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, Circle, Play, ChevronDown, ChevronUp,
  Clock, Flag, AlertTriangle, Calendar, Tag, FileText,
  ChevronRight, Sparkles, Layers, CheckSquare, Square,
  X, Plus, ArrowUpDown, GripVertical,
} from 'lucide-react';
import { Plan, Task, Phase, TaskStatus, Subtask } from '../lib/types';
import { differenceInDays, parseISO, format, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MiniConfetti } from './MiniConfetti';
import { haptic } from '../lib/sounds';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';

const DND_TYPE = 'PLAN_TASK';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const STATUS_ORDER   = { in_progress: 0, todo: 1, done: 2 } as const;
type SortMode = 'default' | 'priority' | 'deadline' | 'status';
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'default',  label: 'По умолчанию' },
  { value: 'priority', label: 'По приоритету' },
  { value: 'deadline', label: 'По дедлайну' },
  { value: 'status',   label: 'По статусу' },
];

function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  if (mode === 'default') return tasks;
  return [...tasks].sort((a, b) => {
    if (mode === 'priority') return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (mode === 'deadline') return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
    if (mode === 'status') return (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
    return 0;
  });
}

function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

const PRIORITY_CONFIG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Высокий',  dot: 'bg-red-500' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Средний',  dot: 'bg-amber-500' },
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Низкий',   dot: 'bg-emerald-500' },
};

const STATUS_CONFIG = {
  todo:        { Icon: Circle,       color: '#94a3b8', label: 'К выполнению', bg: 'bg-slate-100 dark:bg-white/8' },
  in_progress: { Icon: Play,         color: '#1d4ed8', label: 'В процессе',   bg: 'bg-[#1d4ed8]/10' },
  done:        { Icon: CheckCircle2, color: '#10b981', label: 'Выполнено',    bg: 'bg-emerald-500/10' },
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

interface Props {
  plan: Plan;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, done: boolean) => void;
  onAddTask?: (phaseId: string, title: string) => void;
  onTimerToggle?: (taskId: string) => void;
  onMoveTask?: (taskId: string, fromPhaseId: string, toPhaseId: string) => void;
}

function formatDate(dateStr: string) {
  try { return format(parseISO(dateStr), 'd MMM', { locale: ru }); }
  catch { return '—'; }
}

// ── Subtask row ───────────────────────────────────────────────────────────────
function SubtaskRow({
  subtask, phaseColor, onToggle,
}: { subtask: Subtask; phaseColor: string; onToggle?: (done: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle?.(!subtask.done)}
      className="flex items-start gap-2 w-full text-left group/sub py-1 hover:opacity-80 transition-opacity"
    >
      <div className="mt-0.5 shrink-0">
        {subtask.done
          ? <CheckSquare className="w-3.5 h-3.5" style={{ color: phaseColor }} />
          : <Square className="w-3.5 h-3.5 text-slate-300 dark:text-white/20 group-hover/sub:text-slate-400 dark:group-hover/sub:text-white/35 transition-colors" />
        }
      </div>
      <span className={`text-xs leading-relaxed transition-colors ${
        subtask.done
          ? 'line-through text-slate-300 dark:text-white/20'
          : 'text-slate-500 dark:text-white/50'
      }`}>
        {subtask.title}
      </span>
    </button>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task, phase, onTaskClick, onStatusChange, onSubtaskToggle, onTimerToggle, onMoveTask,
}: {
  task: Task;
  phase: Phase;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, done: boolean) => void;
  onTimerToggle?: (taskId: string) => void;
  onMoveTask?: (taskId: string, fromPhaseId: string, toPhaseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Live timer update
  useEffect(() => {
    if (!task.timer_start) { setElapsed(0); return; }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(task.timer_start!).getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [task.timer_start]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const today = startOfDay(new Date());
  const isOverdue = task.status !== 'done' && startOfDay(parseISO(task.end_date)) < today;
  const daysToDeadline = differenceInDays(startOfDay(parseISO(task.end_date)), today);
  const isDueSoon = !isOverdue && daysToDeadline <= 3 && task.status !== 'done';
  const isDone = task.status === 'done';
  const isInProgress = task.status === 'in_progress';
  const isTimerRunning = !!task.timer_start;

  const priorityConf = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const statusConf = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
  const StatusIcon = statusConf.Icon;

  const subtasks = task.subtasks ?? [];
  const subtasksDone = subtasks.filter(s => s.done).length;
  const hasDetails = (task.description && task.description.trim()) || subtasks.length > 0 || (task.tags ?? []).length > 0;

  const handleStatusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    const next = NEXT_STATUS[task.status];
    if (next === 'done') {
      setConfetti(true);
      haptic('success');
    } else {
      haptic('light');
    }
    onStatusChange(task.id, next);
  }, [task, onStatusChange]);

  // Card border color
  const borderColor = isOverdue
    ? 'border-red-200 dark:border-red-500/25'
    : isInProgress
    ? 'border-[#1d4ed8]/30 dark:border-[#1d4ed8]/35'
    : isDone
    ? 'border-slate-100 dark:border-white/5'
    : 'border-slate-200 dark:border-white/10';

  const cardBg = isOverdue
    ? 'bg-red-50/60 dark:bg-red-500/5'
    : isInProgress
    ? 'bg-[#1d4ed8]/4 dark:bg-[#1d4ed8]/8'
    : isDone
    ? 'bg-slate-50/50 dark:bg-white/[0.02]'
    : 'bg-white dark:bg-white/[0.03]';

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DND_TYPE,
    item: { taskId: task.id, fromPhaseId: phase.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const opacity = isDragging ? 0.5 : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${borderColor} ${cardBg} transition-all shadow-sm hover:shadow-md`}
      style={{ opacity: isDone ? 0.75 : opacity }}
      ref={dragRef}
    >
      {/* In-progress accent bar */}
      {isInProgress && (
        <div className="h-0.5 rounded-t-xl" style={{ background: `linear-gradient(to right, ${phase.color}, ${phase.color}60)` }} />
      )}

      <div className="p-3 sm:p-3.5">
        {/* Top row: status + title + priority */}
        <div className="flex items-start gap-2.5">
          {/* Status toggle */}
          <div className="relative shrink-0 mt-0.5">
            <button
              onClick={handleStatusClick}
              disabled={!onStatusChange}
              title={`${statusConf.label} · Нажми для переключения`}
              className="group/status relative"
            >
              <motion.div whileTap={{ scale: 0.7 }} whileHover={{ scale: 1.15 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                <StatusIcon className="w-4.5 h-4.5 transition-colors" style={{ color: statusConf.color, width: 18, height: 18 }} />
              </motion.div>
            </button>
            <MiniConfetti active={confetti} size="sm" onComplete={() => setConfetti(false)} />
          </div>

          {/* Title area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span
                className={`text-sm leading-snug ${
                  isDone
                    ? 'line-through text-slate-300 dark:text-white/20'
                    : isOverdue
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : 'text-slate-800 dark:text-white/85 font-medium'
                }`}
              >
                {task.title}
              </span>
              {/* In-progress badge */}
              {isInProgress && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/12 border border-[#1d4ed8]/25 text-[#1d4ed8] font-semibold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8] animate-pulse" />
                  В процессе
                </span>
              )}
              {/* Overdue badge */}
              {isOverdue && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 text-red-500 font-semibold shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Просрочено
                </span>
              )}
              {/* Due soon badge */}
              {isDueSoon && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  {daysToDeadline === 0 ? 'Сегодня' : daysToDeadline === 1 ? 'Завтра' : `${daysToDeadline} дн.`}
                </span>
              )}
              {/* Timer running badge */}
              {isTimerRunning && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {/* Priority */}
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priorityConf.color }} />
                <span className="text-[10px] text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>{priorityConf.label}</span>
              </div>
              {/* Duration */}
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/30">
                <Clock className="w-3 h-3" />
                <span style={{ fontWeight: 500 }}>{task.duration_hours}ч</span>
              </div>
              {/* Dates */}
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/30">
                <Calendar className="w-3 h-3" />
                <span style={{ fontWeight: 500 }}>{formatDate(task.start_date)} — {formatDate(task.end_date)}</span>
              </div>
              {/* Subtasks progress */}
              {subtasks.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: subtasksDone === subtasks.length ? '#10b981' : '#1d4ed8' }}>
                  <CheckSquare className="w-3 h-3" />
                  {subtasksDone}/{subtasks.length}
                </div>
              )}
            </div>
          </div>

          {/* Right: timer + expand + edit buttons */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Timer toggle — only for non-done tasks */}
            {onTimerToggle && !isDone && (
              <button
                onClick={(e) => { e.stopPropagation(); onTimerToggle(task.id); }}
                title={isTimerRunning ? 'Остановить таймер' : 'Запустить таймер'}
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                  isTimerRunning
                    ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : 'text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 hover:bg-slate-100 dark:hover:bg-white/8'
                }`}
              >
                {isTimerRunning
                  ? <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  : <Play className="w-3 h-3" />
                }
              </button>
            )}
            {hasDetails && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(p => !p); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => onTaskClick(task)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 dark:text-white/20 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/8 transition-all"
              title="Редактировать"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtask mini-progress bar */}
        {subtasks.length > 0 && (
          <div className="mt-2.5 h-1 bg-slate-100 dark:bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: phase.color }}
              animate={{ width: `${(subtasksDone / subtasks.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-3.5 pb-3.5 pt-0 space-y-3 border-t border-slate-100 dark:border-white/6 mt-0.5">

              {/* Description */}
              {task.description && task.description.trim() && (
                <div className="pt-3">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold text-slate-400 dark:text-white/30 uppercase tracking-wider">
                    <FileText className="w-3 h-3" />
                    Описание
                  </div>
                  <p className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Subtasks */}
              {subtasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-slate-400 dark:text-white/30 uppercase tracking-wider">
                    <CheckSquare className="w-3 h-3" />
                    Подзадачи · {subtasksDone}/{subtasks.length}
                  </div>
                  <div className="space-y-0.5 pl-1">
                    {subtasks.map(st => (
                      <SubtaskRow
                        key={st.id}
                        subtask={st}
                        phaseColor={phase.color}
                        onToggle={(done) => onSubtaskToggle?.(task.id, st.id, done)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {(task.tags ?? []).length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <Tag className="w-3 h-3 text-slate-300 dark:text-white/20 shrink-0" />
                  {(task.tags ?? []).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/40 font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Phase section ─────────────────────────────────────────────────────────────
function PhaseSection({
  phase, phaseIndex, onTaskClick, onStatusChange, onSubtaskToggle, onTimerToggle, onAddTask, onMoveTask,
}: {
  phase: Phase;
  phaseIndex: number;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, done: boolean) => void;
  onTimerToggle?: (taskId: string) => void;
  onAddTask?: (phaseId: string, title: string) => void;
  onMoveTask?: (taskId: string, fromPhaseId: string, toPhaseId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [showSort, setShowSort] = useState(false);

  const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
    accept: DND_TYPE,
    drop: (item: { taskId: string; fromPhaseId: string }) => {
      if (item.fromPhaseId !== phase.id) {
        onMoveTask?.(item.taskId, item.fromPhaseId, phase.id);
      }
    },
    canDrop: (item: { taskId: string; fromPhaseId: string }) => item.fromPhaseId !== phase.id,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  useEffect(() => {
    if (addingTask) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [addingTask]);

  const handleAddSubmit = () => {
    if (!newTitle.trim()) return;
    onAddTask?.(phase.id, newTitle.trim());
    setNewTitle('');
    setAddingTask(false);
  };

  const total = phase.tasks.length;
  const done = phase.tasks.filter(t => t.status === 'done').length;
  const inProgress = phase.tasks.filter(t => t.status === 'in_progress').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isComplete = pct === 100;

  const today = startOfDay(new Date());
  const hasOverdue = phase.tasks.some(t => t.status !== 'done' && startOfDay(parseISO(t.end_date)) < today);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: phaseIndex * 0.07 }}
      className="mb-4 last:mb-0"
    >
      {/* Phase header */}
      <div
        className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl mb-2 cursor-pointer select-none hover:brightness-[0.98] transition-all"
        style={{
          background: isComplete
            ? `linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))`
            : `linear-gradient(135deg, ${phase.color}12, ${phase.color}05)`,
          border: `1.5px solid ${isComplete ? 'rgba(16,185,129,0.2)' : phase.color + '22'}`,
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        {/* Phase color indicator */}
        <div className="flex-none relative">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: isComplete ? '#10b981' : phase.color, boxShadow: `0 2px 8px ${isComplete ? '#10b98140' : phase.color + '40'}` }}
          >
            {isComplete ? '✓' : phaseIndex + 1}
          </div>
        </div>

        {/* Phase name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800 dark:text-white/90 truncate">{phase.name}</span>
            {hasOverdue && !isComplete && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-semibold shrink-0">
                <AlertTriangle className="w-3 h-3" />Просроченные
              </span>
            )}
            {isComplete && (
              <span className="text-[10px] text-emerald-500 font-bold shrink-0">✓ Завершён</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {/* Progress bar */}
            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden max-w-[120px]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: isComplete ? '#10b981' : phase.color }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-white/35 font-medium whitespace-nowrap">
              {done}/{total}
              {inProgress > 0 && <span className="text-[#1d4ed8] ml-1">({inProgress} в работе)</span>}
            </span>
          </div>
        </div>

        {/* Right: dates + collapse */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sort button */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSort(s => !s); }}
              title="Сортировка"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                sortMode !== 'default'
                  ? 'text-[#1d4ed8] bg-[#1d4ed8]/10'
                  : 'text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/50 hover:bg-slate-100 dark:hover:bg-white/8'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            {showSort && (
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#0e1a35] border border-slate-200 dark:border-white/15 rounded-xl shadow-xl py-1 min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortMode(opt.value); setShowSort(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      sortMode === opt.value
                        ? 'text-[#1d4ed8] bg-[#1d4ed8]/8 font-semibold'
                        : 'text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/30 font-medium">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(phase.start_date)} — {formatDate(phase.end_date)}</span>
            <span className="ml-1 text-slate-300 dark:text-white/15">·</span>
            <span className="font-semibold">{phase.duration_days}д</span>
          </div>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/25" />
            : <ChevronUp className="w-4 h-4 text-slate-400 dark:text-white/25" />
          }
        </div>
      </div>

      {/* Task cards */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pl-3 sm:pl-4 space-y-2" ref={dropRef}>
              {/* Drop zone highlight */}
              {isOver && canDrop && (
                <div className="border-2 border-dashed border-[#1d4ed8]/40 bg-[#1d4ed8]/5 rounded-xl p-3 text-center text-[11px] text-[#1d4ed8] font-semibold">
                  Перенести задачу в «{phase.name}»
                </div>
              )}
              {phase.tasks.length === 0 ? (
                <div className="flex items-center gap-2 py-3 text-slate-400 dark:text-white/25 text-xs">
                  <Layers className="w-4 h-4" />
                  Задач нет
                </div>
              ) : (
                sortTasks(phase.tasks, sortMode).map((task, tIdx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: tIdx * 0.04 }}
                  >
                    <TaskCard
                      task={task}
                      phase={phase}
                      onTaskClick={onTaskClick}
                      onStatusChange={onStatusChange}
                      onSubtaskToggle={onSubtaskToggle}
                      onTimerToggle={onTimerToggle}
                      onMoveTask={onMoveTask}
                    />
                  </motion.div>
                ))
              )}

              {/* Quick add task */}
              {onAddTask && (
                <AnimatePresence mode="wait">
                  {addingTask ? (
                    <motion.div
                      key="add-form"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex gap-1.5 mt-1"
                    >
                      <input
                        ref={addInputRef}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddSubmit();
                          if (e.key === 'Escape') { setAddingTask(false); setNewTitle(''); }
                        }}
                        placeholder="Название задачи…"
                        className="flex-1 bg-white dark:bg-white/8 border border-[#1d4ed8]/35 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#1d4ed8]/60 placeholder-slate-400 dark:placeholder-white/25 shadow-sm"
                      />
                      <button
                        onClick={handleAddSubmit}
                        disabled={!newTitle.trim()}
                        className="px-3 py-2 rounded-xl bg-[#1d4ed8] text-white text-xs font-semibold hover:bg-[#1e40af] transition-colors shadow-sm disabled:opacity-40"
                      >
                        +
                      </button>
                      <button
                        onClick={() => { setAddingTask(false); setNewTitle(''); }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="add-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setAddingTask(true)}
                      className="mt-1 flex items-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs text-slate-400 dark:text-white/30 hover:text-[#1d4ed8] transition-colors border border-dashed border-slate-200 dark:border-white/10 hover:border-[#1d4ed8]/35 hover:bg-[#1d4ed8]/5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Добавить задачу
                    </motion.button>
                  )}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main PlanListView ─────────────────────────────────────────────────────────
export function PlanListView({ plan, onTaskClick, onStatusChange, onSubtaskToggle, onAddTask, onTimerToggle, onMoveTask }: Props) {
  const allTasks = plan.phases.flatMap(p => p.tasks);
  const done = allTasks.filter(t => t.status === 'done').length;
  const inProg = allTasks.filter(t => t.status === 'in_progress').length;
  const todo = allTasks.filter(t => t.status === 'todo').length;

  const backend = isTouchDevice() ? TouchBackend : HTML5Backend;

  return (
    <DndProvider backend={backend}>
    <div className="bg-white dark:bg-[#0d1a36] border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 shadow-sm">
      {/* Summary strip */}
      <div className="flex items-center gap-4 flex-wrap mb-4 pb-3.5 border-b border-slate-100 dark:border-white/6">
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{done} выполнено</span>
        </div>
        {inProg > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[#1d4ed8] font-semibold">
            <Play className="w-3.5 h-3.5" />
            <span>{inProg} в работе</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/35 font-medium">
          <Circle className="w-3.5 h-3.5" />
          <span>{todo} осталось</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-white/25">
          <Sparkles className="w-3 h-3" />
          <span>{plan.phases.length} этапов · {allTasks.length} задач</span>
        </div>
      </div>

      {/* Phases */}
      {plan.phases.map((phase, idx) => (
        <PhaseSection
          key={phase.id}
          phase={phase}
          phaseIndex={idx}
          onTaskClick={onTaskClick}
          onStatusChange={onStatusChange}
          onSubtaskToggle={onSubtaskToggle}
          onTimerToggle={onTimerToggle}
          onAddTask={onAddTask}
          onMoveTask={onMoveTask}
        />
      ))}
    </div>
    </DndProvider>
  );
}