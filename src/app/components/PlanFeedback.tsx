/**
 * PlanFeedback — кнопки 👍👎 после просмотра плана / AI-сессии.
 * Томи учится на предпочтениях пользователя.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';
import { TomiAvatar, useTomi } from './TomiAssistant';
import { savePlanFeedbackCloud } from '../lib/api';
import { useAuth } from '../lib/auth';

const FEEDBACK_KEY = 'stride_plan_feedback';

interface FeedbackEntry {
  planId: string;
  vote: 'up' | 'down';
  comment?: string;
  ts: number;
}

export function savePlanFeedback(planId: string, vote: 'up' | 'down', comment?: string) {
  try {
    const existing: FeedbackEntry[] = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
    const filtered = existing.filter(e => e.planId !== planId);
    filtered.push({ planId, vote, comment, ts: Date.now() });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(filtered.slice(-200)));
  } catch {}
}

export function getPlanFeedback(planId: string): 'up' | 'down' | null {
  try {
    const existing: FeedbackEntry[] = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
    return existing.find(e => e.planId === planId)?.vote ?? null;
  } catch {
    return null;
  }
}

interface Props {
  planId: string;
  planGoal: string;
  onFeedback?: (vote: 'up' | 'down') => void;
}

export function PlanFeedback({ planId, planGoal, onFeedback }: Props) {
  const { token } = useAuth();
  const { openTomiWithSeed } = useTomi();
  const [vote, setVote] = useState<'up' | 'down' | null>(() => getPlanFeedback(planId));
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const DOWN_SUGGESTIONS = [
    'Слишком много задач',
    'Нереалистичные сроки',
    'Задачи не по теме',
    'Хочу другой подход',
  ];

  function handleVote(v: 'up' | 'down') {
    if (vote === v) return;
    const isFirstVote = vote === null;
    setVote(v);
    savePlanFeedback(planId, v);
    onFeedback?.(v);
    // Save to cloud immediately
    if (token) {
      savePlanFeedbackCloud(planId, v, token, undefined, planGoal).catch(console.warn);
    }
    if (v === 'down') {
      setTimeout(() => setShowComment(true), 200);
      // Томи инициирует диалог только на первый голос «не понравилось»
      if (isFirstVote) {
        const goalShort = planGoal.length > 44 ? planGoal.slice(0, 44) + '…' : planGoal;
        setTimeout(() => {
          openTomiWithSeed(
            `Вижу, план «${goalShort}» не совсем попал в точку 🤔\n\n` +
            `Я могу помочь: пересоставить план с нуля, убрать лишние задачи или скорректировать сроки.\n` +
            `Напиши, что именно не понравилось — и я сразу это исправлю!`
          );
        }, 1800);
      }
    } else {
      setShowComment(false);
    }
  }

  function handleSubmitComment() {
    if (!vote) return;
    savePlanFeedback(planId, vote, comment || undefined);
    // Save to cloud with comment
    if (token) {
      savePlanFeedbackCloud(planId, vote, token, comment || undefined, planGoal).catch(console.warn);
    }
    setSubmitted(true);
    setShowComment(false);
  }

  return (
    <div className="mt-4">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
          >
            <TomiAvatar size={24} mood="happy" />
            <p className="text-emerald-300 text-xs font-medium">
              Спасибо! Томи запомнит твои предпочтения 🎯
            </p>
          </motion.div>
        ) : (
          <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Vote row */}
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs font-medium">Насколько точен план?</span>
              <div className="flex items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleVote('up')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all touch-manipulation ${
                    vote === 'up'
                      ? 'bg-emerald-500/20 border border-emerald-500/35 text-emerald-400'
                      : 'bg-white/5 border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/8'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleVote('down')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all touch-manipulation ${
                    vote === 'down'
                      ? 'bg-red-500/20 border border-red-500/35 text-red-400'
                      : 'bg-white/5 border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/8'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                </motion.button>
              </div>
              {vote === 'up' && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-emerald-400 text-xs font-medium"
                >
                  Отлично! 🎉
                </motion.span>
              )}
            </div>

            {/* Comment panel for down vote */}
            <AnimatePresence>
              {showComment && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-2xl bg-white/4 border border-white/10 p-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <TomiAvatar size={24} mood="focused" />
                      <p className="text-white/60 text-xs">
                        Что можно улучшить? Помоги Томи стать лучше
                      </p>
                      <button onClick={() => setShowComment(false)} className="ml-auto text-white/20 hover:text-white/50 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick tags */}
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {DOWN_SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => setComment(c => c ? `${c}, ${s}` : s)}
                          className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/45 text-[11px] hover:bg-[#1d4ed8]/15 hover:border-[#1d4ed8]/30 hover:text-white/70 transition-all touch-manipulation"
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Text input */}
                    <div className="flex items-center gap-2">
                      <input
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Или напиши своё…"
                        className="flex-1 bg-transparent text-white/70 text-xs placeholder-white/20 outline-none border-none"
                        onKeyDown={e => e.key === 'Enter' && handleSubmitComment()}
                      />
                      <button
                        onClick={handleSubmitComment}
                        className="w-7 h-7 rounded-lg bg-[#1d4ed8]/20 flex items-center justify-center text-[#93bbfd] hover:bg-[#1d4ed8]/30 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
