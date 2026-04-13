import { useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Clock, AlertTriangle, ArrowRight, Zap, Calendar } from 'lucide-react';
import { Plan, Task, TaskStatus } from '../lib/types';
import { isToday, isPast, parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router';

interface TodayTask {
  task: Task;
  plan: Plan;
  phaseColor: string;
  phaseName: string;
  isOverdue: boolean;
}

interface Props {
  plans: Plan[];
  onTaskClick?: (planId: string, taskId: string) => void;
  onStatusChange?: (planId: string, taskId: string, status: TaskStatus) => void;
}

const PRIORITY_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

export function TodayWidget({ plans, onTaskClick, onStatusChange }: Props) {
  const navigate = useNavigate();

  const todayTasks = useMemo<TodayTask[]>(() => {
    const result: TodayTask[] = [];
    for (const plan of plans) {
      for (const phase of plan.phases) {
        for (const task of phase.tasks) {
          if (task.status === 'done') continue;
          try {
            const endDate = parseISO(task.end_date);
            const startDate = parseISO(task.start_date);
            const isOverdue = isPast(endDate) && !isToday(endDate);
            const isDueToday = isToday(endDate) || isToday(startDate);
            if (isDueToday || isOverdue) {
              result.push({ task, plan, phaseColor: phase.color, phaseName: phase.name, isOverdue });
            }
          } catch {
            // skip invalid dates
          }
        }
      }
    }
    // Sort: overdue first, then by priority
    const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return result.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return (PRIORITY_ORDER[a.task.priority] ?? 1) - (PRIORITY_ORDER[b.task.priority] ?? 1);
    });
  }, [plans]);

  const overdue = todayTasks.filter(t => t.isOverdue);
  const today = todayTasks.filter(t => !t.isOverdue);
  const totalDone = plans.flatMap(p => p.phases.flatMap(ph => ph.tasks)).filter(t => t.status === 'done').length;
  const totalAll  = plans.flatMap(p => p.phases.flatMap(ph => ph.tasks)).length;

  const todayDate = format(new Date(), 'EEEE, d MMMM', { locale: ru });

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="w-10 h-10 text-slate-200 dark:text-white/15 mb-4" />
        <p className="text-slate-400 dark:text-white/40 text-sm mb-4">Нет активных планов</p>
        <button onClick={() => navigate('/new')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm"
          style={{ fontWeight: 600 }}>
          Создать план
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 dark:text-white text-base capitalize" style={{ fontWeight: 700 }}>
            {todayDate}
          </h2>
          <p className="text-slate-400 dark:text-white/40 text-xs mt-0.5">
            {todayTasks.length === 0 ? 'Задач на сегодня нет 🎉' : `${todayTasks.length} задач${todayTasks.length === 1 ? 'а' : ''} на сегодня`}
          </p>
        </div>
        {totalAll > 0 && (
          <div className="text-right">
            <div className="text-sm text-[#1d4ed8]" style={{ fontWeight: 700 }}>{totalDone}/{totalAll}</div>
            <div className="text-xs text-slate-400 dark:text-white/40">всего</div>
          </div>
        )}
      </div>

      {/* Empty today state */}
      {todayTasks.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
          <div className="text-3xl mb-3">🎉</div>
          <p className="text-slate-600 dark:text-white/60 text-sm" style={{ fontWeight: 600 }}>Все задачи на сегодня выполнены!</p>
          <p className="text-slate-400 dark:text-white/35 text-xs mt-1">Отличная работа. Можно отдохнуть.</p>
        </motion.div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-red-500" style={{ fontWeight: 600 }}>ПРОСРОЧЕНО ({overdue.length})</span>
          </div>
          <div className="space-y-2">
            {overdue.map(({ task, plan, phaseColor, phaseName }) => (
              <TaskRow key={`${plan.id}-${task.id}`}
                task={task} plan={plan} phaseColor={phaseColor} phaseName={phaseName}
                isOverdue onTaskClick={onTaskClick} onStatusChange={onStatusChange} />
            ))}
          </div>
        </div>
      )}

      {/* Today */}
      {today.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-[#1d4ed8]" />
            <span className="text-xs text-[#1d4ed8]" style={{ fontWeight: 600 }}>НА СЕГОДНЯ ({today.length})</span>
          </div>
          <div className="space-y-2">
            {today.map(({ task, plan, phaseColor, phaseName }) => (
              <TaskRow key={`${plan.id}-${task.id}`}
                task={task} plan={plan} phaseColor={phaseColor} phaseName={phaseName}
                isOverdue={false} onTaskClick={onTaskClick} onStatusChange={onStatusChange} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task, plan, phaseColor, phaseName, isOverdue, onTaskClick, onStatusChange,
}: TodayTask & {
  onTaskClick?: (planId: string, taskId: string) => void;
  onStatusChange?: (planId: string, taskId: string, status: TaskStatus) => void;
}) {
  const navigate = useNavigate();
  const isDone = task.status === 'done';
  const subtasksTotal = task.subtasks?.length ?? 0;
  const subtasksDone = task.subtasks?.filter(s => s.done).length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer
        ${isOverdue
          ? 'bg-red-50/60 dark:bg-red-500/8 border-red-100 dark:border-red-500/15 hover:border-red-200 dark:hover:border-red-500/25'
          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm'}`}
      onClick={() => {
        if (onTaskClick) onTaskClick(plan.id, task.id);
        else navigate(`/plan/${plan.id}`);
      }}
    >
      {/* Status toggle */}
      <button
        onClick={e => { e.stopPropagation(); onStatusChange?.(plan.id, task.id, isDone ? 'todo' : 'done'); }}
        className="shrink-0 transition-transform hover:scale-110"
      >
        {isDone
          ? <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
          : <Circle className={`w-5 h-5 ${isOverdue ? 'text-red-300 dark:text-red-500/50' : 'text-slate-300 dark:text-white/20'}`} />
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isDone ? 'line-through text-slate-400 dark:text-white/30' : 'text-slate-900 dark:text-white'}`}
          style={{ fontWeight: 500 }}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: phaseColor }}>{phaseName}</span>
          <span className="text-slate-200 dark:text-white/15 text-xs">·</span>
          <span className="text-xs text-slate-400 dark:text-white/35">{plan.goal.length > 30 ? plan.goal.slice(0, 30) + '…' : plan.goal}</span>
          {subtasksTotal > 0 && (
            <>
              <span className="text-slate-200 dark:text-white/15 text-xs">·</span>
              <span className="text-xs text-slate-400 dark:text-white/35">✓ {subtasksDone}/{subtasksTotal}</span>
            </>
          )}
        </div>
      </div>

      {/* Priority + hours */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[task.priority] }} title={task.priority} />
        <span className="text-xs text-slate-400 dark:text-white/30 hidden sm:block">
          <Clock className="w-3 h-3 inline mr-0.5" />{task.duration_hours}ч
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-200 dark:text-white/20 group-hover:text-slate-400 dark:group-hover:text-white/40 transition-colors" />
      </div>
    </motion.div>
  );
}