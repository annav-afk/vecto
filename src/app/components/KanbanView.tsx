import { useState, useRef, useEffect } from 'react';
import { Plan, Task, TaskStatus } from '../lib/types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, Flag, ChevronRight, MoveHorizontal, RefreshCw,
  ArrowUpDown, Play, Square, Tag, AlertTriangle, Flame,
  ChevronLeft, GripVertical,
} from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { ConfettiBurst } from './ConfettiBurst';
import { haptic } from '../lib/sounds';
import { parseISO } from 'date-fns';
import { getRiskScore, getRiskLevel } from '../lib/risk';
import { BulkSelectHint } from './LongPressHint';

interface Props {
  plan: Plan;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskRename?: (taskId: string, title: string) => void;
  onTimerToggle?: (taskId: string) => void;
  selectedTasks?: Set<string>;
  onTaskSelect?: (taskId: string, selected: boolean) => void;
  allTasksForRisk?: Task[];
}

type SortKey = 'default' | 'priority' | 'deadline' | 'title';

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'default',  label: 'По умолчанию' },
  { id: 'priority', label: 'Приоритет' },
  { id: 'deadline', label: 'Дедлайн' },
  { id: 'title',    label: 'Название' },
];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const COLUMNS: { id: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
  { id: 'todo',        label: 'К выполнению', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  { id: 'in_progress', label: 'В процессе',   color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'done',        label: 'Выполнено',    color: '#10b981', bg: '#f0fdf7', border: '#a7f3d0' },
];

const PRIORITY_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const PRIORITY_LABELS: Record<string, string>  = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

const ITEM_TYPE = 'TASK_CARD';
interface DragItem { taskId: string; fromStatus: TaskStatus }

// Detect touch device for backend switching
const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function formatTracked(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

// ── Draggable card ──────────────────────────────────────────────────────────
function TaskCard({
  task, colId, onTaskClick, onStatusChange, onTaskRename, onTimerToggle, isSelected, onSelect, allTasks, showRisk,
}: {
  task: Task & { phaseName: string; phaseColor: string };
  colId: TaskStatus;
  onTaskClick: (t: Task) => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onTaskRename?: (id: string, title: string) => void;
  onTimerToggle?: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string, sel: boolean) => void;
  allTasks: Task[];
  showRisk: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing]     = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: ITEM_TYPE,
    item: { taskId: task.id, fromStatus: colId },
    collect: m => ({ isDragging: m.isDragging() }),
  });
  drag(ref);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onTaskRename) return;
    e.stopPropagation();
    setEditTitle(task.title);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const t = editTitle.trim();
    if (t && t !== task.title && onTaskRename) onTaskRename(task.id, t);
    else setEditTitle(task.title);
  };

  const isTimerRunning  = !!task.timer_start;
  const trackedSeconds  = task.tracked_seconds ?? 0;
  const prevStatus      = (s: TaskStatus): TaskStatus => s === 'done' ? 'in_progress' : 'todo';
  const nextStatus      = (s: TaskStatus): TaskStatus => s === 'todo' ? 'in_progress' : 'done';
  const isTouch         = isTouchDevice();

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0, scale: isDragging ? 1.03 : 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.14 }}
      className={`group relative bg-white dark:bg-white/8 border rounded-xl p-3.5 transition-all shadow-sm hover:shadow-md active:shadow-lg ${
        isSelected
          ? 'border-[#1d4ed8]/50 bg-[#1d4ed8]/5 dark:bg-[#1d4ed8]/10'
          : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/12 hover:border-slate-300 dark:hover:border-white/20'
      } ${isTouch ? '' : 'cursor-grab active:cursor-grabbing'}`}
      onClick={() => !editing && onTaskClick(task)}
    >
      {/* Bulk select checkbox */}
      <div
        className="absolute top-2.5 left-2.5 z-10"
        onClick={e => { e.stopPropagation(); onSelect(task.id, !isSelected); }}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
          isSelected
            ? 'bg-[#1d4ed8] border-[#1d4ed8]'
            : 'border-slate-300 dark:border-white/20 opacity-0 group-hover:opacity-100 bg-white dark:bg-white/10'
        }`}>
          {isSelected && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Phase + recurring */}
      <div className="flex items-center gap-1.5 mb-2 pl-5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: task.phaseColor }} />
        <span className="text-xs text-slate-400 dark:text-white/40 truncate flex-1">{task.phaseName}</span>
        {task.recurring && task.streak && task.streak > 1 && (
          <span className="flex items-center gap-0.5 text-xs text-orange-500" title={`Стрик: ${task.streak} дней`}>
            <Flame className="w-3 h-3" />{task.streak}
          </span>
        )}
        {task.recurring && <RefreshCw className="w-3 h-3 text-[#2563eb] shrink-0" title="Повторяющаяся задача" />}
        {!isTouch && (
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-white/15 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab" />
        )}
      </div>

      {/* Risk indicator */}
      {showRisk && task.status !== 'done' && (() => {
        const risk    = getRiskScore(task, allTasks);
        const riskCfg = getRiskLevel(risk.level);
        if (risk.level === 'low') return null;
        return (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg" style={{ background: riskCfg.bg, border: `1px solid ${riskCfg.border}` }}>
            <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: riskCfg.color }} />
            <span className="text-xs" style={{ color: riskCfg.color, fontWeight: 500 }}>{riskCfg.label}</span>
            {risk.reasons[0] && <span className="text-xs ml-auto" style={{ color: riskCfg.color, opacity: 0.7 }}>{risk.reasons[0]}</span>}
          </div>
        );
      })()}

      {/* Title */}
      {editing ? (
        <input
          ref={inputRef}
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.stopPropagation(); commitEdit(); }
            if (e.key === 'Escape') { setEditing(false); setEditTitle(task.title); }
          }}
          onClick={e => e.stopPropagation()}
          className="w-full bg-white dark:bg-white/15 border border-[#1d4ed8]/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 mb-2"
        />
      ) : (
        <p
          className="text-sm text-slate-900 dark:text-white mb-2 leading-snug"
          style={{ fontWeight: 500 }}
          onDoubleClick={handleDoubleClick}
        >
          {task.title}
        </p>
      )}

      {/* Description */}
      {task.description && !editing && (
        <p className="text-xs text-slate-400 dark:text-white/35 mb-2 leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/8 text-[#1d4ed8] border border-[#1d4ed8]/15">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Subtask progress */}
      {task.subtasks && task.subtasks.length > 0 && (() => {
        const done  = task.subtasks.filter(s => s.done).length;
        const total = task.subtasks.length;
        const pct   = Math.round((done / total) * 100);
        return (
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 dark:text-white/35">Подзадачи</span>
              <span className="text-slate-500 dark:text-white/50" style={{ fontWeight: 500 }}>{done}/{total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#1d4ed8' }} />
            </div>
          </div>
        );
      })()}

      {/* Tracked time */}
      {trackedSeconds > 0 && (
        <div className="flex items-center gap-1 text-xs text-[#10b981] mb-2">
          <Clock className="w-3 h-3" />
          {formatTracked(trackedSeconds)} отслежено
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-white/40 shrink-0">
            <Clock className="w-3 h-3" />{task.duration_hours}ч
          </span>
          <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: PRIORITY_COLORS[task.priority] }}>
            <Flag className="w-3 h-3" />{PRIORITY_LABELS[task.priority]}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Timer button */}
          {onTimerToggle && (
            <button
              onClick={e => { e.stopPropagation(); onTimerToggle(task.id); }}
              title={isTimerRunning ? 'Остановить таймер' : 'Запустить таймер'}
              className={`p-1.5 rounded-md transition-all ${
                isTimerRunning
                  ? 'text-[#10b981] bg-[#10b981]/10'
                  : 'text-slate-400 dark:text-white/30 hover:text-[#10b981] hover:bg-[#10b981]/8'
              } ${isTouch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              {isTimerRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          )}

          {/* ── Move buttons — ALWAYS visible on touch, hover on desktop ── */}
          {colId !== 'todo' && (
            <button
              onClick={e => { e.stopPropagation(); onStatusChange(task.id, prevStatus(colId)); }}
              title="Назад"
              className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs text-slate-400 dark:text-white/30 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/8 transition-colors border border-transparent hover:border-[#1d4ed8]/20 ${
                isTouch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          {colId !== 'done' && (
            <button
              onClick={e => { e.stopPropagation(); onStatusChange(task.id, nextStatus(colId)); }}
              title={colId === 'todo' ? 'Начать' : 'Готово'}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors border ${
                colId === 'todo'
                  ? 'text-[#1d4ed8] border-[#1d4ed8]/25 bg-[#1d4ed8]/5 hover:bg-[#1d4ed8]/15'
                  : 'text-[#10b981] border-[#10b981]/25 bg-[#10b981]/5 hover:bg-[#10b981]/15'
              } ${isTouch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              {colId === 'todo' ? 'Начать' : 'Готово'}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {colId === 'done' && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#10b981]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Выполнено
        </div>
      )}

      {/* Active timer pulse dot */}
      {isTimerRunning && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#10b981] animate-pulse" title="Таймер запущен" />
      )}
    </motion.div>
  );
}

// ── Droppable column ─────────────────────────────────────────────────────────
function KanbanColumn({
  col, tasks, allTasksAll, onTaskClick, onStatusChange, onDoneConfetti, onTaskRename, onTimerToggle, selectedTasks, onTaskSelect,
}: {
  col: typeof COLUMNS[number];
  tasks: (Task & { phaseName: string; phaseColor: string })[];
  allTasksAll: Task[];
  onTaskClick: (t: Task) => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDoneConfetti: () => void;
  onTaskRename?: (id: string, title: string) => void;
  onTimerToggle?: (id: string) => void;
  selectedTasks: Set<string>;
  onTaskSelect: (id: string, sel: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<DragItem, unknown, { isOver: boolean }>({
    accept: ITEM_TYPE,
    drop: item => {
      if (item.fromStatus !== col.id) {
        onStatusChange(item.taskId, col.id);
        if (col.id === 'done') onDoneConfetti();
      }
    },
    collect: m => ({ isOver: m.isOver() }),
  });
  drop(ref);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
        <span className="text-sm text-slate-700 dark:text-white/80" style={{ fontWeight: 600 }}>{col.label}</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: `${col.color}18`, color: col.color }}>
          {tasks.length}
        </span>
      </div>

      <div
        ref={ref}
        className="flex-1 rounded-2xl p-3 space-y-2.5 min-h-48 border transition-all duration-150"
        style={{
          background:   isOver ? `${col.color}10` : col.bg,
          borderColor:  isOver ? col.color        : col.border,
          boxShadow:    isOver ? `inset 0 0 0 2px ${col.color}30` : undefined,
        }}
      >
        <AnimatePresence>
          {tasks.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-32 flex flex-col items-center justify-center gap-2"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${col.color}12` }}>
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                  {col.id === 'todo'        && <path d="M4 10h12M10 4l6 6-6 6" stroke={col.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                  {col.id === 'in_progress' && <circle cx="10" cy="10" r="6" stroke={col.color} strokeWidth="1.5" strokeDasharray="4 2" />}
                  {col.id === 'done'        && <path d="M4 10l4 4 8-8" stroke={col.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                </svg>
              </div>
              <p className="text-xs text-slate-400 dark:text-white/30 text-center px-4 leading-relaxed">
                {col.id === 'todo'        && 'Все задачи в работе или выполнены'}
                {col.id === 'in_progress' && 'Нажмите «Начать» на карточке'}
                {col.id === 'done'        && 'Выполненные задачи появятся здесь'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            colId={col.id}
            onTaskClick={onTaskClick}
            onStatusChange={(id, s) => { onStatusChange(id, s); if (s === 'done') { onDoneConfetti(); haptic('success'); } else { haptic('light'); } }}
            onTaskRename={onTaskRename}
            onTimerToggle={onTimerToggle}
            isSelected={selectedTasks.has(task.id)}
            onSelect={onTaskSelect}
            allTasks={allTasksAll}
            showRisk={true}
          />
        ))}

        {isOver && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="h-12 rounded-xl border-2 border-dashed"
            style={{ borderColor: col.color, background: `${col.color}06` }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export function KanbanView({
  plan, onTaskClick, onStatusChange, onTaskRename, onTimerToggle,
  selectedTasks = new Set(), onTaskSelect = () => {}, allTasksForRisk,
}: Props) {
  const [sortKey, setSortKey]         = useState<SortKey>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [confetti, setConfetti]       = useState(false);

  // Use TouchBackend on touch devices, HTML5Backend on desktop
  const backend = isTouchDevice() ? TouchBackend : HTML5Backend;
  const backendOptions = isTouchDevice()
    ? { enableMouseEvents: true, delayTouchStart: 120 }
    : {};

  const allTasks   = plan.phases.flatMap(phase =>
    phase.tasks.map(task => ({ ...task, phaseName: phase.name, phaseColor: phase.color })),
  );
  const riskTasks: Task[] = allTasksForRisk ?? allTasks;

  const sortTasks = (tasks: typeof allTasks) => {
    if (sortKey === 'priority') return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    if (sortKey === 'deadline') return [...tasks].sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime());
    if (sortKey === 'title')    return [...tasks].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return tasks;
  };

  const getByStatus = (s: TaskStatus) => sortTasks(allTasks.filter(t => t.status === s));

  return (
    <>
      <ConfettiBurst active={confetti} onComplete={() => setConfetti(false)} />

      <DndProvider backend={backend} options={backendOptions}>
        {/* Sort + tip */}
        <div className="flex items-center justify-between mb-4">
          {selectedTasks.size > 0 ? (
            <span className="text-xs text-[#1d4ed8]" style={{ fontWeight: 500 }}>
              Выбрано: {selectedTasks.size} задач
            </span>
          ) : (
            <div className="relative">
              <span className="text-xs text-slate-400 dark:text-white/30">
                {isTouchDevice()
                  ? 'Нажмите «Начать» или перетащите карточку'
                  : 'Перетащите карточку или используйте кнопки'}
              </span>
              <BulkSelectHint />
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowSortMenu(m => !m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                sortKey !== 'default'
                  ? 'bg-[#1d4ed8]/10 border-[#1d4ed8]/30 text-[#1d4ed8]'
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {SORT_OPTIONS.find(s => s.id === sortKey)?.label}
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full right-0 mt-1.5 w-40 bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-20 overflow-hidden"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortKey(opt.id); setShowSortMenu(false); }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors ${
                          sortKey === opt.id ? 'bg-[#1d4ed8]/10 text-[#1d4ed8]' : 'text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/8'
                        }`}
                        style={{ fontWeight: sortKey === opt.id ? 600 : 400 }}
                      >
                        {sortKey === opt.id && '✓ '}{opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Columns — single column on mobile (swipeable tabs) */}
        <MobileKanban
          columns={COLUMNS}
          getByStatus={getByStatus}
          allTasksAll={riskTasks}
          onTaskClick={onTaskClick}
          onStatusChange={onStatusChange}
          onDoneConfetti={() => setConfetti(true)}
          onTaskRename={onTaskRename}
          onTimerToggle={onTimerToggle}
          selectedTasks={selectedTasks}
          onTaskSelect={onTaskSelect}
        />
      </DndProvider>
    </>
  );
}

// ── Mobile: tab-style column switcher ────────────────────────────────────────
function MobileKanban({
  columns, getByStatus, allTasksAll, onTaskClick, onStatusChange, onDoneConfetti,
  onTaskRename, onTimerToggle, selectedTasks, onTaskSelect,
}: {
  columns: typeof COLUMNS;
  getByStatus: (s: TaskStatus) => (Task & { phaseName: string; phaseColor: string })[];
  allTasksAll: Task[];
  onTaskClick: (t: Task) => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDoneConfetti: () => void;
  onTaskRename?: (id: string, title: string) => void;
  onTimerToggle?: (id: string) => void;
  selectedTasks: Set<string>;
  onTaskSelect: (id: string, sel: boolean) => void;
}) {
  const [activeCol, setActiveCol] = useState<TaskStatus>('todo');

  return (
    <>
      {/* Mobile: column tabs */}
      <div className="md:hidden flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 mb-4">
        {columns.map(col => {
          const count = getByStatus(col.id).length;
          return (
            <button
              key={col.id}
              onClick={() => setActiveCol(col.id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                activeCol === col.id
                  ? 'text-white'
                  : 'text-slate-500 dark:text-white/40 bg-white dark:bg-white/3 hover:bg-slate-50 dark:hover:bg-white/6'
              }`}
              style={activeCol === col.id ? { background: col.color } : {}}
            >
              {col.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeCol === col.id ? 'bg-white/20 text-white' : ''
              }`} style={activeCol !== col.id ? { color: col.color } : {}}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile: single active column */}
      <div className="md:hidden">
        {columns.filter(c => c.id === activeCol).map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={getByStatus(col.id)}
            allTasksAll={allTasksAll}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            onDoneConfetti={onDoneConfetti}
            onTaskRename={onTaskRename}
            onTimerToggle={onTimerToggle}
            selectedTasks={selectedTasks}
            onTaskSelect={onTaskSelect}
          />
        ))}
      </div>

      {/* Desktop: all 3 columns */}
      <div className="hidden md:grid grid-cols-3 gap-5">
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={getByStatus(col.id)}
            allTasksAll={allTasksAll}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            onDoneConfetti={onDoneConfetti}
            onTaskRename={onTaskRename}
            onTimerToggle={onTimerToggle}
            selectedTasks={selectedTasks}
            onTaskSelect={onTaskSelect}
          />
        ))}
      </div>
    </>
  );
}