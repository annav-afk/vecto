/**
 * TomiNotificationBubble
 * ─────────────────────
 * Duolingo-style pop-up notifications from Tomi.
 * Tomi peeks up from the bottom-right corner with a speech bubble,
 * auto-dismisses after a few seconds, and respects a per-session cooldown.
 * Supports contextual reminders with plan/task data.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { TomiAvatar } from './TomiAssistant';

// ── Message bank ──────────────────────────────────────────────────────────────
type NotifCategory = 'greet' | 'motivate' | 'tip' | 'challenge' | 'celebrate' | 'context' | 'procrastination' | 'missed';

interface TomiNotif {
  id: string;
  text: string;
  emoji: string;
  category: NotifCategory;
  /** optional action label — clicking opens Tomi chat */
  action?: string;
  priority?: number; // higher = shown first
}

const MESSAGES: TomiNotif[] = [
  // Greetings
  { id: 'g1', text: 'Привет! Я здесь, если нужна помощь с планом 👋', emoji: '👋', category: 'greet', action: 'Спросить Томи' },
  { id: 'g2', text: 'Рад тебя видеть! Как дела с задачами?', emoji: '😊', category: 'greet', action: 'Рассказать' },
  { id: 'g3', text: 'Скучал по тебе! Готов помочь с планированием?', emoji: '🤖', category: 'greet', action: 'Давай' },

  // Motivation
  { id: 'm1', text: 'Прогресс важнее совершенства. Один шаг сегодня — победа!', emoji: '🎯', category: 'motivate' },
  { id: 'm2', text: 'Маленькое действие сейчас лучше идеального плана потом.', emoji: '⚡', category: 'motivate' },
  { id: 'm3', text: 'Ты уже здесь — это и есть начало. Действуй!', emoji: '🚀', category: 'motivate' },
  { id: 'm4', text: 'Фокус на одной задаче. Ты справишься.', emoji: '💪', category: 'motivate' },
  { id: 'm5', text: 'Каждый выполненный пункт приближает к цели.', emoji: '✅', category: 'motivate' },
  { id: 'm6', text: 'Сложные задачи делаются по одному шагу за раз.', emoji: '🧗', category: 'motivate' },

  // Tips
  { id: 't1', text: 'Попробуй метод «помидора»: 25 мин работы — 5 мин отдыха.', emoji: '🍅', category: 'tip' },
  { id: 't2', text: 'Утром планируй, вечером — рефлексируй. Маленький ритуал.', emoji: '📋', category: 'tip' },
  { id: 't3', text: 'Самую трудную задачу лучше делать утром.', emoji: '🌅', category: 'tip' },
  { id: 't4', text: 'Разбивай большое на маленькое — я помогу!', emoji: '🔪', category: 'tip', action: 'Разбить задачу' },
  { id: 't5', text: 'Установи таймер. Ограничение времени — твой друг.', emoji: '⏱️', category: 'tip' },

  // Challenges
  { id: 'c1', text: 'Вызов: закрой одну задачу прямо сейчас. Просто одну!', emoji: '🏆', category: 'challenge' },
  { id: 'c2', text: 'Попробуй сегодня не откладывать ни одной задачи в «позже».', emoji: '🔥', category: 'challenge' },
  { id: 'c3', text: 'Мини-челлендж: 10 минут на самую скучную задачу. Поехали?', emoji: '⏰', category: 'challenge' },

  // Celebrations
  { id: 'ce1', text: 'Просто хотел сказать — ты молодец, что работаешь над целью!', emoji: '🎉', category: 'celebrate' },
  { id: 'ce2', text: 'Целеустремлённость — твоя суперсила. Продолжай!', emoji: '✨', category: 'celebrate' },
  { id: 'ce3', text: 'Я горжусь тобой. Серьёзно. Не каждый дойдёт до планирования!', emoji: '🥹', category: 'celebrate' },
];

