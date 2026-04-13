/**
 * TelegramSettings — Profile section for linking Telegram bot.
 * Users get a 6-digit code, send it to the bot, and receive notifications via Telegram.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Link2, Unlink, Copy, Check, Loader2, RefreshCw,
  ExternalLink, Shield, Zap, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { telegramLink, telegramStatus, telegramUnlink, telegramSend } from '../lib/api';
import { useAuth, supabase } from '../lib/auth';
import { playClick, playComplete, playError } from '../lib/sounds';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

// Replace with your actual bot username
const BOT_USERNAME = 'VectoTomiBot';

export function TelegramSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<{
    linked: boolean;
    username?: string;
    firstName?: string;
    linkedAt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      const s = await telegramStatus(token);
      setStatus(s);
    } catch (err: any) {
      console.error('Telegram status error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // Poll for link status when code is generated
  useEffect(() => {
    if (!code) return;
    pollRef.current = setInterval(async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const s = await telegramStatus(token);
        if (s.linked) {
          setStatus(s);
          setCode(null);
          playComplete();
          toast.success('Telegram успешно привязан!');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 3000);

    // Stop polling after 10 minutes
    const timeout = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setCode(null);
    }, 10 * 60 * 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(timeout);
    };
  }, [code, getToken]);

  const handleGenerateCode = async () => {
    playClick();
    setGenerating(true);
    try {
      const token = await getToken();
      const { code: newCode } = await telegramLink(token);
      setCode(newCode);
    } catch (err: any) {
      playError();
      toast.error(`Ошибка: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    playClick();
    toast.success('Код скопирован');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async () => {
    playClick();
    setUnlinking(true);
    try {
      const token = await getToken();
      await telegramUnlink(token);
      setStatus({ linked: false });
      toast.success('Telegram отвязан');
    } catch (err: any) {
      playError();
      toast.error(`Ошибка: ${err.message}`);
    } finally {
      setUnlinking(false);
    }
  };

  const handleTestNotification = async () => {
    playClick();
    setSendingTest(true);
    try {
      const token = await getToken();
      await telegramSend(token, 'Тестовое уведомление! Если ты видишь это — привязка работает отлично.', 'test');
      setTestSent(true);
      playComplete();
      toast.success('Тестовое уведомление отправлено');
      setTimeout(() => setTestSent(false), 3000);
    } catch (err: any) {
      playError();
      toast.error(`Ошибка: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-white dark:bg-[#0d1a36] border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-white/8">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#0088cc]/12">
          <Send className="w-3.5 h-3.5 text-[#0088cc]" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-800 dark:text-white">Telegram-уведомления</span>
        </div>
        {status?.linked && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Привязан
          </span>
        )}
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#1d4ed8] animate-spin" />
          </div>
        ) : status?.linked ? (
          /* ── Linked state ──────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Account info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-100 dark:border-white/6">
              <div className="w-10 h-10 rounded-xl bg-[#0088cc]/12 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                  {status.firstName || status.username || 'Telegram пользователь'}
                  {status.username && (
                    <span className="text-xs text-slate-400 dark:text-white/30 ml-1.5">
                      @{status.username}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
                  Привязан {status.linkedAt ? format(parseISO(status.linkedAt), 'dd.MM.yyyy') : ''}
                </p>
              </div>
              <Link2 className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { icon: Shield, label: 'Предупреждения о спаде', desc: 'При высоком уровне риска' },
                { icon: Zap, label: 'Защита стрика', desc: 'Напоминание о серии задач' },
              ].map(item => (
                <div key={item.label}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-100 dark:border-white/6">
                  <item.icon className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-white/80">{item.label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-white/35 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleTestNotification}
                disabled={sendingTest}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors disabled:opacity-50"
              >
                {sendingTest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : testSent ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {testSent ? 'Отправлено!' : 'Тестовое уведомление'}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleUnlink}
                disabled={unlinking}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-500/25 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {unlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                Отвязать
              </motion.button>
            </div>
          </div>
        ) : (
          /* ── Not linked state ──────────────────────────────────────────── */
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">
              Подключи Telegram-бота, чтобы получать уведомления от Томи даже когда браузер закрыт:
              предупреждения о рисках, защита стрика, важные напоминания.
            </p>

            <AnimatePresence mode="wait">
              {!code ? (
                <motion.div key="gen" exit={{ opacity: 0 }}>
                  {/* Step instructions */}
                  <div className="space-y-2.5 mb-4">
                    {[
                      { step: 1, text: 'Нажми «Получить код» ниже' },
                      { step: 2, text: `Открой бот @${BOT_USERNAME} в Telegram` },
                      { step: 3, text: 'Отправь 6-значный код боту' },
                    ].map(s => (
                      <div key={s.step} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#1d4ed8]/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#1d4ed8]">{s.step}</span>
                        </div>
                        <span className="text-xs text-slate-600 dark:text-white/60">{s.text}</span>
                      </div>
                    ))}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGenerateCode}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#0088cc] text-white hover:bg-[#0077b5] transition-colors disabled:opacity-50 shadow-lg shadow-[#0088cc]/20"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Получить код привязки
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="code"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Code display */}
                  <div className="relative">
                    <div
                      className="flex items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-[#1d4ed8]/30 bg-[#1d4ed8]/5"
                    >
                      <span className="text-3xl font-mono font-bold tracking-[0.3em] text-[#1d4ed8]">
                        {code}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 dark:text-white/30 text-center">
                    Код действует 10 минут. Отправь его боту @{BOT_USERNAME}
                  </p>

                  {/* Open bot link */}
                  <a
                    href={`https://t.me/${BOT_USERNAME}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold bg-[#0088cc] text-white hover:bg-[#0077b5] transition-colors shadow-lg shadow-[#0088cc]/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Открыть @{BOT_USERNAME}
                  </a>

                  {/* Waiting indicator */}
                  <div className="flex items-center justify-center gap-2 py-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <RefreshCw className="w-3 h-3 text-[#1d4ed8]/40" />
                    </motion.div>
                    <span className="text-[10px] text-slate-400 dark:text-white/25">
                      Ожидаю привязку...
                    </span>
                  </div>

                  <button
                    onClick={() => { setCode(null); handleGenerateCode(); }}
                    className="w-full text-center text-xs text-slate-400 dark:text-white/25 hover:text-slate-500 dark:hover:text-white/40 transition-colors"
                  >
                    Сгенерировать новый код
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
