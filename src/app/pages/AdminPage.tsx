import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Users, Zap, CheckCircle2, Loader2, AlertCircle,
  RefreshCw, Trash2, Search, TrendingUp, LogOut,
  ChevronDown, ChevronUp, ListChecks, Activity, Target,
  Crown, X, UserX, BarChart2, Delete, ArrowLeft, CreditCard,
  Ban, ShieldCheck, Pencil, Mail, KeyRound, Eye, EyeOff, Save,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router';
import { playClick, playComplete, playError, playPing, playWhoosh } from '../lib/sounds';
import { SoundWave, triggerWave } from '../components/SoundWave';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { PlanTier, TIERS, TIER_ORDER } from '../lib/plans';
import { UserManageModal } from '../components/UserManageModal';

// ── Constants ─────────────────────────────────────────────────────────────────
const API = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;
const ADMIN_TOKEN_KEY = 'stride_admin_token';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Decodes a stride.app email back to the original username */
function emailToUsername(email: string): string {
  try {
    if (!email.endsWith('@stride.app')) return email.split('@')[0];
    const localPart = email.replace('@stride.app', '');
    const padded = localPart.replace(/-/g, '+').replace(/_/g, '/');
    const withPad = padded + '==='.slice(0, (4 - padded.length % 4) % 4);
    return decodeURIComponent(escape(atob(withPad)));
  } catch {
    return email.split('@')[0];
  }
}

function timeAgo(date?: string | null) {
  if (!date) return 'никогда';
  try {
    return formatDistanceToNow(parseISO(date), { locale: ru, addSuffix: true });
  } catch {
    return '—';
  }
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string;
  plans: number;
  tasks: number;
  doneTasks: number;
  usageThisMonth: number;
  tier: PlanTier;
  banned_until?: string | null;
}

