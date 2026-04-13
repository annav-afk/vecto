/**
 * Cloud API layer — wraps all server calls.
 * Every function throws on error so callers can handle rollback.
 */
import { Plan } from './types';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

async function req<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...init } = options;
  const res = await fetch(`${SERVER}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? publicAnonKey}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`) as Error & { code?: string };
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signUpCloud(email: string, password: string, name: string) {
  await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

// ── Plans ────────────────────────────────────────────────────────────────────
export async function getCloudPlans(token: string): Promise<Plan[]> {
  const data = await req<{ plans: Plan[] }>('/plans', { token });
  return data.plans ?? [];
}

export async function saveCloudPlan(plan: Plan, token: string): Promise<void> {
  await req('/plans', {
    method: 'POST',
    token,
    body: JSON.stringify({ plan }),
  });
}

export async function deleteCloudPlan(planId: string, token: string): Promise<void> {
  await req(`/plans/${planId}`, { method: 'DELETE', token });
}

// ── Usage ─────────────────────────────────────────────────────────────────────
export async function getCloudUsage(token: string): Promise<number> {
  const data = await req<{ count: number }>('/usage', { token });
  return data.count ?? 0;
}

export async function incrementCloudUsage(token: string): Promise<void> {
  await req('/usage/increment', { method: 'POST', token });
}

// ── AI ────────────────────────────────────────────────────────────────────────
export async function aiPanicMode(payload: object): Promise<any> {
  return req('/ai/panic-mode', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiMorningBriefing(payload: object): Promise<any> {
  return req('/ai/morning-briefing', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiPhaseRetro(payload: object): Promise<any> {
  return req('/ai/phase-retro', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiParseTask(payload: object): Promise<any> {
  return req('/ai/parse-task', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiExpandPhase(payload: object): Promise<any> {
  return req('/ai/expand-phase', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiWhatIf(payload: object): Promise<any> {
  return req('/ai/what-if', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiSuggestHabits(payload: object): Promise<any> {
  return req('/ai/suggest-habits', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiSmartReplan(payload: object): Promise<any> {
  return req('/ai/smart-replan', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiDigest(payload: object): Promise<any> {
  return req('/ai/digest', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiSmartReminderTimes(payload: object): Promise<any> {
  return req('/ai/smart-reminder-times', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiForecast(payload: object): Promise<any> {
  return req('/ai/forecast', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiTomiInsights(payload: { patternSummary: string; question?: string }): Promise<any> {
  return req('/ai/tomi-insights', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiTomiPreventive(payload: {
  patternSummary: string;
  riskSignals: { level: string; score: number; reasons: string[]; daysUntilDropoff: number | null };
  pendingTasks: { id: string; title: string; priority: string; difficulty?: number; status: string; phase: string; durationHours: number }[];
  planGoal: string;
}): Promise<any> {
  return req('/ai/tomi-preventive', { method: 'POST', body: JSON.stringify(payload) });
}

// ── Telegram Bot Integration ──────────────────────────────────────────────────

export async function telegramLink(token: string): Promise<{ code: string }> {
  return req('/telegram/link', { method: 'POST', token });
}

export async function telegramStatus(token: string): Promise<{
  linked: boolean;
  chatId?: number;
  username?: string;
  firstName?: string;
  linkedAt?: string;
}> {
  return req('/telegram/status', { token });
}

export async function telegramUnlink(token: string): Promise<{ ok: boolean }> {
  return req('/telegram/unlink', { method: 'POST', token });
}

export async function telegramSend(token: string, message: string, type: string): Promise<{ ok: boolean }> {
  return req('/telegram/send', { method: 'POST', body: JSON.stringify({ message, type }), token });
}

export async function telegramRiskNotify(token: string, payload: {
  riskLevel: string;
  reasons: string[];
  streak?: number;
}): Promise<{ sent: boolean; reason?: string }> {
  return req('/telegram/risk-notify', { method: 'POST', body: JSON.stringify(payload), token });
}

// ── Plan Feedback ─────────────────────────────────────────────────────────────
export async function savePlanFeedbackCloud(
  planId: string,
  vote: 'up' | 'down',
  token: string,
  comment?: string,
  planGoal?: string,
): Promise<void> {
  try {
    const existing = await getCloudUserData('plan_feedbacks', token) ?? [];
    const filtered = Array.isArray(existing) ? existing.filter((e: any) => e.planId !== planId) : [];
    filtered.push({ planId, vote, comment: comment || null, planGoal: planGoal || null, ts: Date.now() });
    await setCloudUserData('plan_feedbacks', filtered.slice(-200), token);
  } catch (err) {
    console.warn('[API] savePlanFeedbackCloud failed:', err);
  }
}

export async function getCloudPlanFeedbacks(token: string): Promise<any[]> {
  try {
    const data = await getCloudUserData('plan_feedbacks', token);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Share comments (peer feedback) ────────────────────────────────────────────
export async function addShareComment(shareId: string, payload: object): Promise<any> {
  return req(`/share/${shareId}/comments`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function getShareComments(shareId: string): Promise<any[]> {
  const data = await req<{ comments: any[] }>(`/share/${shareId}/comments`);
  return data.comments ?? [];
}

// ── Digest email ──────────────────────────────────────────────────────────────
export async function sendDigestEmail(payload: {
  email: string;
  planGoal: string;
  doneCount: number;
  overdueCount: number;
  forecastDate: string | null;
  totalHours: number;
}, token?: string): Promise<void> {
  await req('/digest/email', { method: 'POST', body: JSON.stringify(payload), token });
}

// ── User Data (cloud persistence) ─────────────────────────────────────────────
export type UserDataKey = 'activity' | 'settings' | 'chat_history' | 'onboarding' | 'mood_journal' | 'gamification' | 'patterns' | 'plan_feedbacks';

export async function getCloudUserData(key: UserDataKey, token: string): Promise<any> {
  const data = await req<{ value: any }>(`/user/data/${key}`, { token });
  return data.value;
}

export async function setCloudUserData(key: UserDataKey, value: any, token: string): Promise<void> {
  await req(`/user/data/${key}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ value }),
  });
}

export async function getAllCloudUserData(token: string): Promise<Record<string, any>> {
  const data = await req<{ data: Record<string, any> }>('/user/data', { token });
  return data.data ?? {};
}