// ── Contextual messages based on plans ──────────────────────────────────────
function getContextualMessages(): TomiNotif[] {
  const msgs: TomiNotif[] = [];
  try {
    const stored = localStorage.getItem('stride_plans');
    if (!stored) return msgs;
    const plans = JSON.parse(stored);
    if (!Array.isArray(plans) || plans.length === 0) return msgs;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const hour = now.getHours();

    for (const plan of plans.slice(0, 3)) {
      const allTasks = plan.phases?.flatMap((p: any) => p.tasks) ?? [];
      const pending = allTasks.filter((t: any) => t.status !== 'done');
      const nextTask = pending[0];
      const progress = allTasks.length > 0
        ? Math.round((allTasks.filter((t: any) => t.status === 'done').length / allTasks.length) * 100)
        : 0;

      // Deadline-based context
      if (plan.deadline) {
        const deadline = new Date(plan.deadline);
        const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);

        if (daysLeft === 0 && nextTask) {
          msgs.push({
            id: `ctx_deadline_today_${plan.id}`,
            text: `Дедлайн по "${plan.goal.slice(0, 40)}" — СЕГОДНЯ! Осталось ${pending.length} задач. Финишируем?`,
            emoji: '🚨',
            category: 'context',
            action: 'Открыть план',
            priority: 100,
          });
        } else if (daysLeft === 1 && nextTask) {
          msgs.push({
            id: `ctx_deadline_tomorrow_${plan.id}`,
            text: `Завтра дедлайн "${plan.goal.slice(0, 35)}…". ${pending.length} задач ещё открыты — давай финишируем сегодня!`,
            emoji: '⏰',
            category: 'context',
            action: 'Посмотреть',
            priority: 90,
          });
        } else if (daysLeft > 0 && daysLeft <= 3 && nextTask) {
          msgs.push({
            id: `ctx_deadline_3days_${plan.id}`,
            text: `До дедлайна "${plan.goal.slice(0, 35)}…" — ${daysLeft} дня. Следующий шаг: "${nextTask.title?.slice(0, 40)}"`,
            emoji: '🎯',
            category: 'context',
            action: 'Начать',
            priority: 70,
          });
        }
      }

      // Progress-based context
      if (progress >= 80 && progress < 100 && nextTask) {
        msgs.push({
          id: `ctx_almost_done_${plan.id}`,
          text: `Ты на ${progress}% в плане "${plan.goal.slice(0, 35)}…"! Осталось совсем чуть-чуть. Финишный рывок?`,
          emoji: '🏁',
          category: 'context',
          action: 'Закрыть план',
          priority: 85,
        });
      }

      // Next task reminder (morning context)
      if (hour >= 9 && hour <= 11 && nextTask && progress < 80) {
        msgs.push({
          id: `ctx_morning_${plan.id}_${todayStr}`,
          text: `Доброе утро! Следующий шаг по "${plan.goal.slice(0, 30)}": "${nextTask.title?.slice(0, 45)}". Поехали?`,
          emoji: '☀️',
          category: 'context',
          action: 'Поехали!',
          priority: 60,
        });
      }
    }

    // Procrastination detection from patterns
    const patternRaw = localStorage.getItem('stride_patterns');
    if (patternRaw) {
      const patterns = JSON.parse(patternRaw);
      const postponeMap: Record<string, number> = {};
      for (const ev of patterns.taskEvents ?? []) {
        if (ev.action === 'postponed') postponeMap[ev.taskId] = (postponeMap[ev.taskId] ?? 0) + 1;
      }
      const chronicCount = Object.values(postponeMap).filter((c: any) => c >= 3).length;
      if (chronicCount > 0) {
        msgs.push({
          id: `ctx_procrastination_${chronicCount}`,
          text: `Томи заметил: ${chronicCount} ${chronicCount === 1 ? 'задача откладывалась' : 'задачи откладывались'} 3+ раза. Может, разобьём их на части?`,
          emoji: '🤔',
          category: 'procrastination',
          action: 'Разобраться',
          priority: 75,
        });
      }
    }

    // Missed 2+ days
    const lastVisitRaw = localStorage.getItem('stride_last_visit');
    const lastVisit = lastVisitRaw ? Number(lastVisitRaw) : null;
    const daysSinceVisit = lastVisit ? Math.floor((Date.now() - lastVisit) / 86400000) : 0;
    if (daysSinceVisit >= 2) {
      msgs.push({
        id: `ctx_missed_${daysSinceVisit}`,
        text: `Томи скучал ${daysSinceVisit} дня 🥺 Как дела? Вернёмся к задачам вместе?`,
        emoji: '🥺',
        category: 'missed',
        action: 'Я вернулся!',
        priority: 80,
      });
    }

    // Update last visit
    localStorage.setItem('stride_last_visit', String(Date.now()));

  } catch {}
  return msgs;
}

