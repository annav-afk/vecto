/**
 * TomiOnboardingQuiz — интерактивное 60-секундное знакомство с Томи.
 * 3 вопроса → выбор оптимального режима личности + первая микро-победа.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronRight, Check, Zap } from 'lucide-react';
import { TomiAvatar } from './TomiAssistant';
import type { PersonalityMode } from './TomiAssistant';

const QUIZ_DONE_KEY = 'tomi_quiz_done';

// ── Questions ─────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'q1',
    text: 'Как лучше всего тебе помогать?',
    emoji: '🤔',
    options: [
      { id: 'a', text: 'Мягко поддерживать', emoji: '🤗', mode: 'soft' as PersonalityMode },
      { id: 'b', text: 'Требовать результат', emoji: '⚔️', mode: 'spartan' as PersonalityMode },
      { id: 'c', text: 'Смешить и мотивировать', emoji: '😄', mode: 'joker' as PersonalityMode },
      { id: 'd', text: 'Говорить цифрами', emoji: '📊', mode: 'business' as PersonalityMode },
    ],
  },
  {
    id: 'q2',
    text: 'Как ты обычно работаешь над задачами?',
    emoji: '💼',
    options: [
      { id: 'a', text: 'Плавно и спокойно', emoji: '🌊', mode: 'zen' as PersonalityMode },
      { id: 'b', text: 'На пределе, до результата', emoji: '🔥', mode: 'strict' as PersonalityMode },
      { id: 'c', text: 'С шутками и перерывами', emoji: '😂', mode: 'joker' as PersonalityMode },
      { id: 'd', text: 'Методично по KPI', emoji: '📈', mode: 'business' as PersonalityMode },
    ],
  },
  {
    id: 'q3',
    text: 'Что тебе важнее прямо сейчас?',
    emoji: '🎯',
    options: [
      { id: 'a', text: 'Снять стресс и найти баланс', emoji: '🧘', mode: 'zen' as PersonalityMode },
      { id: 'b', text: 'Закрыть всё без отмазок', emoji: '🛡️', mode: 'spartan' as PersonalityMode },
      { id: 'c', text: 'Зарядиться мотивацией', emoji: '🚀', mode: 'motivational' as PersonalityMode },
      { id: 'd', text: 'Не скучать в процессе', emoji: '🎭', mode: 'joker' as PersonalityMode },
    ],
  },
];

// Score the most-selected mode across 3 answers
function pickMode(answers: PersonalityMode[]): PersonalityMode {
  const counts: Partial<Record<PersonalityMode, number>> = {};
  for (const m of answers) counts[m] = (counts[m] ?? 0) + 1;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return (sorted[0]?.[0] ?? 'soft') as PersonalityMode;
}

const MODE_LABELS: Record<PersonalityMode, { label: string; desc: string; emoji: string; color: string }> = {
  soft:         { label: 'Мягкий',    desc: 'Поддержка и тепло — мой стиль с тобой.',        emoji: '🤗', color: '#10b981' },
  strict:       { label: 'Строгий',   desc: 'Требовательность и конкретность — без лирики.',  emoji: '⚔️', color: '#ef4444' },
  business:     { label: 'Деловой',   desc: 'KPI, метрики, конкретные шаги.',                 emoji: '📊', color: '#f59e0b' },
  motivational: { label: 'Мотиватор',  desc: 'Заряжаю энергией и верю в тебя!',               emoji: '🔥', color: '#1d4ed8' },
  zen:          { label: 'Дзен',      desc: 'Спокойствие и баланс — ключ к продуктивности.',  emoji: '🧘', color: '#60a5fa' },
  spartan:      { label: 'Спартанец', desc: 'Жёстко, без оправданий. Дедлайны — закон.',      emoji: '🛡️', color: '#dc2626' },
  joker:        { label: 'Весельчак', desc: 'Делаем всё с юмором — но результаты реальные!',  emoji: '😄', color: '#16a34a' },
};

interface Props {
  onComplete: (mode: PersonalityMode) => void;
  onSkip: () => void;
}

export function TomiOnboardingQuiz({ onComplete, onSkip }: Props) {
  const [step, setStep]       = useState(0); // 0 = intro, 1-3 = questions, 4 = result
  const [answers, setAnswers] = useState<PersonalityMode[]>([]);
  const [chosen, setChosen]   = useState<PersonalityMode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const q = step >= 1 && step <= 3 ? QUESTIONS[step - 1] : null;
  const totalSteps = 3;
  const progress   = step >= 1 ? ((step - 1) / totalSteps) * 100 : 0;

  function handleAnswer(optId: string, mode: PersonalityMode) {
    setSelected(optId);
    setTimeout(() => {
      const next = [...answers, mode];
      setAnswers(next);
      setSelected(null);
      if (next.length === totalSteps) {
        const result = pickMode(next);
        setChosen(result);
        setStep(4);
      } else {
        setStep(s => s + 1);
      }
    }, 380);
  }

  function handleAccept() {
    if (!chosen) return;
    try { localStorage.setItem(QUIZ_DONE_KEY, '1'); } catch {}
    onComplete(chosen);
  }

  return (
    <div className="fixed inset-0 z-[10100] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(7,15,30,0.92)', backdropFilter: 'blur(12px)' }}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm bg-gradient-to-b from-[#0d1a36] to-[#070f1e] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Progress bar */}
        {step >= 1 && step <= 3 && (
          <div className="h-1 bg-white/5">
            <motion.div
              className="h-full bg-[#1d4ed8] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* Intro */}
            {step === 0 && (
              <motion.div key="intro"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="text-center">
                <div className="flex justify-center mb-4">
                  <TomiAvatar size={72} mood="happy" />
                </div>
                <h2 className="text-white text-xl font-bold mb-2">Привет! Я Томи 👋</h2>
                <p className="text-white/55 text-sm leading-relaxed mb-6">
                  Твой персональный AI-менеджер. Давай познакомимся за&nbsp;60 секунд — я&nbsp;настрою стиль под тебя!
                </p>
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-3.5 rounded-2xl bg-[#1d4ed8] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1d4ed8]/90 active:scale-95 transition-all touch-manipulation">
                  <Sparkles className="w-4 h-4" />
                  Начать знакомство
                </button>
                <button
                  onClick={onSkip}
                  className="w-full mt-2.5 py-2.5 text-white/30 text-sm hover:text-white/60 transition-colors touch-manipulation">
                  Пропустить
                </button>
              </motion.div>
            )}

            {/* Questions */}
            {step >= 1 && step <= 3 && q && (
              <motion.div key={q.id}
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-white/30 font-medium">Вопрос {step} из {totalSteps}</span>
                </div>
                <p className="text-white text-base font-semibold mb-5 leading-snug">
                  {q.emoji} {q.text}
                </p>
                <div className="space-y-2.5">
                  {q.options.map(opt => (
                    <motion.button
                      key={opt.id}
                      onClick={() => handleAnswer(opt.id, opt.mode)}
                      whileTap={{ scale: 0.97 }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all touch-manipulation ${
                        selected === opt.id
                          ? 'bg-[#1d4ed8]/25 border-[#1d4ed8]/60 text-white'
                          : 'bg-white/4 border-white/10 text-white/75 hover:bg-white/8 hover:border-white/20'
                      }`}>
                      <span className="text-xl shrink-0">{opt.emoji}</span>
                      <span className="text-sm font-medium">{opt.text}</span>
                      {selected === opt.id && (
                        <Check className="w-4 h-4 text-[#93bbfd] ml-auto shrink-0" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Result */}
            {step === 4 && chosen && (() => {
              const info = MODE_LABELS[chosen];
              return (
                <motion.div key="result"
                  initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="text-center">
                  <div className="flex justify-center mb-4">
                    <TomiAvatar size={64} mood="excited" />
                  </div>
                  <div
                    className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 border"
                    style={{ background: `${info.color}20`, borderColor: `${info.color}50`, color: info.color }}>
                    {info.emoji} Режим: {info.label}
                  </div>
                  <h3 className="text-white text-lg font-bold mb-2">Отличный выбор!</h3>
                  <p className="text-white/55 text-sm leading-relaxed mb-1">
                    {info.desc}
                  </p>
                  <p className="text-white/35 text-xs mb-6">
                    Ты всегда можешь изменить режим в чате Томи.
                  </p>

                  {/* Quick win callout */}
                  <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-3.5 mb-4 text-left">
                    <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-emerald-300 text-xs font-semibold mb-0.5">Первая победа прямо сейчас</p>
                      <p className="text-emerald-200/70 text-xs">
                        Открой любой план, выполни 1 задачу — получи первые XP и начни стрик! 🔥
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleAccept}
                    className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all touch-manipulation"
                    style={{ background: info.color }}>
                    Поехали с Томи-{info.label}!
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })()}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Helper hook ──────────────────────────────────────────────────────────────
export function useTomiOnboardingQuiz() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show quiz only once, after a short delay (let the app load first)
    const done = (() => { try { return localStorage.getItem(QUIZ_DONE_KEY) === '1'; } catch { return false; } })();
    if (!done) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(QUIZ_DONE_KEY, '1'); } catch {}
    setShow(false);
  };

  return { show, dismiss, setShow };
}
