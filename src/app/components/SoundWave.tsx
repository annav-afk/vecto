/**
 * SoundWave — visual audio indicator that pulses when a sound plays.
 * Also contains the global sound toggle button for Navbar.
 */
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '../lib/sounds';

// Shared event bus to trigger animation from anywhere
const listeners: Array<() => void> = [];
export function triggerWave() {
  listeners.forEach(fn => fn());
}

interface SoundWaveProps {
  bars?: number;
  color?: string;
  className?: string;
}

export function SoundWave({ bars = 5, color = '#1d4ed8', className = '' }: SoundWaveProps) {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = () => {
      setActive(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActive(false), 700);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  // Heights cycle for the bars (randomish but stable)
  const heights = [0.4, 0.9, 0.6, 1.0, 0.5, 0.75, 0.35].slice(0, bars);

  return (
    <span
      className={`inline-flex items-end gap-[2px] ${className}`}
      style={{ height: 16 }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: 2.5,
            height: active ? `${Math.round(h * 14) + 2}px` : '3px',
            background: color,
            borderRadius: 2,
            transition: active
              ? `height ${0.12 + i * 0.04}s ease ${i * 0.04}s`
              : 'height 0.3s ease',
            opacity: active ? 1 : 0.35,
          }}
        />
      ))}
    </span>
  );
}

// Standalone toggle button for Navbar
export function SoundToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(isSoundEnabled);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) {
      // small feedback ping
      import('../lib/sounds').then(m => m.playPing());
      triggerWave();
    }
  };

  return (
    <button
      onClick={toggle}
      title={on ? 'Звук включён' : 'Звук выключен'}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
        on
          ? 'text-[#1d4ed8] bg-[#1d4ed8]/10 hover:bg-[#1d4ed8]/20'
          : 'text-slate-400 dark:text-white/30 hover:bg-slate-100 dark:hover:bg-white/10'
      } ${className}`}
    >
      {on ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}