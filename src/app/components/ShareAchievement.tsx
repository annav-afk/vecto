/**
 * ShareAchievement — красивая карточка достижений для шеринга.
 * Генерирует визуальную сводку: стрик, задачи, уровень.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, ExternalLink, Flame, Trophy, Target, Zap } from 'lucide-react';
import { TomiAvatar } from './TomiAssistant';
import { computeLocalInsights } from '../lib/patternTracker';
import { getPlans } from '../lib/storage';

interface Props {
  onClose: () => void;
}

export function ShareAchievement({ onClose }: Props) {
  const insights = computeLocalInsights();
  const plans = (() => { try { return getPlans(); } catch { return []; } })();
  const doneTasks = plans.reduce((s, p) => s + p.phases.flatMap(ph => ph.tasks).filter(t => t.status === 'done').length, 0);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const shareText = `🔥 Я держу стрик ${insights.currentStreak} дней в Vecto!\n✅ Выполнено ${doneTasks} задач\n📊 Рекорд: ${insights.longestStreak} дней\n\nПопробуй сам → vecto.app`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const achievements = [
    { icon: Flame,  color: 'text-red-400',     bg: 'bg-red-500/15',     value: `${insights.currentStreak} дней`,    label: 'Текущий стрик' },
    { icon: Trophy, color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  value: `${insights.longestStreak} дней`,    label: 'Рекорд стрика' },
    { icon: Target, color: 'text-blue-400',    bg: 'bg-[#1d4ed8]/15',   value: `${doneTasks}`,                      label: 'Задач выполнено' },
    { icon: Zap,    color: 'text-emerald-400', bg: 'bg-emerald-500/15', value: `${Math.round(insights.avgCompletionsPerDay * 10) / 10 || 0}`, label: 'Задач в день' },
  ];

  return (
    <div className="fixed inset-0 z-[9100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0d1a36 0%, #070f1e 100%)',
          border: '1px solid rgba(29,78,216,0.25)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all z-10">
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="p-5">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">Поделиться достижением</p>

          {/* Preview card */}
          <div
            ref={cardRef}
            className="rounded-2xl overflow-hidden mb-5"
            style={{
              background: 'linear-gradient(135deg, #0f2460 0%, #0a1535 50%, #061024 100%)',
              border: '1px solid rgba(29,78,216,0.4)',
              boxShadow: '0 8px 32px rgba(29,78,216,0.2)',
            }}
          >
            {/* Card glow top */}
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa)' }} />

            <div className="p-4">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <TomiAvatar size={40} mood="excited" />
                <div>
                  <p className="text-white font-bold text-sm">Vecto · AI-планировщик</p>
                  <p className="text-white/40 text-xs">Мои достижения</p>
                </div>
                <div className="ml-auto">
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-8 h-8 rounded-xl bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 flex items-center justify-center"
                  >
                    <span className="text-sm">⚡</span>
                  </motion.div>
                </div>
              </div>

              {/* Big streak number */}
              {insights.currentStreak > 0 && (
                <div className="text-center mb-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <span className="text-5xl font-black text-white leading-none">{insights.currentStreak}</span>
                    <span className="text-xl text-white/60 ml-1">🔥</span>
                  </motion.div>
                  <p className="text-white/50 text-sm mt-1">дней стрика подряд</p>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {achievements.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <motion.div
                      key={a.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`rounded-xl ${a.bg} border border-white/8 p-2.5`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${a.color} mb-1`} />
                      <p className="text-white text-sm font-bold">{a.value}</p>
                      <p className="text-white/40 text-[10px]">{a.label}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/6">
                <p className="text-white/25 text-[10px]">vecto.app</p>
                <p className="text-white/25 text-[10px]">
                  {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Share actions */}
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-sm font-bold touch-manipulation"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 6px 20px rgba(29,78,216,0.35)' }}
            >
              <Share2 className="w-4 h-4" />
              Поделиться
            </motion.button>

            <button
              onClick={handleCopy}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all touch-manipulation"
              style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}` }}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Copy className="w-4 h-4 text-white/50" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            <a
              href="https://t.me/ohh_lessya"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all touch-manipulation"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ExternalLink className="w-4 h-4 text-white/50" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
