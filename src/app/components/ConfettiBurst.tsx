import { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#1d4ed8', '#2563eb', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#1e40af'];
const COUNT = 48;

interface Props {
  active: boolean;
  onComplete?: () => void;
}

export function ConfettiBurst({ active, onComplete }: Props) {
  const particles = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 80 + Math.random() * 120;
      return {
        id: i,
        x: Math.cos(angle) * speed * (0.5 + Math.random()),
        y: Math.sin(angle) * speed * (0.5 + Math.random()) - 60,
        rot: Math.random() * 720 - 360,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        isCircle: i % 3 === 0,
        delay: Math.random() * 0.15,
        duration: 0.9 + Math.random() * 0.6,
      };
    }), []
  );

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => onComplete?.(), 1800);
    return () => clearTimeout(timer);
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden flex items-center justify-center">
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{
                x: p.x,
                y: p.y,
                opacity: 0,
                rotate: p.rot,
                scale: 0.3,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.isCircle ? p.size : p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? '50%' : 2,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}