// Time-based greeting additions
function getTimeAwareMessages(): TomiNotif[] {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) {
    return [
      { id: 'ta1', text: 'Доброе утро! Отличный момент начать со сложной задачи ☀️', emoji: '☀️', category: 'greet' },
      { id: 'ta2', text: 'Утро — самое продуктивное время. Используй его!', emoji: '🌄', category: 'motivate' },
    ];
  }
  if (h >= 12 && h < 17) {
    return [
      { id: 'ta3', text: 'Послеобеденный слэш? Я помогу встряхнуться!', emoji: '☕', category: 'greet', action: 'Поговорить с Томи' },
      { id: 'ta4', text: 'День в разгаре. Проверь прогресс по задачам.', emoji: '📊', category: 'tip' },
    ];
  }
  if (h >= 17 && h < 22) {
    return [
      { id: 'ta5', text: 'Вечер — хорошее время подвести итоги дня 🌆', emoji: '🌆', category: 'tip' },
      { id: 'ta6', text: 'Что из запланированного уже сделано? Я рад слышать!', emoji: '🌙', category: 'greet', action: 'Поделиться' },
    ];
  }
  return [
    { id: 'ta7', text: 'Поздно работаешь? Не забывай об отдыхе 🌙', emoji: '🌙', category: 'tip' },
  ];
}

const COOLDOWN_KEY = 'stride_tomi_notif_last';
const COOLDOWN_MS  = 2.5 * 60 * 1000; // 2.5 minutes between bubbles
const FIRST_DELAY  = 8_000;            // appear 8 s after mount
const AUTO_DISMISS = 7_000;            // auto-dismiss after 7 s

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  /** Pass true while Tomi chat is open — suppresses bubbles */
  chatOpen: boolean;
  /** Called when user clicks the action CTA */
  onAction?: () => void;
}

