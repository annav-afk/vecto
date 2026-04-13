import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Calendar, BarChart3, CheckCircle2, Zap,
  Edit3, Save, X, LogOut, ArrowLeft, Target,
  TrendingUp, Layers, Shield, Loader2, AlertCircle, RefreshCw,
  ListChecks, Flame, Check, Sparkles, Crown, HeadphonesIcon,
  CalendarClock, MessageSquare, Star, Bell,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth';
import { playClick, playComplete, playError } from '../lib/sounds';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../lib/auth';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TIERS, hasSupport, PlanTier, getTierBadgeStyle } from '../lib/plans';
import { toast } from 'sonner';
import {
  isNotificationsSupported, getNotificationPermission,
  requestNotificationPermission, areNotificationsEnabled,
  setNotificationsEnabled,
} from '../lib/tomiNotifications';
import { TelegramSettings } from '../components/TelegramSettings';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

interface ProfileData {
  user: { id: string; email: string; name: string; created_at: string };
  stats: {
    totalPlans: number; activePlans: number;
    totalTasks: number; doneTasks: number; usageThisMonth: number;
  };
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative bg-white dark:bg-[#0d1a36] border border-slate-100 dark:border-white/10 rounded-2xl p-5 overflow-hidden group hover:shadow-lg dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all cursor-default"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${color}10 0%, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 mb-2">
            {label}
          </p>
          <p className="text-[1.75rem] font-black text-slate-900 dark:text-white leading-none">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1.5 font-medium">{sub}</p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${color}16` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, delay = 0 }: {
  title: string; icon: React.ElementType; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-[#0d1a36] border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-white/8">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1d4ed812' }}>
          <Icon className="w-3.5 h-3.5 text-[#1d4ed8]" />
        </div>
        <span className="text-sm font-bold text-slate-800 dark:text-white">{title}</span>
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-slate-100 dark:border-white/8 last:border-0">
      <span className="text-sm text-slate-500 dark:text-white/50 font-medium shrink-0 mr-4">{label}</span>
      <span className="text-sm text-slate-800 dark:text-white font-semibold text-right truncate max-w-[55%]">
        {value}
      </span>
    </div>
  );
}

// ── Support booking button ─────────────────────────────────────────────────────
function SupportBookingButton() {
  const [booked, setBooked] = useState(false);
  const [open, setOpen]     = useState(false);

  if (booked) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl w-full"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Запись подтверждена!</p>
          <p className="text-xs text-slate-500">Ожидайте письма на почту со ссылкой на сессию</p>
        </div>
      </div>
    );
  }

  if (open) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl space-y-4"
        style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.15)' }}>
        <p className="text-sm font-bold text-slate-800 dark:text-white">Выберите удобное время</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['Пн 10:00', 'Пн 15:00', 'Вт 11:00', 'Вт 16:00', 'Ср 10:00', 'Ср 14:00'].map(slot => (
            <button key={slot}
              onClick={() => { setBooked(true); playComplete(); toast.success(`Записаны на ${slot}`); }}
              className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.2)', color: '#1d4ed8' }}>
              {slot}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Отмена
        </button>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={() => { playClick(); setOpen(true); }}
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all"
      style={{
        background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
        boxShadow: '0 6px 24px rgba(29,78,216,0.35)',
      }}
    >
      <CalendarClock className="w-4 h-4" />
      Записаться на поддержку
    </motion.button>
  );
}