interface AdminStats {
  totalUsers: number;
  activeThisMonth: number;
  totalPlans: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIN Login Screen
// ═══════════════════════════════════════════════════════════════════════════════
function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [shake, setShake]   = useState(false);
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate  = useNavigate();

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: password.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Неверный пароль');
      sessionStorage.setItem(ADMIN_TOKEN_KEY, json.token);
      playComplete();
      triggerWave();
      onLogin(json.token);
    } catch (e: any) {
      console.error('Admin login error:', e);
      setError(e.message ?? 'Ошибка авторизации');
      setPassword('');
      setShake(true);
      playError();
      setTimeout(() => { setShake(false); inputRef.current?.focus(); }, 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#060d1e', fontFamily: "'Inter', sans-serif" }}
    >
      <button
        onClick={() => { playClick(); navigate('/'); }}
        className="absolute top-5 left-5 z-20 flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/8 transition-all text-sm"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        На главную
      </button>

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(ellipse, rgba(29,78,216,0.18), transparent 70%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.93 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="relative z-10 w-full max-w-[380px]"
      >
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'linear-gradient(160deg, #0d1b35 0%, #091224 100%)',
            border: '1px solid rgba(29,78,216,0.2)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(29,78,216,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
                boxShadow: '0 0 40px rgba(29,78,216,0.5), 0 4px 16px rgba(29,78,216,0.3)',
              }}
              animate={{ boxShadow: ['0 0 40px rgba(29,78,216,0.5)', '0 0 56px rgba(29,78,216,0.7)', '0 0 40px rgba(29,78,216,0.5)'] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            >
              <Shield className="w-7 h-7 text-white" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent" />
            </motion.div>

            <div className="flex items-center justify-center gap-2.5 mb-1.5">
              <h1
                className="text-white text-xl"
                style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}
              >
                Vecto Admin
              </h1>
              <SoundWave bars={4} color="#2563eb" />
            </div>
            <p className="text-sm text-white/40">Введите пароль для входа</p>
          </div>

          <form onSubmit={submit}>
            <motion.div
              animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-5"
            >
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  ref={inputRef}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Пароль администратора"
                  className="w-full pl-10 pr-10 py-3.5 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: error ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => { if (!error) e.currentTarget.style.border = '1px solid rgba(29,78,216,0.5)'; }}
                  onBlur={e => { if (!error) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-sm text-red-400">{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading || !password.trim()}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                boxShadow: '0 4px 16px rgba(29,78,216,0.4)',
              }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Проверяем...</>
                : <><Shield className="w-4 h-4" />Войти</>}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-xs text-white/20 mt-4 select-none">
          Только для администраторов платформы
        </p>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════════════════════════════════
function StatCard({
  icon: Icon, label, value, sub, color, delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }}
      className="relative overflow-hidden group rounded-2xl p-5 cursor-default"
      style={{
        background: 'linear-gradient(160deg, #0d1b35 0%, #091224 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ background: `radial-gradient(circle at 0% 0%, ${color}12, transparent 60%)` }}
      />
      {/* Corner accent */}
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10"
        style={{ background: color }}
      />

      <div className="relative">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-3.5"
          style={{ background: `${color}18`, border: `1px solid ${color}28` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        <div className="text-xs text-white/45 font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-white/25 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tier Badge
// ═══════════════════════════════════════════════════════════════════════════════
function TierBadge({ tier }: { tier: PlanTier }) {
  const cfg = TIERS[tier];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
      style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
      {tier === 'free'   && <Zap className="w-2.5 h-2.5" />}
      {tier === 'medium' && <Target className="w-2.5 h-2.5" />}
      {tier === 'pro'    && <Crown className="w-2.5 h-2.5" />}
      {cfg.name}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tier Dropdown
// ═══════════════════════════════════════════════════════════════════════════════
function TierDropdown({
  userId, currentTier, adminToken, onChanged,
}: {
  userId: string; currentTier: PlanTier; adminToken: string; onChanged: (tier: PlanTier) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = async (tier: PlanTier) => {
    if (tier === currentTier) { setOpen(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/set-tier`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, tier }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
      onChanged(tier);
      playComplete();
    } catch (e: any) {
      console.error('Set tier error:', e);
      playError();
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => { playClick(); setOpen(o => !o); }}
        disabled={saving}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: `${TIERS[currentTier].color}14`,
          border: `1px solid ${TIERS[currentTier].color}28`,
        }}
      >
        {saving
          ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: TIERS[currentTier].color }} />
          : <TierBadge tier={currentTier} />}
        <ChevronDown className="w-2.5 h-2.5 text-white/30" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 z-30 rounded-xl overflow-hidden shadow-2xl min-w-[140px]"
            style={{
              background: 'linear-gradient(160deg, #0d1b35, #091224)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 px-3 pt-2.5 pb-1">Установить тариф</p>
            {TIER_ORDER.map(tid => (
              <button
                key={tid}
                onClick={() => handleSelect(tid)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left"
                style={{
                  background: tid === currentTier ? `${TIERS[tid].color}18` : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `${TIERS[tid].color}12`)}
                onMouseLeave={e => (e.currentTarget.style.background = tid === currentTier ? `${TIERS[tid].color}18` : 'transparent')}
              >
                <TierBadge tier={tid} />
                <span className="text-xs text-white/50 ml-auto">{TIERS[tid].price}</span>
                {tid === currentTier && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Confirm Modal
// ═══════════════════════════════════════════════════════════════════════════════
function DeleteModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: AdminUser;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const displayName = user.name || emailToUsername(user.email);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'linear-gradient(160deg, #0d1b35, #091224)',
          border: '1px solid rgba(239,68,68,0.25)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.1)',
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <UserX className="w-5 h-5 text-red-400" />
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3
          className="text-white text-lg mb-1.5"
          style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}
        >
          Удалить пользователя?
        </h3>
        <p className="text-sm text-white/60 mb-1 font-medium">@{displayName}</p>
        <p className="text-xs text-white/30 mb-6 leading-relaxed">
          Это действие необратимо. Аккаунт и все связанные данные будут удалены без возможности восстановления.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 hover:text-white transition-all"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.35)' }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Удаление...</>
              : <><Trash2 className="w-4 h-4" />Удалить</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats]           = useState<AdminStats | null>(null);
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState<'joined' | 'plans' | 'tasks' | 'activity'>('joined');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [toDelete, setToDelete]     = useState<AdminUser | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [toManage, setToManage]     = useState<AdminUser | null>(null);

  const authHeaders = {
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token,
    'Content-Type': 'application/json',
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const [sRes, uRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: authHeaders }),
        fetch(`${API}/admin/users`, { headers: authHeaders }),
      ]);

      // Any 401/403 → force logout so user re-enters PIN
      if (sRes.status === 401 || sRes.status === 403 || uRes.status === 401 || uRes.status === 403) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        onLogout();
        return;
      }
      if (!sRes.ok) throw new Error((await sRes.json()).error || 'Ошибка загрузки статистики');
      if (!uRes.ok) throw new Error((await uRes.json()).error || 'Ошибка загрузки пользователей');

      const [s, u] = await Promise.all([sRes.json(), uRes.json()]);
      setStats(s);

      // Fetch tier for each user
      const rawUsers: AdminUser[] = u.users ?? [];
      const tiersMap: Record<string, PlanTier> = {};
      await Promise.all(rawUsers.map(async (usr) => {
        try {
          const tRes = await fetch(`${API}/admin/user-tier/${usr.id}`, { headers: authHeaders });
          if (tRes.ok) { const d = await tRes.json(); tiersMap[usr.id] = d.tier || 'free'; }
          else tiersMap[usr.id] = 'free';
        } catch { tiersMap[usr.id] = 'free'; }
      }));
      setUsers(rawUsers.map(u => ({ ...u, tier: tiersMap[u.id] ?? 'free' })));

      playPing();
      triggerWave();
    } catch (e: any) {
      console.error('Admin load error:', e);
      const msg: string = e.message ?? 'Неизвестная ошибка';
      // Network / CORS errors → likely stale token, force re-login
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Unauthorized')) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        onLogout();
        return;
      }
      setError(msg);
      playError();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/admin/users/${toDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Ошибка удаления');
      }
      setUsers(prev => prev.filter(u => u.id !== toDelete.id));
      setToDelete(null);
      playComplete();
      triggerWave();
      // Refresh stats silently
      load(true);
    } catch (e: any) {
      console.error('Delete user error:', e);
      setError(`Ошибка удаления: ${e.message}`);
      playError();
    } finally {
      setDeleting(false);
    }
  };

  const handleTierChange = (userId: string, newTier: PlanTier) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: newTier } : u));
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    playClick();
  };

  // Filter + sort
  const filtered = users
    .filter(u => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        emailToUsername(u.email).toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const m = sortDir === 'desc' ? -1 : 1;
      switch (sortBy) {
        case 'joined':   return m * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'plans':    return m * (a.plans - b.plans);
        case 'tasks':    return m * (a.tasks - b.tasks);
        case 'activity': return m * (a.usageThisMonth - b.usageThisMonth);
        default:         return 0;
      }
    });

  function SortTh({ col, label }: { col: typeof sortBy; label: string }) {
    const active = sortBy === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 text-xs transition-colors ${active ? 'text-[#60a5fa]' : 'text-white/30 hover:text-white/60'}`}
      >
        {label}
        {active
          ? sortDir === 'desc'
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3 opacity-30" />}
      </button>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: '#060d1e', fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Top bar ── */}
      <header
        className="sticky top-0 z-40 border-b border-white/7 backdrop-blur-xl"
        style={{ background: 'rgba(6,13,30,0.96)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
      >
        <div
          className="h-[2px] w-full"
          style={{ background: 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 50%, #1e40af 100%)' }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                boxShadow: '0 0 14px rgba(29,78,216,0.5)',
              }}
            >
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-sm text-white"
                style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}
              >
                Vecto Admin
              </span>
              <SoundWave bars={4} color="#2563eb" className="opacity-60" />
            </div>
            <span className="hidden sm:inline-flex items-center text-xs px-2 py-0.5 rounded-full text-[#93c5fd] border border-[#1d4ed8]/30"
              style={{ background: 'rgba(29,78,216,0.15)' }}>
              Панель управления
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => { playClick(); load(true); }}
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.7, ease: 'linear', repeat: refreshing ? Infinity : 0 }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
              title="Обновить данные"
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
            <button
              onClick={() => { playWhoosh(); sessionStorage.removeItem(ADMIN_TOKEN_KEY); onLogout(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400 flex-1">{error}</span>
              <button
                onClick={() => { setError(''); load(); }}
                className="text-xs text-red-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Повторить
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full-screen loader */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                boxShadow: '0 0 24px rgba(29,78,216,0.5)',
              }}
            >
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <span className="text-sm text-white/35">Загружаем данные платформы...</span>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* ── Stats section ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-[#2563eb]" />
                <span
                  className="text-xs text-white/50 uppercase tracking-widest"
                  style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}
                >
                  Статистика платформы
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <StatCard icon={Users}       label="Пользователи"  value={stats.totalUsers}      sub="зарегистрировано"  color="#1d4ed8"  delay={0.00} />
                <StatCard icon={Zap}         label="Активных"      value={stats.activeThisMonth} sub="этот месяц"        color="#2563eb"  delay={0.05} />
                <StatCard icon={ListChecks}  label="Планов"        value={stats.totalPlans}      sub="всего создано"     color="#1e40af"  delay={0.10} />
                <StatCard icon={Target}      label="Задач"         value={stats.totalTasks}      sub="всего в планах"    color="#2563eb"  delay={0.15} />
                <StatCard icon={CheckCircle2} label="Выполнно"   value={stats.doneTasks}       sub="задач завершено"   color="#059669"  delay={0.20} />
                <StatCard icon={TrendingUp}  label="Завершение"   value={`${stats.completionRate}%`} sub="средний показатель" color="#d97706" delay={0.25} />
              </div>
            </section>

            {/* ── Completion progress ── */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'linear-gradient(160deg, #0d1b35, #091224)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#2563eb]" />
                  <span className="text-sm text-white/60">Средний прогресс выполнения задач</span>
                </div>
                <span className="text-sm font-bold text-white">{stats.completionRate}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #1d4ed8, #2563eb, #3b82f6)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${stats.completionRate}%` }}
                  transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/25">
                <span>{stats.doneTasks} завершено</span>
                <span>{stats.totalTasks - stats.doneTasks} в работе</span>
              </div>
            </div>

            {/* ── Users Table ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #0d1b35, #091224)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Table toolbar */}
              <div className="px-5 py-4 border-b border-white/6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Crown className="w-4 h-4 text-[#2563eb]" />
                  <h3
                    className="text-sm text-white"
                    style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}
                  >
                    Пользователи
                  </h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-[#93c5fd] border border-[#1d4ed8]/25"
                    style={{ background: 'rgba(29,78,216,0.18)' }}
                  >
                    {filtered.length}
                  </span>
                </div>

                {/* Search */}
                <div className="relative min-w-[200px] flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск по логину или имени..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/25 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onFocus={e => (e.currentTarget.style.border = '1px solid rgba(29,78,216,0.45)')}
                    onBlur={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)')}
                  />
                </div>
              </div>

              {/* Column headers */}
              {/* Scrollable table area */}
              <div className="overflow-x-auto">
              <div
                className="px-5 py-2.5 grid gap-2 text-xs border-b border-white/5 min-w-[800px]"
                style={{
                  gridTemplateColumns: '2fr 1.2fr 70px 70px 90px 90px 130px 36px 36px',
                  background: 'rgba(255,255,255,0.025)',
                }}
              >
                <div className="text-white/35 font-medium">Пользователь</div>
                <div><SortTh col="joined" label="Дата рег��страции" /></div>
                <div className="flex justify-center"><SortTh col="plans" label="Планы" /></div>
                <div className="flex justify-center"><SortTh col="tasks" label="Задачи" /></div>
                <div className="flex justify-center"><SortTh col="activity" label="Активность" /></div>
                <div className="text-white/35 font-medium text-center">Прогресс</div>
                <div className="flex items-center gap-1 text-white/35 font-medium">
                  <CreditCard className="w-3 h-3" />Тариф
                </div>
                <div />
                <div />
              </div>

              {/* Rows */}
              <div className="divide-y divide-white/[0.04] min-w-[800px]">
                {filtered.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="text-white/20 text-sm">
                      {search ? `Ничего не найдено по «${search}»` : 'Пользователей пока нет'}
                    </div>
                  </div>
                )}

                {filtered.map((user, idx) => {
                  const username    = user.name || emailToUsername(user.email);
                  const avatarLetter = username[0]?.toUpperCase() ?? '?';
                  const progress    = user.tasks > 0 ? Math.round((user.doneTasks / user.tasks) * 100) : 0;
                  const isActive    = user.usageThisMonth > 0;

                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.025 }}
                      className="px-5 py-3 grid gap-2 items-center group hover:bg-white/[0.025] transition-colors"
                      style={{ gridTemplateColumns: '2fr 1.2fr 70px 70px 90px 90px 130px 36px 36px' }}
                    >
                      {/* User info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{
                            background: user.banned_until && new Date(user.banned_until) > new Date()
                              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                              : 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                            boxShadow: user.banned_until && new Date(user.banned_until) > new Date()
                              ? '0 2px 8px rgba(220,38,38,0.3)'
                              : '0 2px 8px rgba(29,78,216,0.3)',
                          }}
                        >
                          {avatarLetter}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate flex items-center gap-1.5">
                            @{username}
                            {user.banned_until && new Date(user.banned_until) > new Date() && (
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 shrink-0">
                                BAN
                              </span>
                            )}
                          </div>
                          {user.name && (
                            <div className="text-xs text-white/30 truncate">{user.name}</div>
                          )}
                        </div>
                      </div>

                      {/* Joined */}
                      <div>
                        <div className="text-xs text-white/50">{timeAgo(user.created_at)}</div>
                        <div className="text-xs text-white/25">был {timeAgo(user.last_sign_in_at)}</div>
                      </div>

                      {/* Plans */}
                      <div className="text-center">
                        <span className="text-sm font-bold text-white">{user.plans}</span>
                      </div>

                      {/* Tasks */}
                      <div className="text-center">
                        <span className="text-sm text-white/65">{user.tasks}</span>
                      </div>

                      {/* Activity badge */}
                      <div className="flex justify-center">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                          style={
                            isActive
                              ? { background: 'rgba(5,150,105,0.14)', color: '#34d399', border: '1px solid rgba(5,150,105,0.25)' }
                              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }
                          }
                        >
                          {isActive ? `${user.usageThisMonth} план.` : 'неактивен'}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background:
                                progress >= 70 ? '#059669'
                                : progress >= 30 ? '#1d4ed8'
                                : '#d97706',
                            }}
                            initial={{ width: '0%' }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.7, delay: 0.1 + idx * 0.03 }}
                          />
                        </div>
                        <span className="text-xs text-white/30 w-7 text-right shrink-0">{progress}%</span>
                      </div>

                      {/* Tier dropdown */}
                      <div className="flex justify-start">
                        <TierDropdown
                          userId={user.id}
                          currentTier={user.tier ?? 'free'}
                          adminToken={token}
                          onChanged={newTier => handleTierChange(user.id, newTier)}
                        />
                      </div>

                      {/* Edit */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => { playClick(); setToManage(user); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/15 hover:text-[#60a5fa] hover:bg-[#1d4ed8]/12 transition-all opacity-0 group-hover:opacity-100"
                          title="Управление пользователем"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Delete */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => { playClick(); setToDelete(user); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/15 hover:text-red-400 hover:bg-red-500/12 transition-all opacity-0 group-hover:opacity-100"
                          title="Удалить пользователя"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              </div>{/* end overflow-x-auto */}

              {/* Table footer */}
              <div className="px-5 py-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/20">
                {refreshing && <><Loader2 className="w-3 h-3 animate-spin text-[#2563eb]" /><span className="text-[#60a5fa]">Обновление...</span></>}
                {!refreshing && <span>Показано {filtered.length} из {users.length}</span>}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {toDelete && (
          <DeleteModal
            user={toDelete}
            onConfirm={handleDelete}
            onCancel={() => !deleting && setToDelete(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      {/* ── User manage modal ── */}
      <AnimatePresence>
        {toManage && (
          <UserManageModal
            user={toManage}
            adminToken={token}
            onClose={() => setToManage(null)}
            onUserUpdated={(updates) => {
              setUsers(prev => prev.map(u =>
                u.id === toManage.id ? { ...u, ...updates } : u
              ));
              setToManage(prev => prev ? { ...prev, ...updates } : null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root export — always starts at PIN login; stale sessionStorage is cleared
// ═══════════════════════════════════════════════════════════════════════════════
export function AdminPage() {
  // Always start unauthenticated — clear any stale session token immediately
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }, []);

  const handleLogin = (t: string) => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
    setToken(t);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  };

  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }
  return <AdminDashboard token={token} onLogout={handleLogout} />;
}