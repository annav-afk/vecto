import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Plan, Task, Phase, TaskStatus } from '../lib/types';
import { differenceInDays, parseISO, format, startOfDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'motion/react';
import {
  Clock, Flag, AlertTriangle, CheckCircle2, Circle, Play,
  Calendar, ChevronRight,
} from 'lucide-react';
import { MiniConfetti } from './MiniConfetti';
import { haptic } from '../lib/sounds';
import { StatusPickerMenu, useLongPress } from './StatusPickerMenu';
import { LongPressHint } from './LongPressHint';

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

interface Props {
  plan: Plan;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#10b981',
};
const PRIORITY_LABELS: Record<string, string> = {
  high:   'Высокий',
  medium: 'Средний',
  low:    'Низкий',
};
const STATUS_ICONS = {
  done:        { Icon: CheckCircle2, color: '#10b981', label: 'Готово' },
  in_progress: { Icon: Play,         color: '#1d4ed8', label: 'В работе' },
  todo:        { Icon: Circle,       color: '#94a3b8', label: 'К выполнению' },
} as const;

function formatDateShort(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMM', { locale: ru });
  } catch { return '—'; }
}

/* ── Phase progress mini-bar ─────────────────────────────────────────────── */
function PhaseProgress({ phase }: { phase: Phase }) {
  const total = phase.tasks.length;
  if (!total) return null;
  const done = phase.tasks.filter(t => t.status === 'done').length;
  const inProg = phase.tasks.filter(t => t.status === 'in_progress').length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 sm:w-20 h-1.5 rounded-full bg-slate-100 dark:bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#1d4ed8' }} />
      </div>
      <span className="text-[10px] text-slate-400 dark:text-white/30 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
        {done}/{total}
        {inProg > 0 && <span className="text-[#1d4ed8] ml-0.5">({inProg} в работе)</span>}
      </span>
    </div>
  );
}

/* ── Task Status Button with long-press ──────────────────────────────────── */
function TaskStatusBtn({ task, onStatusChange, confettiTaskId, setConfettiTaskId, setPickerTaskId, pickerTaskId }: {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  confettiTaskId: string | null;
  setConfettiTaskId: (id: string | null) => void;
  setPickerTaskId: (id: string | null) => void;
  pickerTaskId: string | null;
}) {
  const statusInfo = STATUS_ICONS[task.status] ?? STATUS_ICONS.todo;
  const showConfetti = confettiTaskId === task.id;
  const showPicker = pickerTaskId === task.id;

  const longPress = useLongPress(
    useCallback(() => {
      if (onStatusChange) setPickerTaskId(task.id);
    }, [task.id, onStatusChange, setPickerTaskId]),
    400,
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPress.wasLongPress()) return; // long-press already handled
    if (!onStatusChange) return;
    const next = NEXT_STATUS[task.status];
    if (next === 'done') {
      setConfettiTaskId(task.id);
      haptic('success');
    } else {
      haptic('light');
    }
    onStatusChange(task.id, next);
  }, [task, onStatusChange, longPress, setConfettiTaskId]);

  const handlePickerSelect = useCallback((status: TaskStatus) => {
    if (!onStatusChange) return;
    if (status === 'done' && task.status !== 'done') {
      setConfettiTaskId(task.id);
    }
    onStatusChange(task.id, status);
  }, [task, onStatusChange, setConfettiTaskId]);

  return (
    <button
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); if (onStatusChange) setPickerTaskId(task.id); }}
      {...(onStatusChange ? {
        onTouchStart: longPress.onTouchStart,
        onTouchEnd: longPress.onTouchEnd,
        onTouchMove: longPress.onTouchMove,
      } : {})}
      className="relative shrink-0 group/status"
      title={`${statusInfo.label} · Клик — переключить · Удержание — выбрать статус`}
      disabled={!onStatusChange}
    >
      <motion.div
        whileTap={{ scale: 0.75 }}
        whileHover={{ scale: 1.2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      >
        <statusInfo.Icon
          className="w-3.5 h-3.5 transition-colors"
          style={{ color: statusInfo.color }}
        />
      </motion.div>
      {onStatusChange && (
        <div className="absolute -inset-1 rounded-full border border-transparent group-hover/status:border-slate-300 dark:group-hover/status:border-white/20 transition-colors" />
      )}
      <MiniConfetti active={showConfetti} size="sm" onComplete={() => setConfettiTaskId(null)} />
      <StatusPickerMenu
        visible={showPicker}
        currentStatus={task.status}
        onSelect={handlePickerSelect}
        onClose={() => setPickerTaskId(null)}
      />
    </button>
  );
}

