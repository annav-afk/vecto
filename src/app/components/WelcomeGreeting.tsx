import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { updateOnboarding, getOnboarding } from '../lib/cloudSync';
import { TomiAvatar } from './TomiAssistant';

// ── Helpers ───────────────────────────────────────────────────────────────────
function decodeUsername(email: string | null | undefined): string {
  if (!email) return '';
  const local = email.split('@')[0];
  if (!email.endsWith('@stride.app')) return local;
  try {
    const padded = local.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    return decodeURIComponent(escape(atob(pad ? padded + '='.repeat(4 - pad) : padded)));
  } catch { return local; }
}

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) {
    try {
      const demo = localStorage.getItem('stride_demo_name');
      if (demo) return demo;
    } catch { /* ignore */ }
    return '';
  }
  const meta = user.user_metadata;
  if (meta?.name && typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim();
  return decodeUsername(user.email);
}

function getHour() { return new Date().getHours(); }

function getGreeting(name: string, isFirstTime: boolean): { title: string; sub: string; emoji: string } {
  const h = getHour();
  if (isFirstTime) {
    return {
      title: `Привет, ${name}!`,
      sub: 'Рада видеть тебя в Vecto 🎉 Давай создадим твой первый план!',
      emoji: '🚀',
    };
  }
  if (h >= 5 && h < 12) {
    return {
      title: `Доброе утро, ${name}!`,
      sub: 'Отличный момент, чтобы начать продуктивный день. Готов продолжить?',
      emoji: '☀️',
    };
  }
  if (h >= 12 && h < 18) {
    return {
      title: `Привет, ${name}!`,
      sub: 'Рада, что ты вернулся. Продолжим работу над планами?',
      emoji: '⚡',
    };
  }
  return {
    title: `Добрый вечер, ${name}!`,
    sub: 'Ещё один шаг к цели — и сегодня можно выдохнуть. Готов?',
    emoji: '🌙',
  };
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const lastSeenKey  = (uid: string) => `stride_last_seen_${uid}`;
const firstTimeKey = (uid: string) => `stride_first_time_${uid}`;

// pause threshold: 3 hours
const PAUSE_MS = 3 * 60 * 60 * 1000;

// ── Component ─────────────────────────────────────────────────────────────────
export function WelcomeGreeting() {
  const { user, authLoading } = useAuth();
  const [visible, setVisible]   = useState(false);
  const [greeting, setGreeting] = useState<{ title: string; sub: string; emoji: string } | null>(null);
  const [barWidth, setBarWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const processed = useRef<string | null>(null);

  const AUTO_DISMISS_MS = 4500;

  const dismiss = () => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (barRef.current)   clearInterval(barRef.current);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    if (processed.current === user.id) return;
    processed.current = user.id;

    const uid       = user.id;
    const name      = getDisplayName(user as Parameters<typeof getDisplayName>[0]);
    if (!name) return; // no name yet, skip

    const isFirst   = !localStorage.getItem(firstTimeKey(uid));
    const lastSeen  = Number(localStorage.getItem(lastSeenKey(uid)) || 0);
    const elapsed   = Date.now() - lastSeen;
    const showIt    = isFirst || elapsed > PAUSE_MS;

    // Always update last seen
    localStorage.setItem(lastSeenKey(uid), String(Date.now()));
    if (isFirst) localStorage.setItem(firstTimeKey(uid), '1');

    // Sync to cloud
    try {
      updateOnboarding({
        welcome_first: true,
        welcome_last_seen: Date.now(),
      });
    } catch {}

    if (!showIt) return;

    setGreeting(getGreeting(name, isFirst));
    // small delay so page renders first
    setTimeout(() => {
      setVisible(true);
      setBarWidth(0);

      // progress bar
      const step = 100 / (AUTO_DISMISS_MS / 80);
      barRef.current = setInterval(() => {
        setBarWidth(w => {
          if (w >= 100) { clearInterval(barRef.current!); return 100; }
          return w + step;
        });
      }, 80);

      timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (barRef.current)   clearInterval(barRef.current);
    };
  }, [user, authLoading]);

  return (
    <AnimatePresence>
      {visible && greeting && (
        <>
          {/* Backdrop blur */}
          <motion.div
            key="wb-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Card */}
          <motion.div
            key="wb-card"
            initial={{ opacity: 0, y: 40, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 sm:inset-auto sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-[101] overflow-hidden"
            style={{
              borderRadius: 24,
              bottom: 'max(5%, calc(env(safe-area-inset-bottom) + 1rem))',
              background: 'linear-gradient(145deg, #0d1a36 0%, #060f20 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(29,78,216,0.25), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            {/* Top glow stripe */}
            <div className="h-0.5 w-full"
              style={{ background: 'linear-gradient(90deg, transparent, #1d4ed8, #2563eb, transparent)' }} />

            {/* Content */}
            <div className="px-6 pt-6 pb-5">
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                {/* Animated Tomi */}
                <motion.div
                  animate={{ rotate: [0, -8, 8, -5, 5, 0] }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="shrink-0"
                >
                  <TomiAvatar size={52} />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-white font-bold leading-snug mb-1"
                    style={{ fontSize: '1.2rem', fontFamily: "'Syne', sans-serif" }}
                  >
                    {greeting.emoji} {greeting.title}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-white/60 text-sm leading-relaxed"
                  >
                    {greeting.sub}
                  </motion.p>
                </div>
              </div>

              {/* Stride badge */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between mb-5 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(29,78,216,0.2)' }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#93bbfd]" />
                  <span className="text-[#93bbfd] text-sm font-medium">Vecto AI</span>
                </div>
                <span className="text-white/35 text-xs">готов к работе</span>
              </motion.div>

              {/* Action button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={dismiss}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold text-sm transition-opacity hover:opacity-90 touch-manipulation"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                  boxShadow: '0 6px 24px rgba(29,78,216,0.4)',
                }}
              >
                <Zap className="w-4 h-4" />
                Поехали!
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Auto-dismiss progress bar */}
            <div className="h-0.5 w-full bg-white/5">
              <motion.div
                className="h-full bg-[#1d4ed8]/60"
                style={{ width: `${barWidth}%` }}
                transition={{ duration: 0 }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}