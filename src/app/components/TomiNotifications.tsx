/**
 * TomiNotifications — регистрирует SW, запрашивает разрешение
 * и периодически запускает проверки Томи.
 *
 * Рендерит только маленькую кнопку-бейдж (если уведомления не активны),
 * скрывается когда всё настроено. Компонент монтируется в RootLayout.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import {
  registerSW,
  requestPermission,
  runTomiCheck,
  maybeSendMorningBriefing,
  isNotifEnabled,
  setNotifEnabled,
  notifSupported,
  notifPermission,
  NOTIF_ENABLED_KEY,
} from '../lib/notifications';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min

export function TomiNotifications() {
  const [enabled, setEnabled]         = useState<boolean>(false);
  const [permission, setPermission]   = useState<NotificationPermission>('default');
  const [showBanner, setShowBanner]   = useState(false);
  const [loading, setLoading]         = useState(false);

  // Sync state on mount
  useEffect(() => {
    if (!notifSupported()) return;
    setPermission(notifPermission());
    setEnabled(isNotifEnabled());

    // Show invite banner after 30s if not yet decided
    if (notifPermission() === 'default') {
      const t = setTimeout(() => setShowBanner(true), 30_000);
      return () => clearTimeout(t);
    }
  }, []);

  // Register SW on mount
  useEffect(() => {
    registerSW();
  }, []);

  // Periodic checks
  useEffect(() => {
    if (!enabled) return;
    const check = async () => {
      await runTomiCheck();
      await maybeSendMorningBriefing();
    };
    check(); // immediate
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    const granted = await requestPermission();
    setLoading(false);
    if (granted) {
      setNotifEnabled(true);
      setEnabled(true);
      setPermission('granted');
      setShowBanner(false);
    } else {
      setPermission(notifPermission());
    }
  }, []);

  const handleDisable = useCallback(() => {
    setNotifEnabled(false);
    setEnabled(false);
    localStorage.removeItem(NOTIF_ENABLED_KEY);
  }, []);

  if (!notifSupported()) return null;

  return (
    <>
      {/* ── Invite banner ── */}
      <AnimatePresence>
        {showBanner && permission === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[calc(100vw-32px)] max-w-sm"
          >
            <div className="bg-white dark:bg-[#0e1a35] border border-[#1d4ed8]/20 dark:border-[#1d4ed8]/30 rounded-2xl shadow-2xl p-4">
              <button
                onClick={() => setShowBanner(false)}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center shrink-0 shadow-lg shadow-[#1d4ed8]/30">
                  <BellRing className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Томи напомнит о задачах
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5 leading-relaxed">
                    Включи уведомления — Томи будет сообщать о дедлайнах и просроченных задачах.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleEnable}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1d4ed8] text-white text-xs font-semibold hover:bg-[#1e40af] transition-colors disabled:opacity-60 shadow-sm shadow-[#1d4ed8]/25"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {loading ? 'Запрос...' : 'Включить'}
                    </button>
                    <button
                      onClick={() => setShowBanner(false)}
                      className="px-3 py-1.5 rounded-xl text-slate-500 dark:text-white/40 text-xs hover:bg-slate-100 dark:hover:bg-white/8 transition-colors"
                    >
                      Не сейчас
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Small toggle button (embeds into Navbar / Settings) ───────────────────────
interface NotifToggleProps {
  className?: string;
}

export function NotifToggle({ className = '' }: NotifToggleProps) {
  const [enabled, setEnabled]       = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!notifSupported()) return;
    setEnabled(isNotifEnabled());
    setPermission(notifPermission());
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      setNotifEnabled(false);
      setEnabled(false);
      return;
    }
    setLoading(true);
    const granted = await requestPermission();
    setLoading(false);
    if (granted) {
      setNotifEnabled(true);
      setEnabled(true);
      setPermission('granted');
    } else {
      setPermission(notifPermission());
    }
  }, [enabled]);

  if (!notifSupported()) return null;

  const denied = permission === 'denied';
  const title = denied
    ? 'Уведомления заблокированы браузером'
    : enabled
    ? 'Уведомления Томи включены'
    : 'Включить уведомления Томи';

  return (
    <button
      onClick={denied ? undefined : toggle}
      disabled={loading || denied}
      title={title}
      className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
        enabled
          ? 'text-[#1d4ed8] bg-[#1d4ed8]/10 hover:bg-[#1d4ed8]/20'
          : denied
          ? 'text-slate-300 dark:text-white/15 cursor-not-allowed'
          : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/8'
      } ${className}`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : denied ? (
        <BellOff className="w-4 h-4" />
      ) : enabled ? (
        <>
          <BellRing className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#1d4ed8] animate-pulse" />
        </>
      ) : (
        <Bell className="w-4 h-4" />
      )}
    </button>
  );
}