// ── Notification Settings ─────────────────────────────────────────────────────
function NotificationSettings() {
  const supported = isNotificationsSupported();
  const [enabled, setEnabled] = useState(areNotificationsEnabled);
  const [permission, setPermission] = useState(getNotificationPermission);
  const [requesting, setRequesting] = useState(false);

  if (!supported) return null;

  const handleToggle = async () => {
    playClick();
    if (!enabled) {
      // Enable → request permission if needed
      if (permission !== 'granted') {
        setRequesting(true);
        const granted = await requestNotificationPermission();
        setPermission(getNotificationPermission());
        setRequesting(false);
        if (!granted) {
          toast.error('Браузер не разрешил уведомления');
          return;
        }
      }
      setNotificationsEnabled(true);
      setEnabled(true);
      toast.success('Уведомления Томи включены');
    } else {
      setNotificationsEnabled(false);
      setEnabled(false);
      toast('Уведомления выключены');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32 }}
      className="bg-white dark:bg-[#0d1a36] border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-white/8">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1d4ed812' }}>
          <Bell className="w-3.5 h-3.5 text-[#1d4ed8]" />
        </div>
        <span className="text-sm font-bold text-slate-800 dark:text-white">Push-уведомления от Томи</span>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">
          Томи может отправлять push-уведомления, когда обнаружит риск спада продуктивности или
          когда стрик задач под угрозой. Уведомления приходят не чаще одного раза в 6 часов.
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-[#1d4ed8]/12' : 'bg-slate-100 dark:bg-white/5'}`}>
              <Bell className={`w-5 h-5 ${enabled ? 'text-[#1d4ed8]' : 'text-slate-400 dark:text-white/30'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                {enabled ? 'Уведомления включены' : 'Уведомления выключены'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-white/35">
                {permission === 'denied'
                  ? 'Браузер заблокировал уведомления — разрешите в настройках'
                  : permission === 'granted'
                    ? 'Разрешение получено'
                    : 'Потребуется разрешение браузера'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={requesting || permission === 'denied'}
            className={`relative w-12 h-7 rounded-full transition-all duration-200 shrink-0 ${
              enabled ? 'bg-[#1d4ed8]' : 'bg-slate-200 dark:bg-white/15'
            } ${permission === 'denied' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ left: enabled ? '22px' : '2px' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            />
          </button>
        </div>

        {/* What notifications do */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {[
            { label: 'Предупреждение о спаде', desc: 'Когда Томи замечает тревожные сигналы' },
            { label: 'Защита стрика', desc: 'Напоминание завершить хотя бы 1 задачу' },
          ].map(item => (
            <div key={item.label}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-100 dark:border-white/6">
              <Check className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-white/80">{item.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-white/35 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const navigate = useNavigate();
  const { user, syncStatus, signOut, tier } = useAuth();
  const [data,      setData]      = useState<ProfileData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [editName,  setEditName]  = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? publicAnonKey;
      const res = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка загрузки профиля'); }
      const json = await res.json();
      setData(json);
      setNameInput(json.user.name || '');
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      setError(e.message); playError();
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    fetchProfile();
  }, [user, fetchProfile, navigate]);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? publicAnonKey;
      const res = await fetch(`${API}/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка сохранения'); }
      setSaveMsg('✓ Сохранено');
      setEditName(false);
      playComplete();
      await fetchProfile();
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e: any) {
      setSaveMsg(`Ошибка: ${e.message}`); playError();
    } finally { setSaving(false); }
  };

  const handleSignOut = async () => { playClick(); await signOut(); navigate('/'); };

  const completionRate = data?.stats.totalTasks
    ? Math.round((data.stats.doneTasks / data.stats.totalTasks) * 100)
    : 0;

  const displayName  = data?.user.name || user?.email?.split('@')[0] || '?';
  const avatarLetter = displayName[0]?.toUpperCase() ?? '?';
  const memberSince  = data?.user.created_at
    ? format(parseISO(data.user.created_at), 'd MMMM yyyy', { locale: ru })
    : '—';
  const progressColor = completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#1d4ed8' : '#f59e0b';

  const tier_placeholder = tier; // use real tier from auth context

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen bg-slate-50 dark:bg-[#060d1e] text-slate-900 dark:text-white">
      <Navbar />

      {/* ── HERO BANNER ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 55%, #0f172a 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, white, transparent)' }} />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-20">
          {/* Back button */}
          <button
            onClick={() => { playClick(); navigate('/dashboard'); }}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к планам
          </button>

          {/* Avatar + name — in the banner itself */}
          {!loading && data ? (
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Avatar */}
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-3xl border-4 border-white/20 shrink-0 shadow-2xl"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', fontWeight: 900 }}
              >
                {avatarLetter}
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0 pb-1">
                <AnimatePresence mode="wait">
                  {editName ? (
                    <motion.div key="edit"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 mb-2"
                    >
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        className="flex-1 min-w-0 bg-white/15 border border-white/30 rounded-xl px-4 py-2.5 text-white text-lg font-bold focus:outline-none focus:border-white/60 focus:bg-white/20 transition-all placeholder-white/40"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                        placeholder="Ваше имя"
                      />
                      <button onClick={handleSaveName} disabled={saving || !nameInput.trim()}
                        className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white disabled:opacity-50 transition-all shrink-0">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setEditName(false); setNameInput(data.user.name); }}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="view"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-3 mb-2 flex-wrap"
                    >
                      <h1
                        style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900 }}
                        className="text-white text-3xl sm:text-4xl leading-none"
                      >
                        {data.user.name || 'Без имени'}
                      </h1>
                      <button
                        onClick={() => { playClick(); setEditName(true); }}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
                        title="Изменить имя"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {saveMsg && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xs text-emerald-300 font-semibold mb-2">{saveMsg}</motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Активен
                    {syncStatus === 'synced' && ' · Синхронизировано'}
                  </span>
                  <span className="text-white/40 text-xs">·</span>
                  <span className="text-white/60 text-xs font-medium">{data.user.email}</span>
                </div>
              </div>

              {/* Sign out — top right on desktop */}
              <button
                onClick={handleSignOut}
                className="sm:self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white text-sm font-semibold transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-white/10 animate-pulse" />
              <div className="space-y-3">
                <div className="h-8 w-40 bg-white/10 rounded-xl animate-pulse" />
                <div className="h-4 w-56 bg-white/8 rounded-lg animate-pulse" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-10 sm:pb-12"
        style={{ paddingBottom: 'max(7rem, calc(5.5rem + env(safe-area-inset-bottom)))' }}>
        {/* Error */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 mb-5"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</span>
            <button onClick={fetchProfile}
              className="shrink-0 flex items-center gap-1 text-xs text-red-500 hover:text-red-400 font-bold transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Повторить
            </button>
          </motion.div>
        )}

        {loading && !data && (
          <div className="space-y-5 animate-pulse">
            {/* Skeleton: stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-white/10 rounded mb-3" />
                  <div className="h-6 w-12 bg-slate-200 dark:bg-white/10 rounded mb-1" />
                  <div className="h-2 w-20 bg-slate-100 dark:bg-white/5 rounded" />
                </div>
              ))}
            </div>
            {/* Skeleton: info section */}
            <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl p-6">
              <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded mb-5" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3.5 border-b border-slate-100 dark:border-white/8 last:border-0">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-white/10 rounded" />
                  <div className="h-3 w-32 bg-slate-100 dark:bg-white/5 rounded" />
                </div>
              ))}
            </div>
            {/* Skeleton: tier section */}
            <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl p-6">
              <div className="h-4 w-28 bg-slate-200 dark:bg-white/10 rounded mb-4" />
              <div className="h-10 w-full bg-slate-100 dark:bg-white/5 rounded-xl" />
            </div>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-5">

            {/* ─ Stats ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={Layers}       label="Планов"          value={data.stats.totalPlans}      sub="создано"             color="#1d4ed8" delay={0}    />
              <StatCard icon={Zap}          label="Активных"        value={data.stats.activePlans}     sub="в процессе"          color="#2563eb" delay={0.05} />
              <StatCard icon={CheckCircle2} label="Задач сделано"   value={data.stats.doneTasks}       sub={`из ${data.stats.totalTasks}`} color="#10b981" delay={0.1} />
              <StatCard icon={Flame}        label="В этом месяце"   value={data.stats.usageThisMonth}  sub="планов"              color="#f59e0b" delay={0.15} />
            </div>

            {/* ── Progress ────────────────────────────────────────────────── */}
            <Section title="Общий прогресс" icon={TrendingUp} delay={0.2}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500 dark:text-white/50 font-medium">
                  Выполнено {data.stats.doneTasks} из {data.stats.totalTasks} задач
                </p>
                <span className="text-2xl font-black" style={{ color: progressColor }}>
                  {completionRate}%
                </span>
              </div>
              <div className="h-3.5 bg-slate-100 dark:bg-white/8 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${progressColor}cc, ${progressColor})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1.3, ease: 'easeOut', delay: 0.4 }}
                />
              </div>
              <div className="flex justify-between mt-2.5">
                <span className="text-xs text-slate-400 dark:text-white/35 font-medium">Сделано: {data.stats.doneTasks}</span>
                <span className="text-xs text-slate-400 dark:text-white/35 font-medium">Осталось: {data.stats.totalTasks - data.stats.doneTasks}</span>
              </div>
            </Section>

            {/* ── Quick actions ────────────────────────────────────────────── */}
            <Section title="Быстрые действия" icon={Target} delay={0.25}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Мои планы',  desc: 'Открыть дашборд',   icon: ListChecks, href: '/dashboard', color: '#1d4ed8' },
                  { label: 'Новый план', desc: 'Создать с нуля',     icon: Zap,        href: '/new',       color: '#2563eb' },
                  { label: 'Аналитика', desc: 'Статистика задач',    icon: BarChart3,   href: '/dashboard', color: '#10b981' },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { playClick(); navigate(item.href); }}
                    className="group flex items-center gap-3.5 px-4 py-4 rounded-xl border border-slate-100 dark:border-white/8 hover:border-[#1d4ed8]/30 dark:hover:border-[#1d4ed8]/30 bg-slate-50 dark:bg-white/3 hover:bg-[#1d4ed8]/4 dark:hover:bg-[#1d4ed8]/8 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{ background: `${item.color}18` }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-[#1d4ed8] dark:group-hover:text-[#93bbfd] transition-colors">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {/* ── Account info ─────────────────────────────────────────────── */}
            <Section title="Аккаунт" icon={Shield} delay={0.3}>
              <InfoRow label="ID пользователя"  value={data.user.id.slice(0, 8) + '...'} />
              <InfoRow label="Email"             value={data.user.email} />
              <InfoRow label="Дата регистрации"  value={memberSince} />
              <InfoRow label="Тарифный план"     value={`${TIERS[tier_placeholder].name} · ${TIERS[tier_placeholder].plansPerCycle} планов / ${TIERS[tier_placeholder].cycleName}`} />
            </Section>

            {/* ── Tomi Notifications ───────────────────────────────────────── */}
            <NotificationSettings />

            {/* ── Tier card ─────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${TIERS[tier_placeholder].color}14, ${TIERS[tier_placeholder].color}06)`,
                border: `1px solid ${TIERS[tier_placeholder].color}20`,
              }}>
              <div className="px-6 py-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{ background: TIERS[tier_placeholder].color, boxShadow: `0 4px 16px ${TIERS[tier_placeholder].glowColor}` }}>
                      {tier_placeholder === 'free'   && <Zap className="w-5 h-5 text-white" />}
                      {tier_placeholder === 'medium' && <Target className="w-5 h-5 text-white" />}
                      {tier_placeholder === 'pro'    && <Star className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900 dark:text-white text-lg" style={{ fontFamily: "'Syne', sans-serif" }}>
                          {TIERS[tier_placeholder].name}
                        </p>
                        {TIERS[tier_placeholder].badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ background: TIERS[tier_placeholder].color }}>
                            {TIERS[tier_placeholder].badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-white/50">
                        {TIERS[tier_placeholder].plansPerCycle} планов / {TIERS[tier_placeholder].cycleName}
                        {TIERS[tier_placeholder].cycleDays ? ` (пробный период ${TIERS[tier_placeholder].cycleDays} дней)` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">{TIERS[tier_placeholder].price}</p>
                      <p className="text-xs text-slate-400">{TIERS[tier_placeholder].period || 'пробно'}</p>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {TIERS[tier_placeholder].features.slice(0, 4).map(f => (
                    <span key={f} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl"
                      style={{ background: `${TIERS[tier_placeholder].color}10`, border: `1px solid ${TIERS[tier_placeholder].color}18`, color: TIERS[tier_placeholder].color }}>
                      <CheckCircle2 className="w-3 h-3" />{f}
                    </span>
                  ))}
                </div>

                {tier_placeholder !== 'pro' && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: `${TIERS[tier_placeholder].color}15` }}>
                    <a
                      href="https://t.me/ohh_lessya"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold transition-colors hover:underline"
                      style={{ color: TIERS[tier_placeholder].color }}
                    >
                      Повысить тариф →
                    </a>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Pro Support ──────────────────────────────────────────────── */}
            {hasSupport(tier_placeholder) && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(29,78,216,0.06), rgba(29,78,216,0.02))',
                  border: '1px solid rgba(29,78,216,0.2)',
                }}>
                <div className="px-6 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(29,78,216,0.2)' }}>
                      <HeadphonesIcon className="w-5 h-5 text-[#1d4ed8]" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Персональная поддержка</p>
                      <p className="text-xs text-slate-500 dark:text-white/50">Доступно в вашем Pro-тарифе</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-white/60 mb-5 leading-relaxed">
                    Запишитесь на сессию с нашим специалистом — разберём ваши цели, настроим планы и поможем с любыми вопросами.
                  </p>

                  <div className="grid sm:grid-cols-3 gap-3 mb-5">
                    {[
                      { icon: CalendarClock, label: 'Запись к специалисту', desc: 'Слот 45 минут' },
                      { icon: MessageSquare, label: 'Чат-поддержка', desc: 'Ответ за 2 часа' },
                      { icon: Sparkles,      label: 'Разбор плана', desc: 'Персональный аудит' },
                    ].map(item => (
                      <div key={item.label} className="flex flex-col items-center text-center p-3 rounded-xl"
                        style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.1)' }}>
                        <item.icon className="w-5 h-5 text-[#1d4ed8] mb-2" />
                        <p className="text-xs font-bold text-slate-700 dark:text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <SupportBookingButton />
                </div>
              </motion.div>
            )}

            {/* ── Telegram Settings ───────────────────────────────────────────── */}
            <TelegramSettings />
          </div>
        )}
      </div>
    </div>
  );
}