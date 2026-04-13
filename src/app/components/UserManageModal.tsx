import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Ban, ShieldCheck, Mail, KeyRound, Eye, EyeOff,
  Loader2, Save, CheckCircle2, AlertCircle, Pencil,
} from 'lucide-react';
import { playClick, playComplete, playError } from '../lib/sounds';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

interface UserData {
  id: string;
  email: string;
  name: string;
  banned_until?: string | null;
}

interface Props {
  user: UserData;
  adminToken: string;
  onClose: () => void;
  onUserUpdated: (updates: Partial<UserData>) => void;
}

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

export function UserManageModal({ user, adminToken, onClose, onUserUpdated }: Props) {
  const isBanned = !!(user.banned_until && new Date(user.banned_until) > new Date());
  const displayName = user.name || emailToUsername(user.email);

  const [newEmail, setNewEmail]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [banning, setBanning]         = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw]       = useState(false);
  const [success, setSuccess]         = useState('');
  const [error, setError]             = useState('');

  const headers = {
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': adminToken,
    'Content-Type': 'application/json',
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    playComplete();
    setTimeout(() => setSuccess(''), 3000);
  };

  // ── Ban / Unban ──
  const toggleBan = async () => {
    setBanning(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/ban-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user.id, banned: !isBanned }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка');
      onUserUpdated({ banned_until: !isBanned ? '2100-01-01T00:00:00Z' : null });
      showSuccess(!isBanned ? 'Доступ заблокирован' : 'Доступ разблокирован');
    } catch (e: any) {
      setError(e.message);
      playError();
    } finally {
      setBanning(false);
    }
  };

  // ── Update email ──
  const handleEmailSave = async () => {
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/update-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user.id, email: newEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка');
      onUserUpdated({ email: json.user?.email || newEmail.trim() });
      setNewEmail('');
      showSuccess('Email обновлён');
    } catch (e: any) {
      setError(e.message);
      playError();
    } finally {
      setSavingEmail(false);
    }
  };

  // ── Update password ──
  const handlePasswordSave = async () => {
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    setSavingPw(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/update-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user.id, password: newPassword.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка');
      setNewPassword('');
      showSuccess('Пароль обновлён');
    } catch (e: any) {
      setError(e.message);
      playError();
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0d1b35, #091224)',
          border: '1px solid rgba(29,78,216,0.25)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(29,78,216,0.1)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
              }}
            >
              {displayName[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="text-white font-semibold text-sm flex items-center gap-2">
                @{displayName}
                {isBanned && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/25 text-red-400">
                    ЗАБЛОКИРОВАН
                  </span>
                )}
              </div>
              <div className="text-xs text-white/35 truncate max-w-[250px]">{user.email}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* ── Access toggle ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2.5 block">
              Доступ к платформе
            </label>
            <button
              onClick={() => { playClick(); toggleBan(); }}
              disabled={banning}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
              style={{
                background: isBanned ? 'rgba(239,68,68,0.08)' : 'rgba(5,150,105,0.08)',
                border: `1px solid ${isBanned ? 'rgba(239,68,68,0.2)' : 'rgba(5,150,105,0.2)'}`,
              }}
            >
              <div className="flex items-center gap-2.5">
                {banning ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                ) : isBanned ? (
                  <Ban className="w-4 h-4 text-red-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span className={`text-sm font-medium ${isBanned ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isBanned ? 'Заблокирован — нажмите чтобы разблокировать' : 'Активен — нажмите чтобы заблокировать'}
                </span>
              </div>
              <div
                className="w-10 h-5 rounded-full relative transition-colors"
                style={{ background: isBanned ? '#dc2626' : '#059669' }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: isBanned ? 2 : 22 }}
                />
              </div>
            </button>
          </div>

          {/* ── Change Email ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2.5 block">
              Изменить Email
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
                <input
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder={user.email}
                  type="email"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => (e.currentTarget.style.border = '1px solid rgba(29,78,216,0.4)')}
                  onBlur={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)')}
                />
              </div>
              <button
                onClick={handleEmailSave}
                disabled={savingEmail || !newEmail.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-30 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                  boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                }}
              >
                {savingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Сохранить
              </button>
            </div>
          </div>

          {/* ── Change Password ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2.5 block">
              Изменить пароль
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
                <input
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Новый пароль (мин. 6 символов)"
                  type={showPw ? 'text' : 'password'}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => (e.currentTarget.style.border = '1px solid rgba(29,78,216,0.4)')}
                  onBlur={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
                >
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={handlePasswordSave}
                disabled={savingPw || !newPassword.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-30 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                  boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                }}
              >
                {savingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Сохранить
              </button>
            </div>
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400 font-medium">{success}</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs text-red-400">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all border border-white/8"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
