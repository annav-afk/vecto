import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from 'next-themes';
import {
  Loader2, Cloud, CloudOff, Square,
  LayoutDashboard, Plus, Sun, Moon,
  UserCircle, User, LogOut, X, Menu, Brain,
} from 'lucide-react';
import { useAuth, SyncStatus } from '../lib/auth';
import { AuthModal } from './AuthModal';
import { SoundToggle, SoundWave } from './SoundWave';
import { playClick } from '../lib/sounds';
import { useTimer, formatElapsed } from '../lib/timerContext';
import { VectoLogo, VECTO_FONT_STYLE } from './VectoLogo';

interface NavbarProps {
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  showNav?: boolean;
}

// ── Sync indicator ────────────────────────────────────────────────────────────
function SyncDot({ status }: { status: SyncStatus }) {
  if (status === 'idle')    return null;
  if (status === 'syncing') return <span title="Синхронизация..."><Loader2 className="w-3 h-3 text-[#1d4ed8] animate-spin" /></span>;
  if (status === 'synced')  return <span title="Синхронизировано"><Cloud className="w-3 h-3 text-[#10b981]" /></span>;
  if (status === 'error')   return <span title="Ошибка синхронизации"><CloudOff className="w-3 h-3 text-amber-500" /></span>;
  return null;
}