/* ── Main TimelineView ───────────────────────────────────────────────────── */
export function TimelineView({ plan, onTaskClick, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrowCoords, setArrowCoords] = useState<
    { key: string; x1: number; y1: number; x2: number; y2: number }[]
  >([]);
  const [confettiTaskId, setConfettiTaskId] = useState<string | null>(null);
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const LABEL_W = isMobile ? 120 : 200;

  const today     = startOfDay(new Date());
  const startDate = startOfDay(parseISO(plan.phases[0]?.start_date || plan.created_at));
  const endDate   = startOfDay(parseISO(plan.deadline));
  const totalDays = Math.max(differenceInDays(endDate, startDate), 1);

  function leftPct(dateStr: string) {
    return Math.max(0, Math.min(100,
      (differenceInDays(startOfDay(parseISO(dateStr)), startDate) / totalDays) * 100,
    ));
  }
  function widthPct(s: string, e: string) {
    const days = differenceInDays(startOfDay(parseISO(e)), startOfDay(parseISO(s)));
    return Math.max(1.5, Math.min(100 - leftPct(s), (days / totalDays) * 100));
  }

  const todayPct  = (differenceInDays(today, startDate) / totalDays) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  /* ── Time scale markers ─────────────────────────────────────────────── */
  const timeMarkers = useMemo(() => {
    const markers: { label: string; pct: number; isWeek?: boolean }[] = [];

    if (totalDays <= 21) {
      // Week markers for short plans
      const cur = new Date(startDate);
      cur.setDate(cur.getDate() + 7 - cur.getDay());
      while (cur <= endDate) {
        const p = (differenceInDays(cur, startDate) / totalDays) * 100;
        if (p > 2 && p < 98) markers.push({
          label: format(cur, 'd MMM', { locale: ru }),
          pct: p,
          isWeek: true,
        });
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      // Month markers for longer plans
      let cur = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
      while (cur <= endDate) {
        const p = (differenceInDays(cur, startDate) / totalDays) * 100;
        if (p > 2 && p < 98) markers.push({
          label: format(cur, 'LLL yyyy', { locale: ru }),
          pct: p,
        });
        cur = addDays(cur, 32);
        cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
      }
    }
    return markers;
  }, [startDate, endDate, totalDays]);

  /* ── Dependency arrows ──────────────────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const arrows: typeof arrowCoords = [];
    const allTasks = plan.phases.flatMap(p => p.tasks);
    for (const task of allTasks) {
      if (!task.depends_on?.length) continue;
      const toEl = container.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement | null;
      if (!toEl) continue;
      for (const depId of task.depends_on) {
        const fromEl = container.querySelector(`[data-task-id="${depId}"]`) as HTMLElement | null;
        if (!fromEl) continue;
        const cRect = container.getBoundingClientRect();
        const fRect = fromEl.getBoundingClientRect();
        const tRect = toEl.getBoundingClientRect();
        arrows.push({
          key: `${depId}-${task.id}`,
          x1: fRect.right - cRect.left,
          y1: fRect.top + fRect.height / 2 - cRect.top,
          x2: tRect.left - cRect.left,
          y2: tRect.top + tRect.height / 2 - cRect.top,
        });
      }
    }
    setArrowCoords(arrows);
  }, [plan]);

  return (
    <div ref={containerRef} className="relative bg-white dark:bg-[#0d1a36] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden p-3 sm:p-5"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>

      {/* ── Time axis ──────────────────────────────────────────────── */}
      <div className="flex items-center mb-4 mt-1 pl-3" style={{ paddingLeft: LABEL_W }}>
        <div className="relative w-full h-5 border-b border-slate-100 dark:border-white/8">
          {/* Start date */}
          <span className="absolute left-0 bottom-0 text-[9px] text-slate-400 dark:text-white/25 translate-y-4 tabular-nums" style={{ fontWeight: 500 }}>
            {format(startDate, 'd MMM', { locale: ru })}
          </span>
          {/* End date */}
          <span className="absolute right-0 bottom-0 text-[9px] text-slate-400 dark:text-white/25 translate-y-4 tabular-nums" style={{ fontWeight: 500 }}>
            {format(endDate, 'd MMM', { locale: ru })}
          </span>
          {/* Markers */}
          {timeMarkers.map(m => (
            <div key={m.pct} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${m.pct}%` }}>
              <div className={`w-px h-full ${m.isWeek ? 'bg-slate-100 dark:bg-white/5' : 'bg-slate-200 dark:bg-white/8'}`} />
              <span className="text-[8px] text-slate-400 dark:text-white/25 whitespace-nowrap mt-1" style={{ fontWeight: 500 }}>
                {m.label}
              </span>
            </div>
          ))}
          {/* Today marker */}
          {showToday && (
            <div className="absolute top-0 bottom-0 flex flex-col items-center z-10"
              style={{ left: `${todayPct}%` }}>
              <div className="w-0.5 h-full bg-[#1d4ed8] rounded-full" style={{ opacity: 0.6 }} />
              <span className="text-[8px] text-[#1d4ed8] whitespace-nowrap mt-1" style={{ fontWeight: 700 }}>
                Сегодня
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── SVG arrows ─────────────────────────────────────────────── */}
      {arrowCoords.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none z-[5]"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <marker id="tl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1d4ed8" fillOpacity={0.5} />
            </marker>
          </defs>
          {arrowCoords.map(a => {
            const midX = (a.x1 + a.x2) / 2;
            return (
              <path
                key={a.key}
                d={`M ${a.x1},${a.y1} C ${midX},${a.y1} ${midX},${a.y2} ${a.x2},${a.y2}`}
                stroke="#1d4ed8"
                strokeOpacity={0.3}
                strokeWidth={1.5}
                fill="none"
                markerEnd="url(#tl-arrow)"
              />
            );
          })}
        </svg>
      )}

      {/* ── Phase blocks ────────────────────────────────────────────── */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* One-time long-press hint — anchored to first task area */}
        {onStatusChange && (
          <div className="relative" style={{ height: 0 }}>
            <div className="absolute left-3" style={{ top: 0, zIndex: 51 }}>
              <LongPressHint />
            </div>
          </div>
        )}
        {plan.phases.map((phase, pIdx) => {
          const doneCount = phase.tasks.filter(t => t.status === 'done').length;
          const totalCount = phase.tasks.length;
          const phasePct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
          const phaseOverdue = phase.tasks.some(
            t => t.status !== 'done' && startOfDay(parseISO(t.end_date)) < today,
          );

          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pIdx * 0.06 }}
              className="mb-3 last:mb-0"
            >
              {/* Phase header */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-0.5"
                style={{
                  background: `linear-gradient(135deg, ${phase.color}08, transparent)`,
                  border: `1px solid ${phase.color}15`,
                }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: phase.color, boxShadow: `0 0 6px ${phase.color}40` }} />
                <span className="text-xs sm:text-sm text-slate-700 dark:text-white/80 truncate" style={{ fontWeight: 700 }}>
                  {phase.name}
                </span>
                <PhaseProgress phase={phase} />
                {phaseOverdue && (
                  <span className="flex items-center gap-0.5 text-[10px] text-red-500 ml-auto whitespace-nowrap" style={{ fontWeight: 600 }}>
                    <AlertTriangle className="w-3 h-3" />Просрочено
                  </span>
                )}
                {phasePct === 100 && (
                  <span className="text-[10px] text-emerald-500 ml-auto" style={{ fontWeight: 600 }}>✓ Завершена</span>
                )}
                {/* Phase bar (bg) */}
                <div className="hidden sm:flex items-center gap-1.5 ml-auto text-[10px] text-slate-400 dark:text-white/25 whitespace-nowrap" style={{ fontWeight: 500 }}>
                  <Calendar className="w-3 h-3" />
                  {formatDateShort(phase.start_date)} — {formatDateShort(phase.end_date)} ·{' '}
                  <span style={{ fontWeight: 600 }}>
                    {phase.duration_days}д
                  </span>
                </div>
              </div>

              {/* Task rows */}
              <div className="mt-0.5">
                {phase.tasks.map((task, tIdx) => {
                  const isOverdue = startOfDay(parseISO(task.end_date)) < today && task.status !== 'done';
                  const isDueSoon = !isOverdue &&
                    differenceInDays(startOfDay(parseISO(task.end_date)), today) <= 3 &&
                    task.status !== 'done';
                  const isDone = task.status === 'done';
                  const isInProgress = task.status === 'in_progress';

                  const statusInfo = STATUS_ICONS[task.status] ?? STATUS_ICONS.todo;

                  // Bar styling
                  const barGradient = isDone
                    ? `linear-gradient(135deg, ${phase.color}15, ${phase.color}08)`
                    : isOverdue
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))'
                    : isInProgress
                    ? `linear-gradient(135deg, ${phase.color}20, ${phase.color}10)`
                    : `linear-gradient(135deg, ${phase.color}12, ${phase.color}05)`;

                  const barBorder = isOverdue
                    ? '1.5px solid rgba(239,68,68,0.4)'
                    : isDueSoon
                    ? '1.5px solid rgba(245,158,11,0.4)'
                    : isInProgress
                    ? `1.5px solid ${phase.color}50`
                    : isDone
                    ? `1px solid ${phase.color}20`
                    : `1px solid ${phase.color}25`;

                  // Left label color
                  const labelCls = isDone
                    ? 'text-slate-300 dark:text-white/20 line-through'
                    : isOverdue
                    ? 'text-red-500 dark:text-red-400'
                    : isDueSoon
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-600 dark:text-white/55';

                  const showConfetti = confettiTaskId === task.id;

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: pIdx * 0.05 + tIdx * 0.02 }}
                      className={`flex items-center rounded-lg transition-colors ${
                        tIdx % 2 === 0
                          ? 'bg-slate-25 dark:bg-white/[0.015]'
                          : ''
                      } hover:bg-slate-50 dark:hover:bg-white/[0.04]`}
                      style={{ minHeight: 32 }}
                    >
                      {/* Task label */}
                      <div
                        className="flex items-center gap-1.5 pr-2 pl-3 shrink-0"
                        style={{ width: LABEL_W }}
                      >
                        {/* Status icon — clickable for inline toggle */}
                        <TaskStatusBtn
                          task={task}
                          onStatusChange={onStatusChange}
                          confettiTaskId={confettiTaskId}
                          setConfettiTaskId={setConfettiTaskId}
                          setPickerTaskId={setPickerTaskId}
                          pickerTaskId={pickerTaskId}
                        />
                        {/* Priority dot */}
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: PRIORITY_COLORS[task.priority] }}
                        />
                        <span
                          className={`text-[11px] sm:text-xs truncate block leading-tight ${labelCls}`}
                          title={task.title}
                          style={{ fontWeight: 500 }}
                        >
                          {task.title}
                        </span>
                      </div>

                      {/* Task bar */}
                      <div className="flex-1 relative" style={{ height: 28 }}>
                        <div
                          data-task-id={task.id}
                          className="absolute top-1 bottom-1"
                          style={{
                            left:  `${leftPct(task.start_date)}%`,
                            width: `${widthPct(task.start_date, task.end_date)}%`,
                          }}
                        >
                          <button
                            onClick={() => onTaskClick(task)}
                            className="group/bar relative w-full h-full rounded-md flex items-center px-2 gap-1.5 transition-all hover:brightness-105 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30"
                            style={{
                              background: barGradient,
                              border: barBorder,
                              opacity: isDone ? 0.55 : 1,
                            }}
                          >
                            {/* In-progress pulse left accent */}
                            {isInProgress && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                                style={{ background: phase.color, opacity: 0.6 }} />
                            )}

                            {/* Bar content */}
                            <span className="text-[10px] truncate leading-none"
                              style={{
                                color: isDone ? `${phase.color}80` : isOverdue ? '#ef4444' : phase.color,
                                fontWeight: 600,
                                paddingLeft: isInProgress ? 4 : 0,
                              }}>
                              {task.title}
                            </span>

                            {/* Duration badge — desktop only */}
                            {!isMobile && widthPct(task.start_date, task.end_date) > 8 && (
                              <span className="text-[9px] ml-auto shrink-0 opacity-50 tabular-nums"
                                style={{ color: phase.color, fontWeight: 600 }}>
                                {task.duration_hours}ч
                              </span>
                            )}

                            {/* Hover tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150 z-50">
                              <div
                                className="rounded-xl p-3.5 text-left shadow-2xl"
                                style={{
                                  background: 'rgba(10,10,26,0.97)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  backdropFilter: 'blur(8px)',
                                  minWidth: 200,
                                  maxWidth: 300,
                                  whiteSpace: 'normal',
                                }}
                              >
                                {/* Title */}
                                <div className="text-white text-xs mb-2.5" style={{ fontWeight: 700, lineHeight: 1.4 }}>
                                  {task.title}
                                </div>

                                {/* Meta badges */}
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md"
                                    style={{
                                      background: `${PRIORITY_COLORS[task.priority]}20`,
                                      color: PRIORITY_COLORS[task.priority],
                                      fontWeight: 600,
                                    }}>
                                    <Flag className="w-2.5 h-2.5" />
                                    {PRIORITY_LABELS[task.priority]}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/70"
                                    style={{ fontWeight: 500 }}>
                                    <Clock className="w-2.5 h-2.5" />
                                    {task.duration_hours}ч
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md"
                                    style={{
                                      background: `${statusInfo.color}20`,
                                      color: statusInfo.color,
                                      fontWeight: 600,
                                    }}>
                                    <statusInfo.Icon className="w-2.5 h-2.5" />
                                    {statusInfo.label}
                                  </span>
                                </div>

                                {/* Dates */}
                                <div className="text-[10px] text-white/40" style={{ fontWeight: 500 }}>
                                  {formatDateShort(task.start_date)} — {formatDateShort(task.end_date)}
                                </div>

                                {/* Warnings */}
                                {isOverdue && (
                                  <div className="flex items-center gap-1 mt-2 text-[10px] text-red-400" style={{ fontWeight: 600 }}>
                                    <AlertTriangle className="w-3 h-3" /> Просрочено на {differenceInDays(today, startOfDay(parseISO(task.end_date)))} дн.
                                  </div>
                                )}
                                {isDueSoon && (
                                  <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-400" style={{ fontWeight: 600 }}>
                                    <Clock className="w-3 h-3" /> Дедлайн через {differenceInDays(startOfDay(parseISO(task.end_date)), today)} дн.
                                  </div>
                                )}
                                {task.depends_on.length > 0 && (
                                  <div className="text-[10px] text-[#1d4ed8] mt-1.5" style={{ fontWeight: 500 }}>
                                    Зависимости: {task.depends_on.length}
                                  </div>
                                )}

                                {/* Click hint */}
                                <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-white/10 text-[9px] text-white/25">
                                  <ChevronRight className="w-2.5 h-2.5" />
                                  Нажми для редактирования
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Phase divider */}
              {pIdx < plan.phases.length - 1 && (
                <div className="my-2 mx-3 h-px bg-slate-100 dark:bg-white/5" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 pt-4 border-t border-slate-200 dark:border-white/8">
        {/* Status legend */}
        <div className="flex items-center gap-3">
          {([
            { Icon: Circle,       color: '#94a3b8', label: 'К выполнению' },
            { Icon: Play,         color: '#1d4ed8', label: 'В работе' },
            { Icon: CheckCircle2, color: '#10b981', label: 'Готово' },
          ] as const).map(({ Icon, color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <Icon className="w-3 h-3" style={{ color }} />
              <span className="text-[10px] text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="w-px h-3 bg-slate-200 dark:bg-white/10 hidden sm:block" />

        {/* Priority legend */}
        <div className="flex items-center gap-3">
          {[
            { color: '#ef4444', label: 'Высокий' },
            { color: '#f59e0b', label: 'Средний' },
            { color: '#10b981', label: 'Низкий' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="w-px h-3 bg-slate-200 dark:bg-white/10 hidden sm:block" />

        {/* Overdue / today */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>Просрочено</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-[#1d4ed8] rounded-full" />
            <span className="text-[10px] text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>Сегодня</span>
          </div>
        </div>

        {/* Inline toggle hint */}
        {onStatusChange && (
          <>
            <div className="w-px h-3 bg-slate-200 dark:bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#1d4ed8]" />
              <span className="text-[10px] text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>Клик — переключить · Удержание — выбрать статус</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}