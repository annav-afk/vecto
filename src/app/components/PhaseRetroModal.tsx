import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, Star, TrendingUp, TrendingDown, Lightbulb, ArrowRight, Award } from 'lucide-react';
import { Phase, Plan } from '../lib/types';
import { aiPhaseRetro } from '../lib/api';

interface Props {
  phase: Phase;
  plan: Plan;
  onClose: () => void;
  onNextPhase?: () => void;
}

interface RetroData {
  headline: string;
  whatWorked: string[];
  whatSlowed: string[];
  insight: string;
  nextPhaseAdvice: string;
  score: number;
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(10, Math.max(0, score)) / 10;
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#1d4ed8' : score >= 4 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6"
          className="text-slate-100 dark:text-white/10" />
        <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg" style={{ fontWeight: 800, color }}>{score}</div>
        <div className="text-xs text-slate-400 dark:text-white/30" style={{ fontWeight: 500 }}>/10</div>
      </div>
    </div>
  );
}

export function PhaseRetroModal({ phase, plan, onClose, onNextPhase }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RetroData | null>(null);
  const [error, setError] = useState('');

  // Compute stats
  const completedTasks = phase.tasks.filter(t => t.status === 'done');
  const totalTasks = phase.tasks.length;
  const overdueTasks = phase.tasks.filter(t => {
    try {
      // Незавершённая задача считается просроченной, если её дедлайн уже прошёл
      if (t.status !== 'done') return new Date(t.end_date) < new Date();
      // Для выполненных задач: без даты завершения определить опоздание невозможно
      return false;
    } catch {
      return false;
    }
  });
  const plannedHours = phase.tasks.reduce((s, t) => s + t.duration_hours, 0);
  const trackedHours = Math.round(
    phase.tasks.reduce((s, t) => s + ((t.tracked_seconds ?? 0) / 3600), 0) * 10
  ) / 10;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await aiPhaseRetro({
          goal: plan.goal,
          phaseName: phase.name,
          plannedHours,
          trackedHours,
          completedCount: completedTasks.length,
          totalCount: totalTasks,
          overdueCount: overdueTasks.length,
          taskTitles: phase.tasks.map(t => t.title),
        });
        setData(res);
      } catch (err: any) {
        const code = err?.code ?? '';
        setError(
          code === 'quota_exceeded' ? 'Баланс AI исчерпан. Пополните счёт на platform.openai.com' :
          code === 'rate_limited'   ? 'AI временно перегружен. Попробуйте через минуту.' :
          code === 'not_configured' ? 'AI не настроен на сервере.' :
          err.message ?? 'Ошибка загрузки'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Phase color bar */}
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${phase.color}, ${phase.color}99)` }} />

        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4" style={{ color: phase.color }} />
                <span className="text-xs" style={{ color: phase.color, fontWeight: 600 }}>ФАЗА ЗАВЕРШЕНА</span>
              </div>
              <h2 className="text-slate-900 dark:text-white text-base" style={{ fontWeight: 700 }}>{phase.name}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Задач', value: `${completedTasks.length}/${totalTasks}`, color: completedTasks.length === totalTasks ? '#10b981' : '#f59e0b' },
              { label: 'Часов план', value: `${plannedHours}ч`, color: '#1d4ed8' },
              { label: 'Часов факт', value: trackedHours > 0 ? `${trackedHours}ч` : '—', color: trackedHours > plannedHours ? '#ef4444' : '#10b981' },
            ].map(s => (
              <div key={s.label} className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                <div className="text-sm" style={{ fontWeight: 700, color: s.color }}>{s.value}</div>
                <div className="text-xs text-slate-400 dark:text-white/30 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 text-[#1d4ed8] animate-spin" />
              <p className="text-sm text-slate-400 dark:text-white/40">AI анализирует фазу…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <p className="text-center text-slate-400 dark:text-white/40 text-sm py-6">{error}</p>
          )}

          {/* Retro data */}
          {!loading && !error && data && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Score + headline */}
              <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-slate-50 dark:bg-white/5">
                <ScoreRing score={data.score} />
                <div>
                  <p className="text-slate-900 dark:text-white text-sm leading-snug" style={{ fontWeight: 600 }}>{data.headline}</p>
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-1">AI-оценка фазы</p>
                </div>
              </div>

              {/* What worked */}
              {data.whatWorked.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="text-xs text-[#10b981]" style={{ fontWeight: 600 }}>ЧТО СРАБОТАЛО</span>
                  </div>
                  <ul className="space-y-1.5">
                    {data.whatWorked.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-white/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0 mt-1.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What slowed */}
              {data.whatSlowed.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span className="text-xs text-[#f59e0b]" style={{ fontWeight: 600 }}>ЧТО ЗАМЕДЛЯЛО</span>
                  </div>
                  <ul className="space-y-1.5">
                    {data.whatSlowed.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-white/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0 mt-1.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insight + Next phase advice */}
              <div className="space-y-2 mb-5">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1d4ed8]/8 border border-[#1d4ed8]/15">
                  <Lightbulb className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#1d4ed8]/80">{data.insight}</p>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <Star className="w-3.5 h-3.5 text-[#f59e0b] shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 dark:text-white/60"><strong>Совет для следующей фазы:</strong> {data.nextPhaseAdvice}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  style={{ fontWeight: 500 }}>
                  Закрыть
                </button>
                {onNextPhase && (
                  <button onClick={() => { onClose(); onNextPhase(); }}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-1.5"
                    style={{ background: phase.color, fontWeight: 600 }}>
                    Следующая фаза
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}