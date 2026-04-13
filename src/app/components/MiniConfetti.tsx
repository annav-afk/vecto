import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#1d4ed8', '#2563eb', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
const COUNT = 16;

interface Props {
  active: boolean;
  onComplete?: () => void;
  /** Adjust size — sm = timeline row, md = calendar pill */
  size?: 'sm' | 'md';
}

export function MiniConfetti({ active, onComplete, size = 'sm' }: Props) {
  const radius = size === 'sm' ? 40 : 55;

  const particles = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const speed = radius * (0.5 + Math.random() * 0.6);
      return {
        id: i,
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - 10,
        rot: Math.random() * 540 - 270,
        s: 3 + Math.random() * 4,
        color: COLORS[i % COLORS.length],
        isCircle: i % 3 === 0,
        delay: Math.random() * 0.08,
        dur: 0.55 + Math.random() * 0.35,
      };
    }), [radius]
  );

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => onComplete?.(), 900);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-visible">
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rot, scale: 0.2 }}
              transition={{ duration: p.dur, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                width: p.s,
                height: p.isCircle ? p.s : p.s * 0.55,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? '50%' : 1,
              }}
            />
          ))}
          {/* Green checkmark flash */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.3, 1] }}
            className="absolute w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.25)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <motion.path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="#10b981"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              />
            </svg>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