export function TomiNotificationBubble({ chatOpen, onAction }: Props) {
  const [visible,  setVisible]  = useState(false);
  const [notif,    setNotif]    = useState<TomiNotif | null>(null);
  const [progress, setProgress] = useState(1); // 1 → 0 over AUTO_DISMISS ms
  const [mood,     setMood]     = useState<'happy' | 'excited'>('happy');

  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressRAF  = useRef<number>();
  const startedAt    = useRef<number>(0);
  const shownIds     = useRef<Set<string>>(new Set());

  // Pick a random message that hasn't been shown this session
  const pickMessage = useCallback((): TomiNotif | null => {
    const contextual = getContextualMessages();
    const pool = [...contextual, ...MESSAGES, ...getTimeAwareMessages()].filter(
      m => !shownIds.current.has(m.id)
    );
    if (pool.length === 0) {
      shownIds.current.clear(); // reset after all shown
      return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    }
    // Sort by priority (higher first), then pick top-priority one or random
    pool.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const topPriority = pool[0]?.priority ?? 0;
    const topPool = pool.filter(m => (m.priority ?? 0) >= topPriority - 10);
    return topPool[Math.floor(Math.random() * topPool.length)];
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearTimeout(dismissTimer.current);
    cancelAnimationFrame(progressRAF.current!);
    // Update cooldown timestamp
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  }, []);

  const show = useCallback(() => {
    if (chatOpen) return;
    const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return;

    const msg = pickMessage();
    if (!msg) return;

    shownIds.current.add(msg.id);
    setNotif(msg);
    setMood(
      msg.category === 'celebrate' || msg.category === 'challenge' || msg.category === 'context'
        ? 'excited'
        : 'happy'
    );
    setProgress(1);
    setVisible(true);
    startedAt.current = Date.now();

    // Animated countdown progress bar
    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      const p = Math.max(0, 1 - elapsed / AUTO_DISMISS);
      setProgress(p);
      if (p > 0) {
        progressRAF.current = requestAnimationFrame(tick);
      }
    };
    progressRAF.current = requestAnimationFrame(tick);

    // Auto-dismiss
    dismissTimer.current = setTimeout(() => setVisible(false), AUTO_DISMISS);
  }, [chatOpen, pickMessage]);

  // Schedule initial appearance, then repeat on a timer
  useEffect(() => {
    const initial = setTimeout(show, FIRST_DELAY);

    // After each bubble disappears, schedule the next one after a random interval
    const interval = setInterval(() => {
      if (!chatOpen) show();
    }, COOLDOWN_MS + Math.random() * 60_000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      clearTimeout(dismissTimer.current);
      cancelAnimationFrame(progressRAF.current!);
    };
  }, [show, chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suppress if chat opens while visible
  useEffect(() => {
    if (chatOpen && visible) dismiss();
  }, [chatOpen, visible, dismiss]);

  return (
    <AnimatePresence>
      {visible && notif && (
        <motion.div
          key={notif.id}
          className="fixed z-[60] flex items-end gap-3"
          style={{
            // On mobile: above tab-bar (58px) + Tomi FAB area (52px) + safe area bottom
            // On desktop: above Tomi chat button (1.25rem from bottom)
            bottom: 'clamp(8.5rem, calc(7.5rem + env(safe-area-inset-bottom)), 14rem)',
            right: '1rem',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {/* ── Speech bubble ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.75, y: 16, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.12 }}
            className="relative max-w-[260px] select-none"
          >
            {/* Bubble body */}
            <div
              className="rounded-2xl rounded-br-sm px-4 pt-3.5 pb-3 shadow-xl"
              style={{
                background: notif.category === 'context' || notif.category === 'missed'
                  ? 'rgba(13,26,54,0.98)'
                  : 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(20px)',
                border: notif.category === 'context' || notif.category === 'missed'
                  ? '1px solid rgba(29,78,216,0.35)'
                  : '1px solid rgba(29,78,216,0.15)',
                boxShadow: notif.category === 'context' || notif.category === 'missed'
                  ? '0 8px 32px rgba(29,78,216,0.3), 0 2px 8px rgba(0,0,0,0.2)'
                  : '0 8px 32px rgba(29,78,216,0.18), 0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {/* Category badge for contextual messages */}
              {(notif.category === 'context' || notif.category === 'procrastination' || notif.category === 'missed') && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8] animate-pulse" />
                  <span className="text-[#93bbfd] text-[10px] font-semibold">
                    {notif.category === 'missed' ? 'Томи скучал' :
                     notif.category === 'procrastination' ? 'Паттерн прокрастинации' :
                     'Напоминание'}
                  </span>
                </div>
              )}

              {/* Top row: emoji + dismiss */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-xl leading-none">{notif.emoji}</span>
                <button
                  onClick={dismiss}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 -mr-1 -mt-0.5 ${
                    notif.category === 'context' || notif.category === 'missed'
                      ? 'text-white/30 hover:text-white/60 hover:bg-white/10'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Text */}
              <p
                className={`text-[13px] leading-snug mb-2.5 ${
                  notif.category === 'context' || notif.category === 'missed'
                    ? 'text-white/85'
                    : 'text-slate-800'
                }`}
                style={{ fontWeight: 500 }}
              >
                {notif.text}
              </p>

              {/* CTA (optional) */}
              {notif.action && (
                <button
                  onClick={() => { dismiss(); onAction?.(); }}
                  className={`text-[12px] font-semibold transition-colors flex items-center gap-1 group mb-1 ${
                    notif.category === 'context' || notif.category === 'missed'
                      ? 'text-[#93bbfd] hover:text-white'
                      : 'text-[#1d4ed8] hover:text-[#1e40af]'
                  }`}
                >
                  <span className="group-hover:underline">{notif.action}</span>
                  <span className="group-hover:translate-x-0.5 transition-transform text-[10px]">→</span>
                </button>
              )}

              {/* Progress bar countdown */}
              <div className={`h-[3px] rounded-full overflow-hidden -mx-0.5 ${
                notif.category === 'context' || notif.category === 'missed' ? 'bg-white/8' : 'bg-slate-100'
              }`}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    background: 'linear-gradient(90deg, #2563eb, #1d4ed8)',
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>
            </div>

            {/* Tail triangle pointing down-right toward Tomi */}
            <div
              className="absolute -bottom-[6px] right-3 w-0 h-0"
              style={{
                borderLeft:  '7px solid transparent',
                borderRight: '7px solid transparent',
                borderTop:   notif.category === 'context' || notif.category === 'missed'
                  ? '7px solid rgba(13,26,54,0.98)'
                  : '7px solid rgba(255,255,255,0.97)',
                filter: 'drop-shadow(0 2px 2px rgba(29,78,216,0.08))',
              }}
            />
          </motion.div>

          {/* ── Tomi avatar — peeks up from below ── */}
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0 }}
            className="shrink-0 cursor-pointer"
            onClick={() => { dismiss(); onAction?.(); }}
            title="Открыть чат с Томи"
          >
            {/* Subtle glow behind mascot */}
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(29,78,216,0.4) 0%, transparent 65%)',
                margin: '-12px',
              }}
            />
            <TomiAvatar size={52} mood={mood} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}