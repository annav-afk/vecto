/**
 * AI Plan Generator — calls the Stride backend (Supabase Edge Function),
 * which in turn calls the AI proxy and returns a structured Plan.
 * Falls back to direct proxy call, then to the local mock generator on any error.
 */
import { Plan } from './types';
import { generatePlan as mockGeneratePlan } from './mockAI';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

// Request timeout — if AI takes longer than 25s, return error
const AI_TIMEOUT_MS = 25_000;

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Ты — Vecto AI, эксперт по планированию проектов.
Сгенерируй подробный план проекта в виде JSON-объекта на РУССКОМ языке.
Отвечай ТОЛЬКО валидным JSON без markdown-обёрток и пояснений.
JSON должен соответствовать этой структуре:
{"id":string,"goal":string,"deadline":string,"hours_per_week":number,"total_days":number,"created_at":string,"phases":[{"id":string,"name":string,"duration_days":number,"color":string,"start_date":string,"end_date":string,"tasks":[{"id":string,"phase_id":string,"title":string,"description":string,"duration_hours":number,"priority":"high"|"medium"|"low","depends_on":[],"status":"todo","start_date":string,"end_date":string,"recurring":false,"tracked_seconds":0,"comments":[],"tags":[],"subtasks":[{"id":string,"title":string,"done":false}]}]}]}
Правила: 4-5 фаз, 3-5 задач в каждой, у каждой задачи 2-3 подзадачи.
Все названия фаз, задач и подзадач — на русском языке.
Цвета (по очереди): #1d4ed8,#2563eb,#1e40af,#10b981,#f59e0b,#ef4444.
Сегодня: ${today}.`;
}

function normalizePlan(plan: any, hoursPerWeek: number): Plan {
  plan.phases = (plan.phases ?? []).map((phase: any) => ({
    ...phase,
    tasks: (phase.tasks ?? []).map((task: any) => ({
      ...task,
      subtasks: task.subtasks ?? (task.checklist?.map((c: any) => ({
        id: c.id ?? Math.random().toString(36).slice(2),
        title: c.title ?? c.text ?? '',
        done: c.done ?? false,
      })) ?? []),
      depends_on: task.depends_on ?? [],
      tags: task.tags ?? [],
      comments: task.comments ?? [],
      tracked_seconds: task.tracked_seconds ?? 0,
    })),
  }));
  if (!plan.id) plan.id = Math.random().toString(36).slice(2, 10);
  if (!plan.created_at) plan.created_at = new Date().toISOString();
  if (!plan.hours_per_week) plan.hours_per_week = hoursPerWeek;
  if (!plan.total_days) plan.total_days = 90;
  return plan as Plan;
}

// ── Public API ─────────────────────────────────────────────────────────────────
/**
 * Generate a plan by calling the Stride AI backend.
 * Falls back to direct proxy, then to mock generator.
 */
export async function generatePlanAI(
  goal: string,
  deadline: string,
  hoursPerWeek: number,
): Promise<Plan> {
  // ── 1. Try edge function ────────────────────────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    console.warn('[Vecto AI] Edge function timed out after 25s');
  }, AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${SERVER_URL}/generate-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ goal, deadline, hours_per_week: hoursPerWeek }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (!json.error && json.plan && Array.isArray(json.plan.phases) && json.plan.phases.length > 0) {
        console.log(`[Vecto AI] Plan via edge function — ${json.plan.phases.length} phases`);
        return normalizePlan(json.plan, hoursPerWeek);
      }
      console.warn(`[Vecto AI] Edge function returned error: ${json.error} — trying direct proxy`);
    } else {
      console.warn(`[Vecto AI] Edge function ${res.status} — trying direct proxy`);
    }
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn(`[Vecto AI] Edge function unreachable (${err?.message}) — trying direct proxy`);
  }

  // ── 2. Local mock generator (direct proxy disabled) ──────────────────────────
  console.warn('[Vecto AI] Edge function failed, using local mock generator');
  return mockGeneratePlan(goal, deadline, hoursPerWeek);
}