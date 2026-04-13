import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Check, Crown, Sparkles, Target, Star } from 'lucide-react';
import { TIERS, PlanTier, TIER_ORDER } from '../lib/plans';
import { useAuth } from '../lib/auth';

interface PaywallModalProps {
  onClose: () => void;
  reason?: 'limit' | 'feature' | 'export' | 'trial_expired';
  blockedFeature?: string;
}

const REASON_COPY: Record<string, { title: string; desc: string }> = {
  limit:         { title: 'Лимит планов исчерпан',     desc: 'Вы использовали все планы в этом периоде' },
  feature:       { title: 'Функция недоступна',         desc: 'Эта функция доступна на более высоком тарифе' },
  export:        { title: 'Экспорт — тариф Pro',        desc: 'Экспорт в CSV и Google Calendar доступен только на Pro' },
  trial_expired: { title: 'Пробный период завершён',   desc: 'Ваши 3 дня Free-тарифа закончились' },
};

export function PaywallModal({ onClose, reason = 'limit', blockedFeature }: PaywallModalProps) {
  const { tier } = useAuth();

  const copy = REASON_COPY[reason] ?? REASON_COPY.limit;

  // Show upgrade options above current tier
  const tierIdx = TIER_ORDER.indexOf(tier);
  const upgradeTiers = TIER_ORDER.slice(tierIdx + 1);

  const tierIcons: Record<PlanTier, React.ReactNode> = {
    free:   <Zap className="w-5 h-5" />,
    medium: <Target className="w-5 h-5" />,
    pro:    <Star className="w-5 h-5" />,
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl noise-overlay"
          style={{
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.95)',
            boxShadow: '0 32px 80px rgba(29,78,216,0.18)',
          }}
        >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden sheet-handle mb-0" />

          {/* Header */}
          <div className="relative px-6 pt-8 pb-7 text-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)' }}>
            {/* Rings */}
            <div className="absolute inset-0 opacity-15">
              {[80, 140, 200, 270].map(s => (
                <div key={s} className="absolute rounded-full border border-white/40"
                  style={{ width: s, height: s, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              ))}
            </div>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}
                className="text-white text-xl mb-1">{copy.title}</h2>
              <p className="text-white/70 text-sm">{copy.desc}</p>
            </div>
            <button onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current tier */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Ваш тариф</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: `${TIERS[tier].color}0d`, border: `1px solid ${TIERS[tier].color}20` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                style={{ background: TIERS[tier].color }}>
                {tierIcons[tier]}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{TIERS[tier].name}</p>
                <p className="text-xs text-slate-400">{TIERS[tier].plansPerCycle} планов / {TIERS[tier].cycleName}</p>
              </div>
            </div>
          </div>

          {/* Upgrade options */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Повысить тариф</p>
            {upgradeTiers.map(tid => {
              const t = TIERS[tid];
              const isTop = tid === 'pro';
              return (
                <div key={tid}
                  className="relative p-4 rounded-2xl cursor-pointer group transition-all"
                  style={isTop ? {
                    background: `${t.color}0a`,
                    border: `1.5px solid ${t.color}30`,
                    boxShadow: `0 4px 20px ${t.glowColor}`,
                  } : {
                    background: 'rgba(29,78,216,0.04)',
                    border: '1px solid rgba(29,78,216,0.12)',
                  }}
                >
                  {isTop && (
                    <div className="absolute -top-3 right-4 px-3 py-1 rounded-full text-white text-[10px] font-bold"
                      style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` }}>
                      {t.badge}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `${t.color}14`, border: `1px solid ${t.color}20` }}>
                        <div style={{ color: t.color }}>{tierIcons[tid]}</div>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.plansPerCycle} планов / {t.cycleName}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-800 text-lg">{t.price}</p>
                      <p className="text-xs text-slate-400">{t.period}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {t.features.slice(0, 3).map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                        <Check className="w-3 h-3 shrink-0" style={{ color: t.color }} />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="px-6 pb-6 flex flex-col gap-2.5">
            <a
              href="https://t.me/ohh_lessya"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-2xl text-white flex items-center justify-center gap-2 transition-all font-bold"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                boxShadow: '0 8px 24px rgba(29,78,216,0.3)',
                textDecoration: 'none',
              }}
            >
              <Sparkles className="w-4 h-4" />
              Написать администратору
            </a>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-2xl text-slate-400 hover:text-slate-600 text-sm transition-colors">
              Продолжить с текущим тарифом
            </button>
          </div>

          {/* Bottom safe area padding on mobile */}
          <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom)', minHeight: 16 }} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}