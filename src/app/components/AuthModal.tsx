import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Lock, User, Eye, EyeOff, Zap, Loader2,
  AlertCircle, CheckCircle2, AtSign, KeyRound, UserPlus,
  LogIn, ShieldCheck, BookUser, Shield, ArrowRight, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { signUpCloud } from '../lib/api';
import { playClick, playComplete, playError } from '../lib/sounds';

// ── Helpers ───────────────────────────────────────────────────────────────────

function usernameToEmail(username: string): string {
  try {
    const encoded = btoa(unescape(encodeURIComponent(username.trim().toLowerCase())))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `${encoded}@stride.app`;
  } catch {
    const safe = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${safe || 'user'}@stride.app`;
  }
}

const REMEMBER_KEY = 'stride_saved_creds';

function saveCreds(username: string, password: string) {
  try {
    const data = btoa(JSON.stringify({ u: username, p: password }));
    localStorage.setItem(REMEMBER_KEY, data);
  } catch { /* ignore */ }
}

function clearCreds() {
  localStorage.removeItem(REMEMBER_KEY);
}

function loadCreds(): { username: string; password: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const { u, p } = JSON.parse(atob(raw));
    return { username: u, password: p };
  } catch {
    return null;
  }
}

// ── Benefits sidebar ──────────────────────────────────────────────────────────
const BENEFITS = [
  'Вход без email — только имя и пароль',
  'Синхронизация между устройствами',
  'Резервное копирование в облако',
  'История всех ваших планов',
];

// ── Password strength ─────────────────────────────────────────────────────────
function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) || /[А-Я]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Zа-яА-Я0-9]/.test(pwd)) score++;
  const levels = [
    { label: 'Очень слабый', color: '#ef4444' },
    { label: 'Слабый',       color: '#f97316' },
    { label: 'Средний',      color: '#eab308' },
    { label: 'Хороший',      color: '#22c55e' },
    { label: 'Отличный',     color: '#10b981' },
  ];
  return { score, ...levels[Math.min(score, 4)] };
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'signin' | 'signup' | 'demo' | 'admin';

// ── Sidebar left panel content per tab ───────────────────────────────────────
const SIDEBAR_CONTENT: Record<Tab, { title: string; subtitle: string }> = {
  signin: {
    title: 'С возвращением!',
    subtitle: 'Войдите по имени пользователя и паролю. Ваши планы ждут вас.',
  },
  signup: {
    title: 'Создайте аккаунт',
    subtitle: 'Придумайте логин и пароль — и начните планировать без ограничений.',
  },
  demo: {
    title: 'Попробуй Vecto',
    subtitle: 'Введи своё имя — и начни планировать прямо сейчас. Без регистрации и пароля.',
  },
  admin: {
    title: 'Панель управления',
    subtitle: 'Доступ ограничен. Для входа потребуется PIN-код администратора.',
  },
};

// ── Main Modal ────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  defaultTab?: Tab;
}

export function AuthModal({ onClose, defaultTab = 'signin' }: Props) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(defaultTab);

  // Form fields
  const [username, setUsername]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [remember, setRemember]       = useState(false);
  const [demoName, setDemoName]       = useState('');

  // UI state
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadCreds();
    if (saved) {
      setUsername(saved.username);
      setPassword(saved.password);
      setRemember(true);
    } else {
      setTimeout(() => usernameRef.current?.focus(), 200);
    }
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPwd('');
    if (t !== 'admin') setTimeout(() => usernameRef.current?.focus(), 100);
  };

  const pwdStrength = tab === 'signup' && password ? passwordStrength(password) : null;

  const validate = (): string | null => {
    if (!username.trim()) return 'Введите имя пользователя';
    if (username.trim().length < 2) return 'Имя пользователя слишком короткое';
    if (!password) return 'Введите пароль';
    if (password.length < 6) return 'Пароль должен быть не менее 6 символов';
    if (tab === 'signup') {
      if (password !== confirmPwd) return 'Пароли не совпадают';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) { setError(validationError); playError(); return; }

    setLoading(true);
    const email = usernameToEmail(username.trim());
    const name  = displayName.trim() || username.trim();

    try {
      if (tab === 'signup') {
        await signUpCloud(email, password, name);
        await signIn(email, password);
        if (remember) saveCreds(username.trim(), password);
        else clearCreds();
        playComplete();
        onClose();
      } else {
        await signIn(email, password);
        if (remember) saveCreds(username.trim(), password);
        else clearCreds();
        playComplete();
        onClose();
      }
    } catch (err: any) {
      const msg: string = err?.message ?? 'Неизвестная ошибка';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Неверное имя пользователя или пароль');
      } else if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Это имя пользователя уже занято. Войдите или выберите другое.');
      } else if (msg.includes('User not found')) {
        setError('Пользователь не найден. Зарегистрируйтесь.');
      } else {
        setError(msg);
      }
      playError();
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const name = demoName.trim() || 'Гость';
    try { localStorage.setItem('stride_demo_name', name); } catch { /* ignore */ }
    playComplete();
    onClose();
    navigate('/dashboard');
  };

  const inputCls = `
    w-full bg-white dark:bg-white/6 border border-slate-200 dark:border-white/10
    rounded-xl px-4 py-3 text-slate-900 dark:text-white
    placeholder-slate-400 dark:placeholder-white/25 text-sm
    focus:outline-none focus:border-[#1d4ed8]/50 focus:ring-2 focus:ring-[#1d4ed8]/12
    transition-all
  `;

  const sidebarContent = SIDEBAR_CONTENT[tab];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-[780px] flex flex-col sm:flex-row rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto"
        style={{ fontFamily: "'Inter', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden sheet-handle" />

        {/* ── Left decorative panel ── */}
        <div
          className="hidden md:flex flex-col justify-between w-72 shrink-0 p-8"
          style={{
            background: tab === 'admin'
              ? 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #1e3a8a 100%)'
              : 'linear-gradient(160deg, #1d4ed8 0%, #1e3a8a 60%, #0f2460 100%)',
            transition: 'background 0.4s ease',
          }}
        >
          {/* Logo */}
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              >
                {tab === 'admin'
                  ? <Shield className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                  : <Zap className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                }
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.1rem' }} className="text-white">
                {tab === 'admin' ? 'Vecto Admin' : 'Vecto'}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h2
                  style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.45rem', lineHeight: 1.2 }}
                  className="text-white mb-3"
                >
                  {sidebarContent.title}
                </h2>
                <p className="text-blue-200/80 text-sm leading-relaxed mb-8">
                  {sidebarContent.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Benefits / admin note */}
            {tab !== 'admin' ? (
              <div className="space-y-3">
                {BENEFITS.map((b, i) => (
                  <motion.div
                    key={b}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.06 }}
                    className="flex items-center gap-3 text-sm text-blue-100/85"
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.18)' }}>
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {b}
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                {['Управление пользователями', 'Статистика платформы', 'Удаление аккаунтов', 'Мониторинг активности'].map((item, i) => (
                  <div key={item}
                    className="flex items-center gap-3 text-sm"
                    style={{ color: 'rgba(165,180,252,0.8)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <Shield className="w-2.5 h-2.5 text-white" />
                    </div>
                    {item}
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Bottom badge */}
          <div
            className="mt-6 px-4 py-3 rounded-2xl text-xs text-blue-200/70"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ShieldCheck className="w-4 h-4 text-blue-300 mb-1.5" />
            {tab === 'admin'
              ? 'Вход только для авторизованных администраторов'
              : 'Ваши данные защищены и хранятся в зашифрованном виде'}
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 bg-white dark:bg-[#0d1627] flex flex-col p-5 sm:p-8">
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center mb-3 -mt-1">
            <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-white/15" />
          </div>

          {/* Header row: logo (mobile) + close */}
          <div className="flex items-center justify-between mb-5">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: tab === 'admin' ? 'linear-gradient(135deg, #1e1b4b, #1e3a8a)' : 'linear-gradient(135deg, #1d4ed8, #1e40af)' }}>
                {tab === 'admin'
                  ? <Shield className="w-3.5 h-3.5 text-white" />
                  : <Zap className="w-3.5 h-3.5 text-white" />
                }
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.02em' }} className="text-slate-900 dark:text-white text-sm">
                {tab === 'admin' ? 'Vecto Admin' : 'Vecto'}
              </span>
            </div>
            <div className="hidden md:block" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 dark:text-white/35 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Tab switcher: 3 tabs ── */}
          <div className="flex bg-slate-100 dark:bg-white/7 rounded-xl p-1 gap-1 mb-6">
            {/* Войти */}
            <button
              onClick={() => { playClick(); switchTab('signin'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-all ${
                tab === 'signin'
                  ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70'
              }`}
              style={{ fontWeight: tab === 'signin' ? 600 : 400 }}
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              Войти
            </button>

            {/* Регистрация */}
            <button
              onClick={() => { playClick(); switchTab('signup'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-all ${
                tab === 'signup'
                  ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70'
              }`}
              style={{ fontWeight: tab === 'signup' ? 600 : 400 }}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Регистрация</span>
              <span className="sm:hidden">Рег.</span>
            </button>

            {/* Демо */}
            <button
              onClick={() => { playClick(); switchTab('demo'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-all ${
                tab === 'demo'
                  ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70'
              }`}
              style={{ fontWeight: tab === 'demo' ? 600 : 400 }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Демо
            </button>

            {/* Админ */}
            <button
              onClick={() => { playClick(); switchTab('admin'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-all ${
                tab === 'admin'
                  ? 'shadow-sm text-white'
                  : 'text-slate-400 dark:text-white/35 hover:text-slate-600 dark:hover:text-white/60'
              }`}
              style={{
                fontWeight: tab === 'admin' ? 600 : 400,
                background: tab === 'admin'
                  ? 'linear-gradient(135deg, #1e1b4b, #1e3a8a)'
                  : 'transparent',
              }}
            >
              <Shield className="w-3.5 h-3.5 shrink-0" />
              Админ
            </button>
          </div>

          {/* ── Panel content with animation ── */}
          <AnimatePresence mode="wait">

            {/* ── Demo panel ── */}
            {tab === 'demo' && (
              <motion.div
                key="demo"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5 flex-1"
              >
                {/* Icon + header */}
                <div className="flex flex-col items-center text-center py-3">
                  <motion.div
                    animate={{ boxShadow: ['0 0 20px rgba(29,78,216,0.35)', '0 0 36px rgba(29,78,216,0.6)', '0 0 20px rgba(29,78,216,0.35)'] }}
                    transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent" />
                  </motion.div>
                  <h3
                    style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}
                    className="text-slate-900 dark:text-white mb-1.5"
                  >
                    Демо-режим
                  </h3>
                  <p className="text-slate-500 dark:text-white/45 text-sm leading-relaxed max-w-xs">
                    Просто введи имя — и начни пользоваться Vecto прямо сейчас.<br />
                    Никакой регистрации и паролей.
                  </p>
                </div>

                {/* What you get */}
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(29,78,216,0.06), rgba(37,99,235,0.04))',
                    border: '1px solid rgba(29,78,216,0.14)',
                  }}
                >
                  {[
                    { ok: true,  label: 'До 3 планов бесплатно' },
                    { ok: true,  label: 'AI-генерация за секунды' },
                    { ok: true,  label: 'Всё хранится на вашем устройстве' },
                    { ok: false, label: 'Нет облачной синхронизации' },
                    { ok: false, label: 'Нет доступа с других устройств' },
                  ].map(({ ok, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-sm">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: ok ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.12)' }}
                      >
                        <svg className={`w-2.5 h-2.5 ${ok ? 'text-emerald-500' : 'text-red-400'}`} viewBox="0 0 12 12" fill="none">
                          {ok
                            ? <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            : <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          }
                        </svg>
                      </div>
                      <span className={ok ? 'text-slate-600 dark:text-white/60' : 'text-slate-400 dark:text-white/35'}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Name input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-white/45 uppercase tracking-wider">
                    Как тебя зовут?
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30" />
                    <input
                      type="text"
                      value={demoName}
                      onChange={e => setDemoName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && demoName.trim() && handleDemoLogin()}
                      placeholder="Введи своё имя..."
                      maxLength={40}
                      autoFocus
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  {/* Quick-pick name chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {['Алекс', 'Мария', 'Дима', 'Анна', 'Гость'].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDemoName(n)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                          demoName === n
                            ? 'bg-[#1d4ed8] text-white'
                            : 'bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/45 hover:bg-slate-200 dark:hover:bg-white/12'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Enter button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDemoLogin}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                    boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  {demoName.trim() ? `Войти как ${demoName.trim()}` : 'Войти в демо-режим'}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <p className="text-center text-xs text-slate-400 dark:text-white/25">
                  Хочешь сохранять данные?{' '}
                  <button
                    type="button"
                    onClick={() => { playClick(); switchTab('signup'); }}
                    className="text-[#1d4ed8] hover:underline font-medium"
                  >
                    Зарегистрироваться бесплатно
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── Admin panel ── */}
            {tab === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5 flex-1"
              >
                {/* Icon + description */}
                <div className="flex flex-col items-center text-center py-4">
                  <motion.div
                    animate={{ boxShadow: ['0 0 24px rgba(29,78,216,0.4)', '0 0 40px rgba(29,78,216,0.7)', '0 0 24px rgba(29,78,216,0.4)'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative"
                    style={{ background: 'linear-gradient(135deg, #1e1b4b, #1d4ed8)' }}
                  >
                    <Shield className="w-7 h-7 text-white" />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent" />
                  </motion.div>

                  <h3
                    style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}
                    className="text-slate-900 dark:text-white mb-2"
                  >
                    Вход для администратора
                  </h3>
                  <p className="text-slate-500 dark:text-white/45 text-sm leading-relaxed max-w-xs">
                    Для входа потребуется 4-значный PIN-код.<br />
                    Доступ только для авторизованных администраторов платформы.
                  </p>
                </div>

                {/* Capabilities */}
                <div
                  className="rounded-xl p-4 space-y-2.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(29,78,216,0.06), rgba(30,27,75,0.08))',
                    border: '1px solid rgba(29,78,216,0.15)',
                  }}
                >
                  {[
                    { label: 'Просмотр всех пользователей и статистики' },
                    { label: 'Управление аккаунтами платформы' },
                    { label: 'Мониторинг активности и прогресса' },
                  ].map(({ label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-white/55">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(29,78,216,0.18)' }}>
                        <svg className="w-2.5 h-2.5 text-[#2563eb]" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {label}
                    </div>
                  ))}
                </div>

                {/* Go to admin button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { playClick(); onClose(); navigate('/admin'); }}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 20px rgba(29,78,216,0.4), 0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  <Shield className="w-4 h-4" />
                  Перейти к входу администратора
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <p className="text-center text-xs text-slate-400 dark:text-white/25">
                  Не администратор?{' '}
                  <button
                    type="button"
                    onClick={() => { playClick(); switchTab('signin'); }}
                    className="text-[#1d4ed8] hover:underline font-medium"
                  >
                    Войти как пользователь
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── Sign in / Sign up form ── */}
            {(tab === 'signin' || tab === 'signup') && (
              <motion.form
                key={tab}
                initial={{ opacity: 0, x: tab === 'signup' ? 14 : -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === 'signup' ? -14 : 14 }}
                transition={{ duration: 0.16 }}
                onSubmit={handleSubmit}
                className="flex flex-col gap-3.5 flex-1"
              >
                {/* Display name (signup only) */}
                {tab === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="relative"
                  >
                    <BookUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Отображаемое имя (необязательно)"
                      className={`${inputCls} pl-10`}
                      autoComplete="name"
                    />
                  </motion.div>
                )}

                {/* Username */}
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30" />
                  <input
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Имя пользователя (логин)"
                    required
                    autoComplete={tab === 'signin' ? 'username' : 'new-username'}
                    className={`${inputCls} pl-10`}
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={tab === 'signup' ? 'Придумайте пароль (мин. 6 символов)' : 'Пароль'}
                      required
                      autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                      className={`${inputCls} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password strength bar */}
                  {pwdStrength && password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 space-y-1"
                    >
                      <div className="flex gap-1">
                        {[0,1,2,3,4].map(i => (
                          <div
                            key={i}
                            className="flex-1 h-1 rounded-full transition-all duration-300"
                            style={{ background: i < pwdStrength.score ? pwdStrength.color : 'rgba(0,0,0,0.08)' }}
                          />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: pwdStrength.color }}>{pwdStrength.label}</p>
                    </motion.div>
                  )}
                </div>

                {/* Confirm password (signup only) */}
                {tab === 'signup' && (
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      placeholder="Повторите пароль"
                      required
                      autoComplete="new-password"
                      className={`${inputCls} pl-10 pr-10 ${
                        confirmPwd && confirmPwd !== password
                          ? 'border-red-400/60 focus:ring-red-400/15'
                          : confirmPwd && confirmPwd === password
                          ? 'border-green-400/50 focus:ring-green-400/12'
                          : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {confirmPwd && (
                      <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute right-10 top-1/2 -translate-y-1/2"
                      >
                        {confirmPwd === password
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <AlertCircle className="w-4 h-4 text-red-400" />}
                      </motion.span>
                    )}
                  </div>
                )}

                {/* Remember me */}
                <label className="flex items-center gap-2.5 cursor-pointer group select-none mt-0.5">
                  <div
                    onClick={() => { playClick(); setRemember(r => !r); }}
                    className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-all ${
                      remember
                        ? 'border-[#1d4ed8] bg-[#1d4ed8]'
                        : 'border-slate-300 dark:border-white/20 group-hover:border-[#1d4ed8]/50'
                    }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {remember && (
                      <motion.svg
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"
                      >
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-600 dark:text-white/60 group-hover:text-slate-800 dark:group-hover:text-white/80 transition-colors">
                    Запомнить меня
                  </span>
                </label>

                {/* Error / Success */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 mt-1"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                    boxShadow: '0 4px 16px rgba(29,78,216,0.35)',
                  }}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {tab === 'signin' ? 'Входим...' : 'Создаём аккаунт...'}</>
                    : tab === 'signin'
                      ? <><LogIn className="w-4 h-4" /> Войти</>
                      : <><UserPlus className="w-4 h-4" /> Зарегистрироваться</>
                  }
                </button>

                {/* Switch tab hint */}
                <p className="text-center text-xs text-slate-400 dark:text-white/30 mt-1">
                  {tab === 'signin' ? (
                    <>Нет аккаунта?{' '}
                      <button type="button" onClick={() => switchTab('signup')}
                        className="text-[#1d4ed8] hover:underline font-medium">
                        Зарегистрироваться
                      </button>
                    </>
                  ) : (
                    <>Уже есть аккаунт?{' '}
                      <button type="button" onClick={() => switchTab('signin')}
                        className="text-[#1d4ed8] hover:underline font-medium">
                        Войти
                      </button>
                    </>
                  )}
                </p>
              </motion.form>
            )}

          </AnimatePresence>

          {/* Safe area bottom spacer — mobile only */}
          <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom)', minHeight: 12 }} />
        </div>
      </motion.div>
    </div>
  );
}