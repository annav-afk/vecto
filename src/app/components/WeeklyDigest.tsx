import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, TrendingUp, CheckCircle2, AlertTriangle, Clock, Zap, Download, Mail, Loader2 } from 'lucide-react';
import { Plan, Task } from '../lib/types';
import { format, subDays, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { sendDigestEmail } from '../lib/api';

interface Props {
  plan: Plan;
  onClose: () => void;
}

function calcDigest(plan: Plan) {
  const allTasks = plan.phases.flatMap(p => p.tasks);
  const today = startOfDay(new Date());
  const weekAgo = subDays(today, 7);

  const done = allTasks.filter(t => t.status === 'done');
  const inProgress = allTasks.filter(t => t.status === 'in_progress');
  const overdue = allTasks.filter(t =>
    t.status !== 'done' && isBefore(parseISO(t.end_date), today)
  );

  // Velocity: tasks done this week (approximated by those in done & end_date in last 7 days)
  const doneThisWeek = done.filter(t => {
    const d = parseISO(t.end_date);
    return isAfter(d, weekAgo) && !isAfter(d, today);
  });

  const totalHoursThisWeek = doneThisWeek.reduce((a, t) => a + t.duration_hours, 0);

  // Completion forecast
  const remainingTasks = allTasks.filter(t => t.status !== 'done');
  const velocity = doneThisWeek.length / 7; // tasks per day
  const daysToComplete = velocity > 0 ? Math.ceil(remainingTasks.length / velocity) : null;
  const forecastDate = daysToComplete ? new Date(Date.now() + daysToComplete * 86400000) : null;

  // Phase progress
  const phases = plan.phases.map(ph => ({
    name: ph.name,
    color: ph.color,
    total: ph.tasks.length,
    done: ph.tasks.filter(t => t.status === 'done').length,
  }));

  return { done, inProgress, overdue, doneThisWeek, totalHoursThisWeek, daysToComplete, forecastDate, phases };
}

export function WeeklyDigest({ plan, onClose }: Props) {
  const { user, token } = useAuth();
  const [emailSending, setEmailSending] = useState(false);
  const d = useMemo(() => calcDigest(plan), [plan]);

  const handlePrint = () => window.print();

  const handleEmail = async () => {
    if (!user?.email) { toast.error('Войдите в аккаунт для отправки на email'); return; }
    setEmailSending(true);
    try {
      await sendDigestEmail({
        email: user.email,
        planGoal: plan.goal,
        doneCount: d.doneThisWeek.length,
        overdueCount: d.overdue.length,
        forecastDate: d.forecastDate?.toISOString() ?? null,
        totalHours: d.totalHoursThisWeek,
      }, token ?? undefined);
      toast.success(`Дайджест отправлен на ${user.email}`);
    } catch {
      toast.error('Ошибка отправки дайджеста');
    } finally {
      setEmailSending(false);
    }
  };

  const STAT_CARDS = [
    { label: 'Выполнено за неделю', value: d.doneThisWeek.length, icon: CheckCircle2, color: '#10b981' },
    { label: 'В работе', value: d.inProgress.length, icon: Zap, color: '#1d4ed8' },
    { label: 'Просрочено', value: d.overdue.length, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Часов закрыто', value: `${d.totalHoursThisWeek}ч`, icon: Clock, color: '#f59e0b' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white dark:bg-[#0f0f24] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ fontFamily: "'Inter', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 px-6 pt-5 pb-4 bg-white dark:bg-[#0f0f24] border-b border-slate-100 dark:border-white/8 flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-xl bg-[#1d4ed8]/10 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-[#1d4ed8]" />
          </div>
          <div className="flex-1">
            <h2 className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 600 }}>Итог недели</h2>
            <p className="text-xs text-slate-400 dark:text-white/40">
              {format(subDays(new Date(), 7), 'dd MMM', { locale: ru })} — {format(new Date(), 'dd MMM yyyy', { locale: ru })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEmail}
              disabled={emailSending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {emailSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Email
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/8 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Plan goal */}
          <div>
            <p className="text-xs text-slate-400 dark:text-white/40 mb-1">Цель</p>
            <p className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 500 }}>{plan.goal}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAT_CARDS.map(stat => (
              <div key={stat.label} className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${stat.color}15` }}>
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                </div>
                <div className="text-lg text-slate-900 dark:text-white" style={{ fontWeight: 700 }}>{stat.value}</div>
                <div className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Forecast */}
          {d.forecastDate && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#1d4ed8]/8 to-[#1e40af]/8 border border-[#1d4ed8]/20">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-[#1d4ed8]" />
                <div>
                  <p className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 500 }}>
                    Прогноз завершения: <span className="text-[#1d4ed8]">{format(d.forecastDate, 'dd MMMM yyyy', { locale: ru })}</span>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">
                    При скорости {d.doneThisWeek.length} задач/неделю
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Overdue tasks */}
          {d.overdue.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 dark:text-white/50 mb-2" style={{ fontWeight: 500 }}>ПРОСРОЧЕННЫЕ ЗАДАЧИ</p>
              <div className="space-y-1.5">
                {d.overdue.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-400 flex-1 truncate">{task.title}</span>
                    <span className="text-xs text-red-400 dark:text-red-500 shrink-0">
                      {format(parseISO(task.end_date), 'dd MMM', { locale: ru })}
                    </span>
                  </div>
                ))}
                {d.overdue.length > 5 && (
                  <p className="text-xs text-slate-400 dark:text-white/30 text-center">+{d.overdue.length - 5} задач</p>
                )}
              </div>
            </div>
          )}

          {/* Phase progress */}
          <div>
            <p className="text-xs text-slate-500 dark:text-white/50 mb-3" style={{ fontWeight: 500 }}>ПРОГРЕСС ПО ЭТАПАМ</p>
            <div className="space-y-3">
              {d.phases.map(ph => (
                <div key={ph.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: ph.color }} />
                      <span className="text-slate-700 dark:text-white/70">{ph.name}</span>
                    </div>
                    <span className="text-slate-400 dark:text-white/40">{ph.done}/{ph.total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${ph.total > 0 ? (ph.done / ph.total) * 100 : 0}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ background: ph.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Done tasks this week */}
          {d.doneThisWeek.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 dark:text-white/50 mb-2" style={{ fontWeight: 500 }}>ВЫПОЛНЕНО НА ЭТОЙ НЕДЕЛЕ</p>
              <div className="space-y-1">
                {d.doneThisWeek.slice(0, 6).map(task => (
                  <div key={task.id} className="flex items-center gap-2 py-1.5">
                    <div className="w-4 h-4 rounded-full bg-[#10b981]/15 flex items-center justify-center shrink-0">
                      <svg className="w-2.5 h-2.5 text-[#10b981]" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-white/60 flex-1 truncate">{task.title}</span>
                    <span className="text-xs text-slate-400 dark:text-white/30 shrink-0">{task.duration_hours}ч</span>
                  </div>
                ))}
                {d.doneThisWeek.length > 6 && (
                  <p className="text-xs text-slate-400 dark:text-white/30 text-center mt-1">+{d.doneThisWeek.length - 6} задач</p>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}