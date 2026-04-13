import { useState, useMemo, useCallback } from 'react';
import { Plan, Task, TaskStatus } from '../lib/types';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isWithinInterval, parseISO, addMonths, subMonths,
  startOfWeek, endOfWeek, isPast, startOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Play,
  Flag, Clock, AlertTriangle, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const PRIORITY_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

const STATUS_CFG = {
  done:        { Icon: CheckCircle2, color: '#10b981' },
  in_progress: { Icon: Play,         color: '#1d4ed8' },
  todo:        { Icon: Circle,       color: '#94a3b8' },
} as const;

type CalTask = Task & { phaseColor: string; phaseName: string };

/* ── Tooltip for a single task ──────────────────────────────────────────── */
function TaskPill({ task, onTaskClick, onStatusChange, confettiTaskId, setConfettiTaskId }: {
  task: CalTask;
  onTaskClick: (t: Task) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  confettiTaskId: string | null;
  setConfettiTaskId: (id: string | null) => void;
}) {
  const isDone = task.status === 'done';
  const isOverdue = !isDone && isPast(startOfDay(parseISO(task.end_date))) && !isSameDay(parseISO(task.end_date), new Date());
  const cfg = STATUS_CFG[task.status] ?? STATUS_CFG.todo;
  const showConfetti = confettiTaskId === task.id;
  const [showPicker, setShowPicker] = useState(false);

  const longPress = useLongPress(
    useCallback(() => {
      if (onStatusChange) setShowPicker(true);
    }, [onStatusChange]),
    400,
  );

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPress.wasLongPress()) return;
    if (!onStatusChange) return;
    const next = NEXT_STATUS[task.status];
    if (next === 'done') {
      setConfettiTaskId(task.id);
      haptic('success');
    } else {
      haptic('light');
    }
    onStatusChange(task.id, next);
  };

  const handlePickerSelect = useCallback((status: TaskStatus) => {
    if (!onStatusChange) return;
    if (status === 'done' && task.status !== 'done') {
      setConfettiTaskId(task.id);
    }
    onStatusChange(task.id, status);
  }, [task, onStatusChange, setConfettiTaskId]);

  return (
    <button
      onClick={e => { e.stopPropagation(); onTaskClick(task); }}
      className="group/pill relative w-full text-left flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] sm:text-xs truncate transition-all hover:brightness-95"
      style={{
        background: isDone ? `${task.phaseColor}10` : `${task.phaseColor}18`,
        border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : `${task.phaseColor}30`}`,
        opacity: isDone ? 0.55 : 1,
        textDecoration: isDone ? 'line-through' : 'none',
      }}
    >
      {/* Status icon — click to toggle, long-press to pick */}
      <span
        onClick={handleToggle}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (onStatusChange) setShowPicker(true); }}
        {...(onStatusChange ? {
          onTouchStart: longPress.onTouchStart,
          onTouchEnd: longPress.onTouchEnd,
          onTouchMove: longPress.onTouchMove,
        } : {})}
        className="relative shrink-0 hover:scale-125 transition-transform cursor-pointer"
        title={onStatusChange ? 'Клик — переключить · Удержание — выбрать' : undefined}
      >
        <cfg.Icon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
        <MiniConfetti active={showConfetti} size="sm" onComplete={() => setConfettiTaskId(null)} />
        <StatusPickerMenu
          visible={showPicker}
          currentStatus={task.status}
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
        />
      </span>
      <div className="w-1 h-1 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} />
      <span className="truncate" style={{ color: isOverdue ? '#ef4444' : task.phaseColor, fontWeight: 500 }}>
        {task.title}
      </span>

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover/pill:opacity-100 transition-opacity z-50">
        <div className="rounded-lg px-2.5 py-2 shadow-xl whitespace-nowrap text-[10px]"
          style={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-white mb-1" style={{ fontWeight: 600 }}>{task.title}</div>
          <div className="flex items-center gap-2 text-white/50">
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />{task.duration_hours}ч
            </span>
            <span style={{ color: PRIORITY_COLORS[task.priority] }}>
              <Flag className="w-2.5 h-2.5 inline mr-0.5" />
              {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
            <span className="text-white/30">{task.phaseName}</span>
          </div>
          {isOverdue && (
            <div className="flex items-center gap-1 mt-1 text-red-400" style={{ fontWeight: 600 }}>
              <AlertTriangle className="w-2.5 h-2.5" />Просрочено
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Main Calendar ──────────────────────────────────────────────────────── */
export function CalendarView({ plan, onTaskClick, onStatusChange }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const firstDate = plan.phases[0]?.start_date;
    return firstDate ? parseISO(firstDate) : new Date();
  });
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [confettiTaskId, setConfettiTaskId] = useState<string | null>(null);

  const allTasks = useMemo<CalTask[]>(() =>
    plan.phases.flatMap(phase =>
      phase.tasks.map(task => ({ ...task, phaseColor: phase.color, phaseName: phase.name }))
    ), [plan]);

  function getTasksForDay(day: Date) {
    return allTasks.filter(task => {
      try {
        const start = startOfDay(parseISO(task.start_date));
        const end = startOfDay(parseISO(task.end_date));
        return isWithinInterval(startOfDay(day), { start, end }) || isSameDay(day, start) || isSameDay(day, end);
      } catch { return false; }
    });
  }

  const monthStart    = startOfMonth(currentMonth);
  const monthEnd      = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd   = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days          = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today         = new Date();

  // Summary for the month
  const monthTasks = useMemo(() => {
    const all = allTasks.filter(t => {
      try {
        const start = startOfDay(parseISO(t.start_date));
        const end   = startOfDay(parseISO(t.end_date));
        return isWithinInterval(monthStart, { start, end }) ||
               isWithinInterval(monthEnd, { start, end }) ||
               (start >= monthStart && start <= monthEnd);
      } catch { return false; }
    });
    return {
      total: all.length,
      done:  all.filter(t => t.status === 'done').length,
      overdue: all.filter(t => t.status !== 'done' && isPast(startOfDay(parseISO(t.end_date))) && !isSameDay(parseISO(t.end_date), today)).length,
    };
  }, [allTasks, currentMonth]);

  const goToday = () => setCurrentMonth(today);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-xl text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-slate-900 dark:text-white capitalize text-sm sm:text-base select-none" style={{ fontWeight: 700 }}>
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-xl text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Mini stats */}
          <div className="hidden sm:flex items-center gap-3 text-[11px]">
            <span className="text-slate-400 dark:text-white/30">
              {monthTasks.total} задач
            </span>
            {monthTasks.done > 0 && (
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="w-3 h-3" />{monthTasks.done}
              </span>
            )}
            {monthTasks.overdue > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3 h-3" />{monthTasks.overdue}
              </span>
            )}
          </div>

          <button onClick={goToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-[#1d4ed8] hover:bg-[#1d4ed8]/8 dark:hover:bg-[#1d4ed8]/15 transition-all"
            style={{ fontWeight: 600 }}>
            <Calendar className="w-3 h-3" />Сегодня
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-[10px] sm:text-xs py-2 select-none ${
            i >= 5 ? 'text-slate-300 dark:text-white/15' : 'text-slate-400 dark:text-white/30'
          }`} style={{ fontWeight: 600 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="relative">
        {/* One-time long-press hint */}
        {onStatusChange && (
          <div className="absolute left-2 top-2" style={{ zIndex: 51 }}>
            <LongPressHint />
          </div>
        )}
        <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-slate-200 dark:border-white/8"
          style={{ background: 'rgba(226,232,240,0.5)' }}>
          {days.map((day, i) => {
            const iso = day.toISOString();
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isTodayDay     = isSameDay(day, today);
            const isWeekend      = day.getDay() === 0 || day.getDay() === 6;
            const dayTasks       = getTasksForDay(day);
            const hasTasks       = dayTasks.length > 0;
            const overdueTasks   = dayTasks.filter(t => t.status !== 'done' && isPast(startOfDay(parseISO(t.end_date))) && !isSameDay(parseISO(t.end_date), today));
            const isExpanded     = expandedDay === iso;
            const maxVisible     = isExpanded ? 10 : 2;

            return (
              <motion.div
                key={iso}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.003 }}
                onClick={() => hasTasks && dayTasks.length > 2 ? setExpandedDay(isExpanded ? null : iso) : undefined}
                className={`relative min-h-[72px] sm:min-h-[88px] p-1.5 sm:p-2 transition-all ${
                  isCurrentMonth
                    ? isWeekend
                      ? 'bg-slate-50/80 dark:bg-white/[0.02]'
                      : 'bg-white dark:bg-[#0a0a1a]'
                    : 'bg-slate-50/50 dark:bg-white/[0.01] opacity-40'
                } ${isTodayDay ? 'ring-2 ring-inset ring-[#1d4ed8]/30 dark:ring-[#1d4ed8]/40' : ''
                } ${hasTasks && dayTasks.length > 2 ? 'cursor-pointer' : ''
                } hover:bg-slate-50 dark:hover:bg-white/[0.04]`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-[11px] sm:text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                    isTodayDay
                      ? 'bg-[#1d4ed8] text-white'
                      : isCurrentMonth
                      ? isWeekend
                        ? 'text-slate-400 dark:text-white/25'
                        : 'text-slate-700 dark:text-white/70'
                      : 'text-slate-300 dark:text-white/15'
                  }`} style={{ fontWeight: isTodayDay ? 700 : 500 }}>
                    {format(day, 'd')}
                  </div>

                  {/* Overdue indicator dot */}
                  {overdueTasks.length > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, maxVisible).map(task => (
                    <TaskPill key={task.id + iso} task={task} onTaskClick={onTaskClick} onStatusChange={onStatusChange} confettiTaskId={confettiTaskId} setConfettiTaskId={setConfettiTaskId} />
                  ))}
                  {!isExpanded && dayTasks.length > 2 && (
                    <div className="text-[10px] text-slate-400 dark:text-white/25 pl-1 cursor-pointer hover:text-[#1d4ed8] dark:hover:text-[#1d4ed8] transition-colors" style={{ fontWeight: 500 }}>
                      +{dayTasks.length - 2} ещё
                    </div>
                  )}
                  {isExpanded && dayTasks.length > 2 && (
                    <div className="text-[10px] text-[#1d4ed8] pl-1 cursor-pointer hover:text-[#1d4ed8]/70 transition-colors" style={{ fontWeight: 500 }}>
                      Свернуть
                    </div>
                  )}
                </div>

                {/* Task count badge for dense days */}
                {dayTasks.length > 3 && !isExpanded && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] bg-[#1d4ed8]/10 dark:bg-[#1d4ed8]/20 text-[#1d4ed8]"
                    style={{ fontWeight: 700 }}>
                    {dayTasks.length}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/6">
        <div className="flex items-center gap-2">
          {([
            { Icon: Circle,       color: '#94a3b8', label: 'К выполнению' },
            { Icon: Play,         color: '#1d4ed8', label: 'В работе' },
            { Icon: CheckCircle2, color: '#10b981', label: 'Готово' },
          ] as const).map(({ Icon, color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <Icon className="w-2.5 h-2.5" style={{ color }} />
              <span className="text-[10px] text-slate-400 dark:text-white/25" style={{ fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {([
            { color: '#ef4444', label: 'Высокий' },
            { color: '#f59e0b', label: 'Средний' },
            { color: '#10b981', label: 'Низкий' },
          ]).map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-slate-400 dark:text-white/25" style={{ fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}