/**
 * Cloud Sync — bidirectional sync between localStorage and Supabase KV.
 *
 * Strategy:
 * - On login:  pull ALL cloud data → merge with local → save merged to both
 * - On change: save to local immediately + debounced async push to cloud
 * - Works without auth (local-only fallback)
 *
 * Categories synced:
 *   activity      — heatmap data
 *   settings      — sound, TTS, Tomi personality, etc.
 *   chat_history  — Tomi conversations
 *   onboarding    — tour / checklist flags
 *   gamification  — XP, level, achievements
 */

import { setCloudUserData, getAllCloudUserData, type UserDataKey } from './api';

// Inlined to avoid circular dependency with activity.ts
interface DayActivity { date: string; count: number; }

// ── Local keys ──────────────────────────────────────────────────────────────
const LS: Record<string, string> = {
  activity:       'stride_activity',
  settings:       'stride_settings',
  chat_history:   'stride_chat_history',
  onboarding:     'stride_onboarding',
  gamification:   'stride_gamification',
  patterns:       'stride_patterns',
};

// ── Debounce map (per-category timers) ──────────────────────────────────────
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_MS = 2000;

let _token: string | null = null;

/** Must be called whenever auth state changes */
export function setCloudToken(token: string | null) {
  _token = token;
}

// ── Read/write local ────────────────────────────────────────────────────────
function localGet(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function localSet(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Push single category to cloud (debounced) ───────────────────────────────
function pushToCloud(category: UserDataKey) {
  if (!_token) return;
  const token = _token;

  clearTimeout(debounceTimers[category]);
  debounceTimers[category] = setTimeout(async () => {
    try {
      const lsKey = LS[category] || `stride_${category}`;
      const value = localGet(lsKey);
      if (value !== null) {
        await setCloudUserData(category, value, token);
        console.log(`[CloudSync] Pushed ${category} to cloud`);
      }
    } catch (err) {
      console.warn(`[CloudSync] Failed to push ${category}:`, err);
    }
  }, DEBOUNCE_MS);
}

// ── Public API: read/write with auto-sync ────────────────────────────────────

/** Get data locally (instant) */
export function getData(category: UserDataKey): any {
  const lsKey = LS[category] || `stride_${category}`;
  return localGet(lsKey);
}

/** Save data locally + push to cloud */
export function setData(category: UserDataKey, value: any) {
  const lsKey = LS[category] || `stride_${category}`;
  localSet(lsKey, value);
  pushToCloud(category);
}

// ── Settings helpers (fine-grained key/value inside "settings" category) ─────

export interface UserSettings {
  sound: boolean;
  tts: boolean;
  tomi_personality: string;
  briefing_last: string;
  [key: string]: any;
}

export function getSettings(): UserSettings {
  const stored = getData('settings');
  return stored ?? { sound: true, tts: false, tomi_personality: 'soft', briefing_last: '' };
}

export function updateSetting(key: string, value: any) {
  const settings = getSettings();
  settings[key] = value;
  setData('settings', settings);
}

// ── Activity sync helpers ────────────────────────────────────────���───────────

export function getActivityData(): DayActivity[] {
  return getData('activity') ?? [];
}

export function setActivityData(data: DayActivity[]) {
  setData('activity', data);
}

// ── Chat history sync ────────────────────────────────────────────────────────

export function getChatHistory(): any[] {
  return getData('chat_history') ?? [];
}

export function setChatHistory(msgs: any[]) {
  setData('chat_history', msgs);
}

// ── Onboarding sync ─────────────────────────────────────────────────────────

export interface OnboardingState {
  checklist: Record<string, boolean>;
  toured: boolean;
  welcome_first: boolean;
  welcome_last_seen: number;
  longpress_hint: boolean;
  bulk_select_hint: boolean;
  [key: string]: any;
}

export function getOnboarding(): OnboardingState {
  return getData('onboarding') ?? {
    checklist: {},
    toured: false,
    welcome_first: false,
    welcome_last_seen: 0,
    longpress_hint: false,
    bulk_select_hint: false,
  };
}

export function updateOnboarding(partial: Partial<OnboardingState>) {
  const current = getOnboarding();
  setData('onboarding', { ...current, ...partial });
}

// ── Full initial sync on login ──────────────────────────────────────────────

/**
 * Called once when a user logs in.
 * Pulls all categories from cloud and merges with local data.
 * Cloud data wins for most categories; activity merges additively.
 */
export async function pullAndMerge(token: string): Promise<void> {
  _token = token;

  try {
    const cloud = await getAllCloudUserData(token);
    console.log('[CloudSync] Pulled cloud data:', Object.keys(cloud).filter(k => cloud[k] !== null));

    // ── Activity: merge additively (union of days, take max count per day) ──
    if (cloud.activity) {
      const local: DayActivity[] = localGet(LS.activity) ?? [];
      const cloudArr: DayActivity[] = cloud.activity ?? [];
      const merged = mergeActivity(local, cloudArr);
      localSet(LS.activity, merged);
      if (merged.length > cloudArr.length) {
        setCloudUserData('activity', merged, token).catch(() => {});
      }
    }

    // ── Settings: cloud wins, but merge keys ──
    if (cloud.settings) {
      const local = localGet(LS.settings) ?? {};
      const merged = { ...local, ...cloud.settings };
      localSet(LS.settings, merged);
      // Backfill legacy localStorage keys
      if (merged.sound !== undefined) localStorage.setItem('stride_sound', merged.sound ? '1' : '0');
    }

    // ── Chat history: take whichever is longer ──
    if (cloud.chat_history) {
      const local: any[] = localGet(LS.chat_history) ?? [];
      const cloudMsgs: any[] = cloud.chat_history ?? [];
      const winner = cloudMsgs.length >= local.length ? cloudMsgs : local;
      localSet(LS.chat_history, winner);
      if (winner === local && local.length > cloudMsgs.length) {
        setCloudUserData('chat_history', local, token).catch(() => {});
      }
    }

    // ── Onboarding: merge (any flag set = stays set) ──
    if (cloud.onboarding) {
      const local = localGet(LS.onboarding) ?? {};
      const merged = mergeOnboarding(local, cloud.onboarding);
      localSet(LS.onboarding, merged);
      // Backfill legacy keys
      if (merged.toured) localStorage.setItem('stride_onboarding_toured', '1');
      if (merged.longpress_hint) localStorage.setItem('stride_longpress_hint_seen', '1');
      if (merged.bulk_select_hint) localStorage.setItem('stride_bulk_select_hint_seen', '1');
      if (merged.checklist) localStorage.setItem('stride_onboarding_checklist', JSON.stringify(merged.checklist));
    }

    // ── Gamification: cloud wins ──
    if (cloud.gamification) {
      localSet(LS.gamification, cloud.gamification);
    }

    // ── Push any local-only data that cloud is missing ──
    for (const key of Object.keys(LS)) {
      if (cloud[key] === null || cloud[key] === undefined) {
        const local = localGet(LS[key]);
        if (local) {
          setCloudUserData(key as UserDataKey, local, token).catch(() => {});
          console.log(`[CloudSync] Pushed local-only ${key} to cloud`);
        }
      }
    }

  } catch (err) {
    console.warn('[CloudSync] Pull & merge failed:', err);
  }
}

// ── Merge helpers ────────────────────────────────────────────────────────────

function mergeActivity(local: DayActivity[], cloud: DayActivity[]): DayActivity[] {
  const map: Record<string, number> = {};
  for (const d of [...cloud, ...local]) {
    map[d.date] = Math.max(map[d.date] ?? 0, d.count);
  }
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeOnboarding(local: any, cloud: any): OnboardingState {
  return {
    checklist: { ...(local.checklist ?? {}), ...(cloud.checklist ?? {}) },
    toured: !!(local.toured || cloud.toured),
    welcome_first: !!(local.welcome_first || cloud.welcome_first),
    welcome_last_seen: Math.max(local.welcome_last_seen ?? 0, cloud.welcome_last_seen ?? 0),
    longpress_hint: !!(local.longpress_hint || cloud.longpress_hint),
    bulk_select_hint: !!(local.bulk_select_hint || cloud.bulk_select_hint),
  };
}
