/**
 * Vecto — Tomi Notification System
 * Registers a Service Worker and provides helpers to show / schedule
 * proactive notifications about tasks and deadlines.
 */

import { getPlans } from './storage';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export const NOTIF_PERMISSION_KEY = 'vecto_notif_permission';
export const NOTIF_LAST_CHECK_KEY = 'vecto_notif_last_check';
export const NOTIF_ENABLED_KEY    = 'vecto_notif_enabled';

// ── SW Registration ───────────────────────────────────────────────────────────
let _swReg: ServiceWorkerRegistration | null = null;

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    _swReg = reg;
    // Try to register periodic background sync for Tomi checks
    try {
      if ('periodicSync' in reg) {
        await (reg as any).periodicSync.register('tomi-check', { minInterval: 30 * 60 * 1000 });
      }
    } catch { /* periodicSync not supported — fallback handled by TomiNotifications interval */ }
    // Listen for SW messages (background sync triggers)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TOMI_CHECK') {
        runTomiCheck();
        maybeSendMorningBriefing();
      }
    });
    return reg;
  } catch (err) {
    console.warn('[Vecto SW] Registration failed:', err);
    return null;
  }
}

export async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (_swReg) return _swReg;
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    _swReg = reg;
    return reg;
  } catch { return null; }
}

// ── Permission ────────────────────────────────────────────────────────────────
export function notifSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function notifPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestPermission(): Promise<boolean> {
  if (!notifSupported()) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  localStorage.setItem(NOTIF_PERMISSION_KEY, perm);
  return perm === 'granted';
}

export function isNotifEnabled(): boolean {
  return localStorage.getItem(NOTIF_ENABLED_KEY) === 'true' &&
    notifPermission() === 'granted';
}

export function setNotifEnabled(val: boolean) {
  localStorage.setItem(NOTIF_ENABLED_KEY, String(val));
}

// ── Show notification ─────────────────────────────────────────────────────────
export interface NotifPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
}

export async function showNotification(payload: NotifPayload): Promise<void> {
  if (notifPermission() !== 'granted') return;
  const reg = await getSWRegistration();
  if (reg) {
    await reg.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag ?? 'tomi',
      data: { url: payload.url ?? '/dashboard' },
      vibrate: [80, 40, 80],
    } as NotificationOptions);
  } else {
    // Fallback to basic Notification API
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      tag: payload.tag,
    });
  }
}

// ── Tomi proactive checks ─────────────────────────────────────────────────────
const MIN_INTERVAL_MS = 30 * 60 * 1000; // fire at most once per 30 min

function getLastCheck(): number {
  return parseInt(localStorage.getItem(NOTIF_LAST_CHECK_KEY) ?? '0', 10);
}
function setLastCheck() {
  localStorage.setItem(NOTIF_LAST_CHECK_KEY, String(Date.now()));
}

export async function runTomiCheck(): Promise<void> {
  if (!isNotifEnabled()) return;
  if (Date.now() - getLastCheck() < MIN_INTERVAL_MS) return;
  setLastCheck();

  const plans = getPlans();
  if (!plans.length) return;

  const today = startOfDay(new Date());
  let overdueTotal = 0;
  let dueTodayTotal = 0;
  let dueIn3Total   = 0;

  for (const plan of plans) {
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.status === 'done') continue;
        const daysLeft = differenceInDays(startOfDay(parseISO(task.end_date)), today);
        if (daysLeft < 0)       overdueTotal++;
        else if (daysLeft === 0) dueTodayTotal++;
        else if (daysLeft <= 3)  dueIn3Total++;
      }
    }
  }

  // Pick the most urgent notification
  if (overdueTotal > 0) {
    await showNotification({
      title: '⚠️ Томи: просроченные задачи',
      body: `У тебя ${overdueTotal} просроченных ${overdueTotal === 1 ? 'задача' : 'задач'}. Давай разберёмся!`,
      tag: 'tomi-overdue',
      url: '/dashboard',
    });
    return;
  }

  if (dueTodayTotal > 0) {
    await showNotification({
      title: '📅 Томи: дедлайн сегодня',
      body: `${dueTodayTotal} ${dueTodayTotal === 1 ? 'задача должна' : 'задачи должны'} быть выполнен${dueTodayTotal === 1 ? 'а' : 'ы'} сегодня. Ты готов?`,
      tag: 'tomi-today',
      url: '/dashboard',
    });
    return;
  }

  if (dueIn3Total > 0) {
    await showNotification({
      title: '🎯 Томи: скоро дедлайн',
      body: `${dueIn3Total} ${dueIn3Total === 1 ? 'задача' : 'задач'} со сроком через 1–3 дня. Не откладывай!`,
      tag: 'tomi-soon',
      url: '/dashboard',
    });
  }
}

// ── Morning briefing ──────────────────────────────────────────────────────────
const MORNING_BRIEFING_KEY = 'vecto_last_morning';

export async function maybeSendMorningBriefing(): Promise<void> {
  if (!isNotifEnabled()) return;
  const lastDate = localStorage.getItem(MORNING_BRIEFING_KEY);
  const todayStr  = new Date().toISOString().slice(0, 10);
  if (lastDate === todayStr) return;

  const hour = new Date().getHours();
  if (hour < 8 || hour > 11) return; // only 8-11 AM

  localStorage.setItem(MORNING_BRIEFING_KEY, todayStr);

  const plans = getPlans();
  const today = startOfDay(new Date());
  let todayTasks = 0;

  for (const plan of plans) {
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.status === 'done') continue;
        if (differenceInDays(startOfDay(parseISO(task.end_date)), today) === 0) todayTasks++;
      }
    }
  }

  const greetings = [
    'Доброе утро! Готов к продуктивному дню?',
    'С добрым утром! Новый день — новые возможности.',
    'Привет! Томи уже в строю, а ты?',
    'Доброе утро! Сегодня отличный день, чтобы закрыть задачи.',
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  await showNotification({
    title: '🌅 Томи: доброе утро!',
    body: todayTasks > 0
      ? `${greeting} Сегодня тебя ждёт ${todayTasks} ${todayTasks === 1 ? 'задача' : 'задач'}.`
      : `${greeting} Пока задач на сегодня нет — возможно, стоит запланировать?`,
    tag: 'tomi-morning',
    url: '/dashboard',
  });
}