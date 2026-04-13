import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';

const CHECKLIST_KEY = 'stride_onboarding';

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  xp: number;
}

const STEPS: ChecklistStep[] = [
  { id: 'create_plan',   label: 'Создать первый план',           description: 'Опишите цель и сгенерируйте план',   xp: 50  },
  { id: 'open_kanban',   label: 'Открыть вид Kanban',            description: 'Переключитесь на доску задач',        xp: 20  },
  { id: 'complete_task', label: 'Выполнить первую задачу',        description: 'Переведите задачу в статус «Готово»', xp: 30  },
  { id: 'share_plan',    label: 'Поделиться планом',             description: 'Создайте публичную ссылку',           xp: 40  },
  { id: 'use_focus',     label: 'Попробовать режим фокуса',      description: 'Нажмите F на странице плана',         xp: 60  },
  { id: 'login',         label: 'Войти в аккаунт',               description: 'Синхронизируйте планы в облаке',      xp: 100 },
];

import { updateOnboarding, getOnboarding } from '../lib/cloudSync';

function getCompleted(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
}

export function markChecklistStep(stepId: string) {
  const c = getCompleted();
  c[stepId] = true;
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(c));
  // Sync to cloud
  try { updateOnboarding({ checklist: c }); } catch {}
}

export function OnboardingChecklist() {
  const [completed, setCompleted] = useState<Record<string, boolean>>(getCompleted);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Listen for external step completions
  useEffect(() => {
    const refresh = () => setCompleted(getCompleted());
    window.addEventListener('stride:checklist', refresh);
    return () => window.removeEventListener('stride:checklist', refresh);
  }, []);

  const doneCount = STEPS.filter(s => completed[s.id]).length;
  const totalXP = STEPS.filter(s => completed[s.id]).reduce((a, s) => a + s.xp, 0);
  const maxXP = STEPS.reduce((a, s) => a + s.xp, 0);
  const allDone = doneCount === STEPS.length;

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden shadow-sm"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(s => !s)}
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1d4ed8]/15 to-[#1e40af]/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#1d4ed8]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>Начало работы</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/10 text-[#1d4ed8]" style={{ fontWeight: 600 }}>
              {totalXP} XP
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#1e40af]"
                animate={{ width: `${(doneCount / STEPS.length) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs text-slate-400 dark:text-white/30 shrink-0">{doneCount}/{STEPS.length}</span>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setDismissed(true); }}
          className="p-1 rounded text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-white/30" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/30" />}
      </div>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1.5">
              {STEPS.map((step, i) => {
                const done = !!completed[step.id];
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${done ? 'opacity-60' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
                      : <Circle className="w-4 h-4 text-slate-300 dark:text-white/20 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${done ? 'line-through text-slate-400 dark:text-white/30' : 'text-slate-700 dark:text-white/70'}`} style={{ fontWeight: 500 }}>
                        {step.label}
                      </p>
                      {!done && (
                        <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">{step.description}</p>
                      )}
                    </div>
                    <span className={`text-xs shrink-0 ${done ? 'text-[#10b981]' : 'text-slate-400 dark:text-white/30'}`}>
                      +{step.xp} XP
                    </span>
                  </motion.div>
                );
              })}

              {allDone && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-3 rounded-xl bg-gradient-to-r from-[#1d4ed8]/8 to-[#1e40af]/8 border border-[#1d4ed8]/20 text-center"
                >
                  <p className="text-sm text-[#1d4ed8]" style={{ fontWeight: 600 }}>🎉 Все шаги выполнены!</p>
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">Вы набрали {maxXP} XP</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}