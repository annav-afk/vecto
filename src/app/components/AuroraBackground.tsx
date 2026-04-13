import { motion } from 'motion/react';

interface Orb {
  color: string;
  darkColor: string;
  size: number;
  top: string;
  left: string;
  animClass: string;
  delay?: number;
}

const ORB_PRESETS: Record<string, Orb[]> = {
  landing: [
    { color: 'rgba(29,78,216,0.28)',  darkColor: 'rgba(29,78,216,0.35)',  size: 700, top: '-5%',  left: '10%',  animClass: 'aurora-a' },
    { color: 'rgba(37,99,235,0.18)',  darkColor: 'rgba(37,99,235,0.22)',  size: 600, top: '15%',  left: '70%',  animClass: 'aurora-b' },
    { color: 'rgba(16,185,129,0.14)', darkColor: 'rgba(16,185,129,0.18)', size: 500, top: '60%',  left: '80%',  animClass: 'aurora-c' },
    { color: 'rgba(99,102,241,0.14)', darkColor: 'rgba(99,102,241,0.20)', size: 450, top: '65%',  left: '5%',   animClass: 'aurora-a', delay: 4 },
    { color: 'rgba(59,130,246,0.12)', darkColor: 'rgba(59,130,246,0.18)', size: 350, top: '35%',  left: '45%',  animClass: 'aurora-b', delay: 8 },
  ],
  dashboard: [
    { color: 'rgba(29,78,216,0.18)',  darkColor: 'rgba(29,78,216,0.22)',  size: 600, top: '-10%', left: '60%',  animClass: 'aurora-a' },
    { color: 'rgba(16,185,129,0.10)', darkColor: 'rgba(16,185,129,0.14)', size: 400, top: '50%',  left: '-5%',  animClass: 'aurora-b' },
    { color: 'rgba(99,102,241,0.10)', darkColor: 'rgba(99,102,241,0.14)', size: 350, top: '70%',  left: '75%',  animClass: 'aurora-c' },
  ],
  form: [
    { color: 'rgba(29,78,216,0.20)',  darkColor: 'rgba(29,78,216,0.28)',  size: 550, top: '-15%', left: '40%',  animClass: 'aurora-a' },
    { color: 'rgba(37,99,235,0.12)',  darkColor: 'rgba(37,99,235,0.18)',  size: 400, top: '60%',  left: '70%',  animClass: 'aurora-b' },
    { color: 'rgba(16,185,129,0.09)', darkColor: 'rgba(16,185,129,0.12)', size: 300, top: '40%',  left: '-5%',  animClass: 'aurora-c' },
  ],
};

interface Props {
  variant?: keyof typeof ORB_PRESETS;
  className?: string;
}

export function AuroraBackground({ variant = 'dashboard', className = '' }: Props) {
  const orbs = ORB_PRESETS[variant] ?? ORB_PRESETS.dashboard;

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}>
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={`aurora-blob ${orb.animClass}`}
          style={{
            width:  orb.size,
            height: orb.size,
            top:    orb.top,
            left:   orb.left,
            background: `radial-gradient(circle at 40% 40%, ${orb.color} 0%, transparent 68%)`,
            animationDelay: `${orb.delay ?? 0}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Floating decorative badge — use for ambient UI elements */
export function FloatingBadge({
  children, delay = 0, className = '',
}: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className={`float-anim-slow ${className}`}
      style={{ animationDelay: `${delay * 0.5}s` }}
    >
      {children}
    </motion.div>
  );
}
