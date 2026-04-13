import { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Play } from 'lucide-react';
import { TaskStatus } from '../lib/types';
import { haptic } from '../lib/sounds';

const STATUS_OPTIONS: { status: TaskStatus; label: string; Icon: typeof Circle; color: string }[] = [
  { status: 'todo',        label: 'К выполнению', Icon: Circle,       color: '#94a3b8' },
  { status: 'in_progress', label: 'В работе',     Icon: Play,         color: '#1d4ed8' },
  { status: 'done',        label: 'Готово',        Icon: CheckCircle2, color: '#10b981' },
];

interface Props {
  visible: boolean;
  currentStatus: TaskStatus;
  onSelect: (status: TaskStatus) => void;
  onClose: () => void;
  /** Alignment relative to the trigger — left (default) or right */
  align?: 'left' | 'right';
}

export function StatusPickerMenu({ visible, currentStatus, onSelect, onClose, align = 'left' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 4 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="absolute z-50 rounded-xl overflow-hidden shadow-2xl"
          style={{
            top: '100%',
            [align === 'right' ? 'right' : 'left']: 0,
            marginTop: 6,
            background: 'rgba(10,10,26,0.96)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            minWidth: 150,
          }}
        >
          <div className="py-1">
            {STATUS_OPTIONS.map(opt => {
              const isActive = opt.status === currentStatus;
              return (
                <button
                  key={opt.status}
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic(opt.status === 'done' ? 'success' : 'light');
                    onSelect(opt.status);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-white/10"
                  style={{ opacity: isActive ? 1 : 0.7 }}
                >
                  <opt.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: opt.color }} />
                  <span className="text-xs text-white" style={{ fontWeight: isActive ? 700 : 400 }}>
                    {opt.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="status-check"
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: opt.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Hook: useLongPress ──────────────────────────────────────────────── */
export function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Prevent context menu on mobile
    e.preventDefault();
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      haptic('medium');
      callback();
    }, ms);
  }, [callback, ms]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const wasLongPress = useCallback(() => didLongPress.current, []);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    wasLongPress,
  };
}
