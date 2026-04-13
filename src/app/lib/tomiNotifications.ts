/**
 * TomiNotifications — Web Notifications API integration for Tomi.
 * Sends browser notifications when user approaches risk zone.
 * Also handles notification permission requests.
 */
import { detectRiskSignals, type RiskSignals } from '../components/TomiPreventiveCoach';
import { computeLocalInsights } from './patternTracker';
import { telegramRiskNotify } from './api';
import { supabase } from './auth';

const NOTIF_PERMISSION_KEY = 'stride_notif_permission';
const NOTIF_LAST_SENT_KEY = 'stride_notif_last_sent';
const NOTIF_ENABLED_KEY = 'stride_notif_enabled';

// ── Permission ──────────────────────────────────────────────────────────────

export function isNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  try {
    const result = await Notification.requestPermission();
    try { localStorage.setItem(NOTIF_PERMISSION_KEY, result); } catch {}
    return result === 'granted';
  } catch {
    return false;
  }
}

// ── Enable/Disable ──────────────────────────────────────────────────────────

export function areNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIF_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(enabled: boolean) {
  try { localStorage.setItem(NOTIF_ENABLED_KEY, String(enabled)); } catch {}
}

// ── Send notification ───────────────────────────────────────────────────────

function canSendNotification(): boolean {
  if (!isNotificationsSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (!areNotificationsEnabled()) return false;

  // Rate limit: max once per 6 hours
  try {
    const last = localStorage.getItem(NOTIF_LAST_SENT_KEY);
    if (last && Date.now() - Number(last) < 6 * 60 * 60 * 1000) return false;
  } catch {}

  return true;
}

function markNotificationSent() {
  try { localStorage.setItem(NOTIF_LAST_SENT_KEY, String(Date.now())); } catch {}
}

interface TomiNotification {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

function sendNotification(notif: TomiNotification) {
  if (!canSendNotification()) return;

  try {
    const n = new Notification(notif.title, {
      body: notif.body,
      icon: notif.icon || '/favicon.ico',
      tag: notif.tag || 'tomi-notification',
      requireInteraction: notif.requireInteraction ?? false,
      badge: '/favicon.ico',
    });

    n.onclick = () => {
      window.focus();
      n.close();
    };

    markNotificationSent();
  } catch (err) {
    console.error('Notification send error:', err);
  }
}

// ── Telegram notification (fire-and-forget alongside browser notifs) ────────

async function sendTelegramRiskNotification(risk: RiskSignals, streak?: number) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await telegramRiskNotify(session.access_token, {
      riskLevel: risk.level,
      reasons: risk.reasons,
      streak,
    });
  } catch {
    // Silent — Telegram is best-effort
  }
}

// ── Risk-based notifications ────────────────────────────────────────────────

const RISK_MESSAGES: Record<string, TomiNotification[]> = {
  critical: [
    {
      title: 'Томи видит тревожные сигналы',
      body: 'Продуктивность резко упала. Зайди в Vecto — я помогу упростить задачи и вернуться в поток.',
      tag: 'tomi-risk-critical',
      requireInteraction: true,
    },
    {
      title: 'Эй, ты ещё здесь?',
      body: 'Томи заметил паузу. Может, стоит упростить план? Зайди, я предложу варианты.',
      tag: 'tomi-risk-critical',
      requireInteraction: true,
    },
  ],
  high: [
    {
      title: 'Томи беспокоится за тебя',
      body: 'Несколько сигналов указывают на возможный спад. Давай посмотрим, что можно облегчить.',
      tag: 'tomi-risk-high',
    },
    {
      title: 'Мини-чекин от Томи',
      body: 'Заметил, что ты откладываешь задачи чаще обычного. Может, некоторые можно упростить?',
      tag: 'tomi-risk-high',
    },
  ],
  medium: [
    {
      title: 'Напоминание от Томи',
      body: 'Маленький шаг лучше, чем стоять на месте. Попробуй завершить хотя бы одну задачу сегодня.',
      tag: 'tomi-risk-medium',
    },
  ],
};

// ── Streak notifications ────────────────────────────────────────────────────

const STREAK_MESSAGES = [
  { title: 'Не сломай стрик!', body: 'Ты на серии уже {streak} дней! Завершишь хотя бы одну задачу сегодня?' },
  { title: 'Стрик в опасности!', body: 'Ещё нет завершённых задач сегодня. Поддержи серию в {streak} дней!' },
];

// ── Check and send ──────────────────────────────────────────────────────────

export function checkAndSendRiskNotification(): boolean {
  const risk = detectRiskSignals();

  // Only send for medium+ risk
  if (risk.level === 'none' || risk.level === 'low') return false;

  // Always try Telegram (it has its own rate-limit server-side)
  sendTelegramRiskNotification(risk);

  // Browser notification (has its own local rate-limit)
  if (canSendNotification()) {
    const messages = RISK_MESSAGES[risk.level];
    if (messages && messages.length > 0) {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      sendNotification(msg);
    }
  }
  return true;
}

export function checkAndSendStreakNotification(): boolean {
  const insights = computeLocalInsights();

  // Only remind if streak > 3 and it's afternoon
  if (insights.currentStreak < 3) return false;

  const hour = new Date().getHours();
  if (hour < 14 || hour > 20) return false;

  // Check if any tasks completed today
  const today = new Date().toISOString().split('T')[0];
  const { taskEvents } = (() => {
    try {
      const raw = localStorage.getItem('stride_patterns');
      if (!raw) return { taskEvents: [] };
      return JSON.parse(raw);
    } catch { return { taskEvents: [] }; }
  })();

  const todayCompletions = taskEvents?.filter(
    (e: any) => e.date === today && e.action === 'completed'
  );

  if (todayCompletions && todayCompletions.length > 0) return false;

  // Telegram (server-side rate-limit)
  sendTelegramRiskNotification(detectRiskSignals(), insights.currentStreak);

  // Browser notification
  if (canSendNotification()) {
    const msg = STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
    sendNotification({
      title: msg.title,
      body: msg.body.replace('{streak}', String(insights.currentStreak)),
      tag: 'tomi-streak',
    });
  }
  return true;
}

// ── Background interval checker ─────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTomiNotificationChecker() {
  if (intervalId) return; // Already running

  // Check every 2 hours
  intervalId = setInterval(() => {
    // Try risk notification first, then streak
    if (!checkAndSendRiskNotification()) {
      checkAndSendStreakNotification();
    }
  }, 2 * 60 * 60 * 1000);

  // Also run an initial check after 30 minutes (give user time to work)
  setTimeout(() => {
    if (!checkAndSendRiskNotification()) {
      checkAndSendStreakNotification();
    }
  }, 30 * 60 * 1000);
}

export function stopTomiNotificationChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}