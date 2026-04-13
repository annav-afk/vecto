import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Loader2, Plus, Check, AlertCircle } from 'lucide-react';
import { Phase, Task, Plan } from '../lib/types';
import { aiExpandPhase } from '../lib/api';

interface Props {
  phase: Phase;
  plan: Plan;
  onClose: () => void;
  onApply: (phaseId: string, newTasks: Task[]) => void;
}

interface GeneratedTask {
  title: string;
  duration_hours: number;
  priority: 'high' | 'medium' | 'low';
  selected: boolean;
}

export function AIExpandModal({ phase, plan, onClose, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    setTasks([]);
    try {
      const data = await aiExpandPhase({
        goal: plan.goal,
        phaseName: phase.name,
        existingTasks: phase.tasks.map(t => t.title),
        deadline: plan.deadline,
        hoursPerWeek: plan.hours_per_week,
      });
      setTasks((data.tasks as Omit<GeneratedTask, 'selected'>[]).map(t => ({ ...t, selected: true })));
    } catch (err: any) {
      const code = err?.code ?? '';
      setError(
        code === 'quota_exceeded' ? 'Баланс AI исчерпан. Пополните счёт на platform.openai.com' :
        code === 'rate_limited'   ? 'AI временно перегружен. Попробуйте через минуту.' :
        code === 'not_configured' ? 'AI не настроен на сервере.' :
        err.message ?? 'Не удалось сгенерировать задачи'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, selected: !t.selected } : t));

  const handleApply = () => {
    const selected = tasks.filter(t => t.selected);
    if (!selected.length) return;

    const newTasks: Task[] = selected.map(t => ({
      id: Math.random().toString(36).slice(2, 10),
      phase_id: phase.id,
      title: t.title,
      duration_hours: t.duration_hours,
      priority: t.priority,
      depends_on: [],
      status: 'todo',
      start_date: phase.start_date,
      end_date: phase.end_date,
    }));

    onApply(phase.id, newTasks);
    setApplied(true);
    setTimeout(onClose, 1000);
  };

  const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const PRIORITY_LABELS = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="relative bg-white dark:bg-[#0f0f24] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1d4ed8]/20 to-[#1e40af]/20 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-[#1d4ed8]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 600 }}>AI-расширение фазы</h2>
            <p className="text-xs text-slate-400 dark:text-white/40 truncate">«{phase.name}»</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/8 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Phase info */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: phase.color }} />
              <span className="text-xs text-slate-700 dark:text-white/70" style={{ fontWeight: 500 }}>{phase.name}</span>
              <span className="ml-auto text-xs text-slate-400 dark:text-white/30">{phase.tasks.length} задач</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-white/40">
              Существующие: {phase.tasks.slice(0, 3).map(t => t.title).join(', ')}{phase.tasks.length > 3 ? `…` : ''}
            </p>
          </div>

          {/* Generate button */}
          {tasks.length === 0 && !loading && (
            <button
              onClick={generate}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm hover:opacity-90 transition-all shadow-md shadow-[#1d4ed8]/20 flex items-center justify-center gap-2"
              style={{ fontWeight: 600 }}
            >
              <Sparkles className="w-4 h-4" />
              Сгенерировать задачи
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center shadow-lg shadow-[#1d4ed8]/30">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 rounded-2xl border-t-2 border-white/30"
                  />
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 500 }}>Анализируем фазу...</p>
                <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Генерируем задачи для «{phase.name}»</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p style={{ fontWeight: 500 }}>Ошибка генерации</p>
                <p className="text-xs mt-0.5 opacity-80">{error}</p>
                <button onClick={generate} className="mt-2 text-xs underline hover:no-underline">Попробовать снова</button>
              </div>
            </div>
          )}

          {/* Generated tasks */}
          <AnimatePresence>
            {tasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-white/50">Выберите задачи для добавления</span>
                  <button
                    onClick={() => setTasks(prev => prev.map(t => ({ ...t, selected: !prev.every(x => x.selected) })))}
                    className="text-[#1d4ed8] hover:underline"
                  >
                    {tasks.every(t => t.selected) ? 'Снять всё' : 'Выбрать всё'}
                  </button>
                </div>

                {tasks.map((task, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    onClick={() => toggle(i)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      task.selected
                        ? 'bg-[#1d4ed8]/5 border-[#1d4ed8]/30 dark:border-[#1d4ed8]/40'
                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-60'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg shrink-0 flex items-center justify-center transition-all ${
                      task.selected ? 'bg-[#1d4ed8]' : 'border border-slate-300 dark:border-white/20'
                    }`}>
                      {task.selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 500 }}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 dark:text-white/40">{task.duration_hours}ч</span>
                        <span className="text-xs" style={{ color: PRIORITY_COLORS[task.priority] }}>{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Re-generate */}
                <button
                  onClick={generate}
                  className="w-full text-xs text-slate-400 dark:text-white/30 hover:text-[#1d4ed8] transition-colors flex items-center justify-center gap-1.5 py-2"
                >
                  <Loader2 className="w-3 h-3" />
                  Сгенерировать другие варианты
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Apply */}
          {tasks.length > 0 && (
            <button
              onClick={handleApply}
              disabled={tasks.filter(t => t.selected).length === 0 || applied}
              className="w-full py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                fontWeight: 600,
                background: applied ? '#10b981' : 'linear-gradient(to right, #1d4ed8, #1e40af)',
                color: 'white',
                boxShadow: applied ? '0 4px 12px #10b98140' : '0 4px 12px rgba(29,78,216,0.3)',
              }}
            >
              {applied
                ? <><Check className="w-4 h-4" /> Добавлено!</>
                : <><Plus className="w-4 h-4" /> Добавить {tasks.filter(t => t.selected).length} задач</>
              }
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}