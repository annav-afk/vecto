import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Zap, Scissors, CheckCircle2, Loader2, Shield, ChevronRight } from 'lucide-react';
import { Plan, Task } from '../lib/types';
import { aiPanicMode } from '../lib/api';
import { differenceInDays, parseISO } from 'date-fns';

interface Props {
  plan: Plan;
  onClose: () => void;
  onApplyPanicPlan: (criticalTaskIds: Set<string>) => void;
}

interface PanicResult {
  criticalTaskIds: string[];
  cutTaskIds: string[];
  reasoning: string;
  mvpSummary: string;
}

export function PanicModeModal({ plan, onClose, onApplyPanicPlan }: Props) {
  const [step, setStep] = useState<'confirm' | 'loading' | 'result'>('confirm');
  const [result, setResult] = useState<PanicResult | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  const allTasks = plan.phases.flatMap(p => p.tasks);
  const doneTasks = allTasks.filter(t => t.status === 'done');
  const pendingTasks = allTasks.filter(t => t.status !== 'done');
  const progress = allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0;
  const daysLeft = differenceInDays(parseISO(plan.deadline), new Date());

  const handleAnalyze = async () => {
    setStep('loading');
    setError('');
    try {
      const data = await aiPanicMode({
        goal: plan.goal,
        deadline: plan.deadline,
        daysLeft,
        progress,
        phases: plan.phases.map(ph => ({
          name: ph.name,
          tasks: ph.tasks.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            duration_hours: t.duration_hours,
          })),
        })),
      });
      setResult(data);
      setStep('result');
    } catch (err: any) {
      const code = err?.code ?? '';
      setError(
        code === 'quota_exceeded' ? 'Баланс AI исчерпан. Пополните счёт на platform.openai.com' :
        code === 'rate_limited'   ? 'AI временно перегружен. Попробуйте через минуту.' :
        code === 'not_configured' ? 'AI не настроен на сервере.' :
        err.message ?? 'Ошибка AI'
      );
      setStep('confirm');
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyPanicPlan(new Set(result.criticalTaskIds));
    onClose();
  };

  const criticalTasks = result
    ? allTasks.filter(t => result.criticalTaskIds.includes(t.id))
    : [];
  const cutTasks = result
    ? allTasks.filter(t => result.cutTaskIds.includes(t.id))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
        className="relative bg-white dark:bg-[#13132b] border-0 sm:border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto">

        {/* Drag handle — mobile only */}
        <div className="sm:hidden sheet-handle" />

        {/* Red glow header */}
        <div className="h-1.5 bg-gradient-to-r from-[#ef4444] via-[#f97316] to-[#f59e0b]" />

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-slate-900 dark:text-white text-base" style={{ fontWeight: 700 }}>
                  🚨 Режим паники
                </h2>
                <p className="text-red-500 text-xs" style={{ fontWeight: 500 }}>
                  {daysLeft > 0 ? `Осталось ${daysLeft} дн. · ${progress}% выполнено` : `Дедлайн просрочен · ${progress}% выполнено`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Step: Confirm ── */}
          {step === 'confirm' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-xl p-4 mb-5">
                <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                  AI проанализирует все <strong>{pendingTasks.length} незавершённых задач</strong> и выберет минимальный набор для достижения цели. Некритичные задачи будут помечены к удалению.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Всего задач', value: allTasks.length, color: '#1d4ed8' },
                  { label: 'Осталось', value: pendingTasks.length, color: '#f59e0b' },
                  { label: 'Дней', value: Math.max(0, daysLeft), color: daysLeft < 7 ? '#ef4444' : '#10b981' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div className="text-xl" style={{ fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}
              <button onClick={handleAnalyze}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm hover:opacity-90 transition-all shadow-lg shadow-red-500/25 flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}>
                <Zap className="w-4 h-4" />
                Запустить AI-триаж
              </button>
            </motion.div>
          )}

          {/* ── Step: Loading ── */}
          {step === 'loading' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
                <div className="absolute inset-0 w-10 h-10 rounded-full bg-red-500/20 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 600 }}>AI анализирует план…</p>
                <p className="text-slate-400 dark:text-white/40 text-xs mt-1">Определяет критический путь</p>
              </div>
            </motion.div>
          )}

          {/* ── Step: Result ── */}
          {step === 'result' && result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* MVP Summary */}
              <div className="bg-[#1d4ed8]/8 border border-[#1d4ed8]/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield className="w-4 h-4 text-[#1d4ed8]" />
                  <span className="text-xs text-[#1d4ed8]" style={{ fontWeight: 600 }}>MVP-план</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-white/70 leading-relaxed">{result.mvpSummary}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/25">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-600 dark:text-green-400" style={{ fontWeight: 600 }}>Критично</span>
                  </div>
                  <div className="text-2xl text-green-700 dark:text-green-300" style={{ fontWeight: 700 }}>{criticalTasks.length}</div>
                  <div className="text-xs text-green-600/70 dark:text-green-400/60">задач оставить</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Scissors className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
                    <span className="text-xs text-slate-400 dark:text-white/40" style={{ fontWeight: 600 }}>Урезать</span>
                  </div>
                  <div className="text-2xl text-slate-700 dark:text-white/60" style={{ fontWeight: 700 }}>{cutTasks.length}</div>
                  <div className="text-xs text-slate-400 dark:text-white/30">задач удалить</div>
                </div>
              </div>

              {/* Preview toggle */}
              <button onClick={() => setPreview(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 text-xs text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/8 transition-colors mb-4">
                <span>Посмотреть список задач</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${preview ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {preview && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden mb-4">
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {criticalTasks.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-green-50 dark:bg-green-500/8">
                          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                          <span className="text-xs text-slate-700 dark:text-white/70 truncate">{t.title}</span>
                        </div>
                      ))}
                      {cutTasks.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-50 dark:bg-white/5 opacity-60">
                          <Scissors className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-400 dark:text-white/40 line-through truncate">{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-xs text-slate-400 dark:text-white/35 mb-4 leading-relaxed">{result.reasoning}</p>

              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  style={{ fontWeight: 500 }}>
                  Отмена
                </button>
                <button onClick={handleApply}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm hover:opacity-90 transition-all shadow-md shadow-red-500/25"
                  style={{ fontWeight: 600 }}>
                  Применить план
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Safe area bottom spacer */}
        <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom)', minHeight: 12 }} />
      </motion.div>
    </div>
  );
}