// ── Active timer pill (desktop navbar) ───────────────────────────────────────
function TimerPill() {
  const { active, elapsed, stopTimer } = useTimer();
  if (!active) return null;

  return (
    <motion.div
      key="timer-pill"
      initial={{ opacity: 0, scale: 0.85, x: 8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.85, x: 8 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 select-none"
    >
      {/* Pulse dot */}
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />

      {/* Elapsed */}
      <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
        {formatElapsed(elapsed)}
      </span>

      {/* Task name — only on wider screens */}
      <span className="hidden sm:block text-xs text-emerald-600/70 dark:text-emerald-400/60 max-w-[100px] truncate">
        {active.taskTitle}
      </span>

      {/* Stop button */}
      <button
        onClick={() => { playClick(); stopTimer(); }}
        title="Остановить таймер"
        className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shrink-0 ml-0.5"
      >
        <Square className="w-2.5 h-2.5" fill="currentColor" />
      </button>
    </motion.div>
  );
}

// ── Active timer row for the mobile menu ─────────────────────────────────────
function MobileTimerRow() {
  const { active, elapsed, stopTimer } = useTimer();
  if (!active) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-3 mb-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
          {formatElapsed(elapsed)}
        </div>
        <div className="text-xs text-emerald-600/70 dark:text-emerald-400/60 truncate">
          {active.taskTitle}
        </div>
      </div>
      <button
        onClick={() => { playClick(); stopTimer(); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors shrink-0"
      >
        <Square className="w-3 h-3" fill="currentColor" />
        Стоп
      </button>
    </div>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export function Navbar({ leftContent, rightContent, showNav = true }: NavbarProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, syncStatus, signOut } = useAuth();
  const [showAuth, setShowAuth]       = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  const avatarLetter = user?.user_metadata?.name?.[0]?.toUpperCase()
    ?? user?.email?.[0]?.toUpperCase()
    ?? '?';

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Blue accent line — covers status bar area on iOS */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#1e40af] opacity-90"
        style={{ height: 'calc(2px + env(safe-area-inset-top))' }}
      />

      <nav
        className="sticky top-0 z-40 border-b border-[#1d4ed8]/12 dark:border-[#1d4ed8]/10 backdrop-blur-2xl shadow-lg navbar-safe"
        style={{
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 4px 24px rgba(29,78,216,0.07), 0 1px 0 rgba(29,78,216,0.1)',
        }}
      >
        <style>{`.dark nav { background: rgba(6,13,30,0.92) !important; }`}</style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* ── Left ── */}
          <div className="flex items-center gap-3 shrink-0">
            {leftContent ?? (
              <button
                onClick={() => { playClick(); navigate('/'); }}
                className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group"
              >
                <VectoLogo size={32} />
                <span
                  style={VECTO_FONT_STYLE}
                  className="text-slate-900 dark:text-white text-sm"
                >
                  Vecto
                </span>
                <SoundWave bars={5} color="#2563eb" className="opacity-60 group-hover:opacity-100 transition-opacity hidden sm:flex" />
              </button>
            )}
          </div>

          {/* ── Right ── */}
          <div className="flex items-center gap-1.5 min-w-0">
            {rightContent}

            {showNav && (
              <>
                <button
                  onClick={() => { playClick(); navigate('/dashboard'); }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-[#1d4ed8]/8 transition-all text-xs whitespace-nowrap"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Мои планы
                </button>
                <button
                  onClick={() => { playClick(); navigate('/new'); }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs hover:opacity-90 transition-all shadow-sm whitespace-nowrap shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                    boxShadow: '0 2px 10px rgba(29,78,216,0.4)',
                    fontWeight: 600,
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Новый план
                </button>
              </>
            )}

            {/* Sound */}
            <SoundToggle />

            {/* ── Active timer pill — always visible when running ── */}
            <AnimatePresence>
              {<TimerPill />}
            </AnimatePresence>

            {/* Theme */}
            <button
              onClick={() => { playClick(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all shrink-0"
              title="Переключить тему"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Auth */}
            {user ? (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowUserMenu(s => !s)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[#1d4ed8]/15 hover:bg-[#1d4ed8]/5 transition-all"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                      boxShadow: '0 0 8px rgba(29,78,216,0.4)',
                      fontWeight: 700,
                    }}
                  >
                    {avatarLetter}
                  </div>
                  <span className="hidden sm:block text-xs text-slate-700 dark:text-white/70 max-w-20 truncate">{displayName}</span>
                  <SyncDot status={syncStatus} />
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-2 w-56 rounded-2xl z-20 overflow-hidden"
                        style={{
                          background: 'rgba(255,255,255,0.96)',
                          border: '1px solid rgba(29,78,216,0.12)',
                          boxShadow: '0 12px 40px rgba(29,78,216,0.1), 0 4px 16px rgba(0,0,0,0.06)',
                          backdropFilter: 'blur(16px)',
                        }}
                      >
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/8">
                          <div className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 500 }}>
                            {displayName || 'Пользователь'}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-white/40 truncate">{user.email}</div>
                        </div>
                        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/8 flex items-center gap-2">
                          <SyncDot status={syncStatus} />
                          <span className="text-xs text-slate-500 dark:text-white/50">
                            {syncStatus === 'syncing' && 'Синхронизация...'}
                            {syncStatus === 'synced'  && 'Синхронизировано ✓'}
                            {syncStatus === 'error'   && 'Ошибка синхронизации'}
                            {syncStatus === 'idle'    && 'Подключено к облаку'}
                          </span>
                        </div>
                        <button
                          onClick={() => { playClick(); setShowUserMenu(false); navigate('/profile'); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-white/70 hover:bg-[#1d4ed8]/6 hover:text-[#1d4ed8] transition-colors text-left border-b border-slate-100 dark:border-white/8"
                        >
                          <UserCircle className="w-3.5 h-3.5" />
                          Л��чный кабинет
                        </button>
                        <button
                          onClick={() => { playClick(); setShowUserMenu(false); navigate('/tomi-insights'); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-white/70 hover:bg-[#1d4ed8]/6 hover:text-[#1d4ed8] transition-colors text-left border-b border-slate-100 dark:border-white/8"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          Томи знает тебя
                        </button>
                        <button
                          onClick={async () => { playClick(); setShowUserMenu(false); await signOut(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors text-left"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Выйти из аккаунта
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => { playClick(); setShowAuth(true); }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1d4ed8]/20 text-[#1d4ed8] hover:bg-[#1d4ed8]/8 transition-all text-xs"
              >
                <User className="w-3.5 h-3.5" />
                Войти
              </button>
            )}

            {/* Mobile hamburger */}
            {showNav && (
              <button
                onClick={() => { playClick(); setMobileOpen(s => !s); }}
                className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all shrink-0"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile dropdown ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden overflow-hidden border-t border-[#1d4ed8]/10"
              style={{ background: document.documentElement.classList.contains('dark') ? 'rgba(6,13,30,0.97)' : 'rgba(255,255,255,0.97)' }}
            >
              <div className="px-4 py-3 space-y-1">
                {/* Timer — shown at the top if running */}
                <MobileTimerRow />

                {/* User info */}
                {user && (
                  <div className="flex items-center gap-3 px-3 py-3 mb-1 rounded-xl bg-[#1d4ed8]/5 border border-[#1d4ed8]/12">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shrink-0"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', fontWeight: 700 }}
                    >
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900 dark:text-white truncate" style={{ fontWeight: 600 }}>{displayName}</div>
                      <div className="text-xs text-slate-400 dark:text-white/40 truncate">{user.email}</div>
                    </div>
                    <SyncDot status={syncStatus} />
                  </div>
                )}

                <button onClick={() => { playClick(); navigate('/dashboard'); closeMobile(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 dark:text-white/70 hover:bg-[#1d4ed8]/8 hover:text-[#1d4ed8] transition-all text-sm text-left">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  Мои планы
                </button>
                <button onClick={() => { playClick(); navigate('/new'); closeMobile(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white transition-all text-sm text-left shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', fontWeight: 600 }}>
                  <Plus className="w-4 h-4 shrink-0" />
                  Новый план
                </button>

                {user ? (
                  <>
                    <button onClick={() => { playClick(); navigate('/profile'); closeMobile(); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 dark:text-white/70 hover:bg-[#1d4ed8]/8 hover:text-[#1d4ed8] transition-all text-sm text-left">
                      <UserCircle className="w-4 h-4 shrink-0" />
                      Личный кабинет
                    </button>
                    <button onClick={() => { playClick(); navigate('/tomi-insights'); closeMobile(); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 dark:text-white/70 hover:bg-[#1d4ed8]/8 hover:text-[#1d4ed8] transition-all text-sm text-left">
                      <Brain className="w-4 h-4 shrink-0" />
                      Томи знает тебя
                    </button>
                    <button onClick={async () => { playClick(); await signOut(); closeMobile(); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-all text-sm text-left">
                      <LogOut className="w-4 h-4 shrink-0" />
                      Выйти из аккаунта
                    </button>
                  </>
                ) : (
                  <button onClick={() => { playClick(); setShowAuth(true); closeMobile(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-[#1d4ed8]/20 text-[#1d4ed8] hover:bg-[#1d4ed8]/8 transition-all text-sm text-left">
                    <User className="w-4 h-4 shrink-0" />
                    Войти в аккаунт
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </AnimatePresence>
    </>
  );
}