import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Plus, User } from 'lucide-react';
import { playClick, haptic } from '../lib/sounds';
import { bridgeNavigate, ROUTE_CHANGE_EVENT } from '../lib/navigationBridge';

/**
 * Mobile bottom tab bar — iPhone 16 Pro Max optimised.
 * • Full safe-area-inset-bottom support (home indicator)
 * • 44 pt minimum tap targets
 * • Spring layoutId pill indicator
 * • Haptic-style spring animations on press
 * • Full dark mode support
 */

function useIsDark() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function getPathname() { return window.location.pathname; }

function usePathname() {
  const [pathname, setPathname] = useState(getPathname);
  useEffect(() => {
    const onRoute = (e: Event) => {
      const d = (e as CustomEvent<{ pathname: string }>).detail;
      setPathname(d?.pathname ?? getPathname());
    };
    const onPop = () => setPathname(getPathname());
    window.addEventListener(ROUTE_CHANGE_EVENT, onRoute);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(ROUTE_CHANGE_EVENT, onRoute);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
  return pathname;
}

const TABS = [
  { id: 'dashboard', label: 'Планы',   icon: LayoutDashboard, path: '/dashboard' },
  { id: 'new',       label: 'Создать', icon: Plus,             path: '/new',       accent: true },
  { id: 'profile',   label: 'Профиль', icon: User,             path: '/profile' },
] as const;

const SHOW_ON = ['/dashboard', '/profile', '/plan/'];

export function MobileTabBar() {
  const pathname = usePathname();
  const isDark = useIsDark();
  const show = SHOW_ON.some(p => pathname.startsWith(p));
  if (!show) return null;

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    if (path === '/profile')   return pathname === '/profile';
    return pathname.startsWith(path);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="tab-bar"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: isDark ? 'rgba(7,15,30,0.96)' : 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: isDark ? '0.5px solid rgba(29,78,216,0.20)' : '0.5px solid rgba(29,78,216,0.12)',
          boxShadow: isDark
            ? '0 -4px 24px rgba(0,0,0,0.4), 0 -1px 0 rgba(29,78,216,0.15)'
            : '0 -4px 24px rgba(0,0,0,0.07), 0 -1px 0 rgba(29,78,216,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Top separator line with blue glow */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
          style={{ background: isDark
            ? 'linear-gradient(90deg, transparent, #1d4ed830, #1d4ed850, #1d4ed830, transparent)'
            : 'linear-gradient(90deg, transparent, #1d4ed820, #1d4ed840, #1d4ed820, transparent)' }}
        />

        <div className="flex items-center h-[58px] px-3 gap-1">
          {TABS.map(tab => {
            const active = isActive(tab.path);

            /* ── Floating accent button (centre) ── */
            if (tab.accent) {
              return (
                <button
                  key={tab.id}
                  onClick={() => { playClick(); haptic(); bridgeNavigate(tab.path); }}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 touch-manipulation min-h-[44px]"
                >
                  <motion.div
                    whileTap={{ scale: 0.86 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="relative w-[52px] h-[52px] rounded-[18px] flex items-center justify-center -mt-6 shadow-lg"
                    style={{
                      background: 'linear-gradient(145deg, #2563eb, #1d4ed8, #1e40af)',
                      boxShadow: '0 6px 20px rgba(29,78,216,0.5), 0 2px 8px rgba(29,78,216,0.3)',
                    }}
                  >
                    {/* Glass sheen */}
                    <div className="absolute inset-0 rounded-[18px] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </motion.div>
                  <span className="text-[10px] font-semibold text-[#1d4ed8] mt-0.5 leading-none">
                    {tab.label}
                  </span>
                </button>
              );
            }

            /* ── Regular tab ── */
            return (
              <button
                key={tab.id}
                onClick={() => { playClick(); haptic(); bridgeNavigate(tab.path); }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 touch-manipulation min-h-[44px] relative py-1"
              >
                <div className="relative flex items-center justify-center">
                  {/* Active pill background */}
                  {active && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'rgba(29,78,216,0.10)', margin: '-7px -10px' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  {/* Active dot above icon */}
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        layoutId={`dot-${tab.id}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1d4ed8]"
                      />
                    )}
                  </AnimatePresence>
                  <motion.div
                    whileTap={{ scale: 0.82 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  >
                    <tab.icon
                      className="w-[22px] h-[22px] relative"
                      style={{ color: active ? '#1d4ed8' : isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}
                      strokeWidth={active ? 2.5 : 1.8}
                    />
                  </motion.div>
                </div>
                <motion.span
                  className="text-[10px] leading-none font-semibold"
                  animate={{ color: active ? '#1d4ed8' : isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}
                  transition={{ duration: 0.15 }}
                >
                  {tab.label}
                </motion.span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}