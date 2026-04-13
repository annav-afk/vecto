import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MousePointerClick, CheckSquare, X, type LucideIcon } from 'lucide-react';
import { updateOnboarding } from '../lib/cloudSync';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function useIsTouchDevice() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);
}

/* ── Generic FeatureHint ─────────────────────────────────────────────────── */
interface FeatureHintProps {
  /** Unique key in localStorage — once dismissed, never shows again */
  storageKey: string;
  /** Lucide icon component */
  Icon: LucideIcon;
  /** Primary text */
  title: string;
  /** Secondary text */
  subtitle: string;
  /** Show delay (ms) after mount, default 1200 */
  delay?: number;
  /** Auto-dismiss (ms), default 8000 */
  autoDismiss?: number;
  /** Arrow position: 'top-left' (default), 'top-right', 'bottom-left', 'none' */
  arrowPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'none';
  /** Optional gradient colors */
  gradient?: [string, string];
}

export function FeatureHint({
  storageKey,
  Icon,
  title,
  subtitle,
  delay = 1200,
  autoDismiss = 8000,
  arrowPosition = 'top-left',
  gradient = ['#1d4ed8', '#2563eb'],
}: FeatureHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(storageKey)) return; } catch { return; }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [storageKey, delay]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => dismiss(), autoDismiss);
    return () => clearTimeout(t);
  }, [visible, autoDismiss]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(storageKey, '1'); } catch {}
    // Sync hint flag to cloud (map localStorage key to onboarding field)
    try {
      if (storageKey === 'stride_longpress_hint_seen') updateOnboarding({ longpress_hint: true });
      else if (storageKey === 'stride_bulk_select_hint_seen') updateOnboarding({ bulk_select_hint: true });
    } catch {}
  }, [storageKey]);

  const arrowStyles: Record<string, React.CSSProperties> = {
    'top-left': {
      position: 'absolute', top: -6, left: 16,
      width: 12, height: 12, transform: 'rotate(45deg)',
      background: gradient[0],
      borderTop: '1px solid rgba(255,255,255,0.2)',
      borderLeft: '1px solid rgba(255,255,255,0.2)',
    },
    'top-right': {
      position: 'absolute', top: -6, right: 16,
      width: 12, height: 12, transform: 'rotate(45deg)',
      background: gradient[0],
      borderTop: '1px solid rgba(255,255,255,0.2)',
      borderLeft: '1px solid rgba(255,255,255,0.2)',
    },
    'bottom-left': {
      position: 'absolute', bottom: -6, left: 16,
      width: 12, height: 12, transform: 'rotate(225deg)',
      background: gradient[1],
      borderTop: '1px solid rgba(255,255,255,0.2)',
      borderLeft: '1px solid rgba(255,255,255,0.2)',
    },
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          onClick={dismiss}
          className="absolute z-50 cursor-pointer select-none"
          style={{ top: '100%', left: 0, marginTop: 8 }}
        >
          <div
            className="relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-xl"
            style={{
              background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
              border: '1px solid rgba(255,255,255,0.2)',
              maxWidth: 280,
            }}
          >
            {/* Arrow */}
            {arrowPosition !== 'none' && <div style={arrowStyles[arrowPosition]} />}

            {/* Animated icon */}
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="shrink-0"
            >
              <Icon className="w-4 h-4 text-white/90" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white leading-snug" style={{ fontWeight: 600 }}>
                {title}
              </p>
              <p className="text-[10px] text-white/60 leading-snug mt-0.5">
                {subtitle}
              </p>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <X className="w-3 h-3 text-white/50" />
            </button>

            {/* Shimmer */}
            <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden" style={{ opacity: 0.15 }}>
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                  animation: 'shimmer-slide 3s linear infinite',
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Preset: Long-press / right-click hint for status icons ──────────── */
export function LongPressHint() {
  const isTouch = useIsTouchDevice();

  return (
    <FeatureHint
      storageKey="stride_longpress_hint_seen"
      Icon={MousePointerClick}
      title={isTouch ? 'Удержи иконку статуса' : 'Правый клик по иконке статуса'}
      subtitle={
        isTouch
          ? 'чтобы выбрать нужный статус из меню'
          : 'или удержание — откроет меню выбора статуса'
      }
    />
  );
}

/* ── Preset: Bulk select hint for Kanban ─────────────────────────────── */
export function BulkSelectHint() {
  const isTouch = useIsTouchDevice();

  return (
    <FeatureHint
      storageKey="stride_bulk_select_hint_seen"
      Icon={CheckSquare}
      title={isTouch ? 'Нажми на чекбокс карточки' : 'Кликни на чекбокс в углу карточки'}
      subtitle="для массового выбора задач и групповых действий"
      delay={2000}
      gradient={['#1e40af', '#1d4ed8']}
    />
  );
}