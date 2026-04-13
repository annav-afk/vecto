/**
 * UpgradeTrigger — "Ты перерос Free" баннер.
 * Показывается когда пользователь активен 3+ дней подряд на Free тарифе.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, TrendingUp, Star, ArrowRight } from 'lucide-react';
import { TomiAvatar } from './TomiAssistant';
import { computeLocalInsights } from '../lib/patternTracker';

const UPGRADE_DISMISSED_KEY = 'stride_upgrade_trigger_dismissed';
const UPGRADE_COOLDOWN = 3 * 24 * 60 * 60 * 1000; // 3 дня

export function shouldShowUpgradeTrigger(tier: string): boolean {
  if (tier !== 'free') return false;
  try {
    const dismissed = localStorage.getItem(UPGRADE_DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < UPGRADE_COOLDOWN) return false;
    const insights = computeLocalInsights();
    return insights.currentStreak >= 3;
  } catch {
    return false;
  }
}

interface Props {
  onClose: () => void;
}

export function UpgradeTrigger({ onClose }: Props) {
  const insights = computeLocalInsights();

  const handleDismiss = () => {
    try { localStorage.setItem(UPGRADE_DISMISSED_KEY, String(Date.now())); } catch {}
    onClose();
  };

  const perks = [
    { icon: '∞', text: 'Безлимитные планы' },
    { icon: '🧠', text: 'AI-анализ паттернов' },
    { icon: '📊', text: 'Расширенная аналитика' },
    { icon: '⚡', text: 'Приоритетная поддержка' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="fixed bottom-0 left-0 right-0 z-[9000] sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
    >
      <div
        className="rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0d1a36 0%, #070f1e 100%)',
          border: '1px solid rgba(29,78,216,0.3)',
          boxShadow: '0 24px 80px rgba(29,78,216,0.25), 0 0 0 1px rgba(29,78,216,0.1)',
        }}
      >
        {/* Top gradient line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #1d4ed8, #3b82f6, #1d4ed8)' }} />

        <div className="p-5">
          {/* Close */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Tomi + text */}
          <div className="flex items-start gap-3 mb-4">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <TomiAvatar size={48} mood="excited" />
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-emerald-400"
                />
                <span className="text-emerald-400 text-[11px] font-semibold">Томи заметил</span>
              </div>
              <h3 className="text-white text-sm font-bold leading-tight">
                Ты перерос Free! 🎉
              </h3>
              <p className="text-white/50 text-xs mt-0.5 leading-relaxed">
                {insights.currentStreak} дней подряд — ты явно серьёзно настроен.
                На Pro ты сделаешь в 2× больше!
              </p>
            </div>
          </div>

          {/* Stats highlight */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-xl bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 p-2.5 text-center">
              <p className="text-white text-base font-bold">{insights.currentStreak}</p>
              <p className="text-white/40 text-[10px]">дней стрик 🔥</p>
            </div>
            <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
              <p className="text-emerald-300 text-base font-bold">
                {Math.round(insights.avgCompletionsPerDay * 10) / 10 || '—'}
              </p>
              <p className="text-white/40 text-[10px]">задач/день</p>
            </div>
            <div className="flex-1 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
              <p className="text-amber-300 text-base font-bold">{insights.longestStreak}</p>
              <p className="text-white/40 text-[10px]">рекорд дней</p>
            </div>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {perks.map((p, i) => (
              <motion.div
                key={p.text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/4 border border-white/8"
              >
                <span className="text-base leading-none">{p.icon}</span>
                <span className="text-white/60 text-[11px] font-medium">{p.text}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.a
            href="https://t.me/ohh_lessya"
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.97 }}
            onClick={handleDismiss}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white text-sm font-bold touch-manipulation"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
              boxShadow: '0 8px 28px rgba(29,78,216,0.4)',
            }}
          >
            <Zap className="w-4 h-4" />
            Повысить тариф
            <ArrowRight className="w-4 h-4" />
          </motion.a>

          <button
            onClick={handleDismiss}
            className="w-full mt-2 py-2 text-white/25 text-xs hover:text-white/50 transition-colors"
          >
            Напомни позже
          </button>
        </div>
      </div>
    </motion.div>
  );
}