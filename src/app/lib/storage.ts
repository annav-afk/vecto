/**
 * Local plan storage — keeps plans in localStorage as immediate cache.
 * Cloud sync happens in DashboardPage / PlanPage via api.ts functions.
 * Usage tracking also syncs to cloud via cloudSync settings.
 */
import { Plan, Task } from './types';
import { updateSetting } from './cloudSync';

const PLANS_KEY = 'stride_plans';
const USAGE_KEY = 'stride_usage';

export function getPlans(): Plan[] {
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getPlanById(id: string): Plan | null {
  const plans = getPlans();
  return plans.find(p => p.id === id) || null;
}

export function savePlan(plan: Plan): void {
  try {
    const plans = getPlans();
    const existing = plans.findIndex(p => p.id === plan.id);
    if (existing >= 0) {
      plans[existing] = plan;
    } else {
      plans.unshift(plan);
    }
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  } catch (err) {
    console.warn('[Storage] Failed to save plan:', err);
    throw err; // re-throw so caller knows it failed
  }
}

export function deletePlan(id: string): void {
  try {
    const plans = getPlans().filter(p => p.id !== id);
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  } catch (err) {
    console.warn('[Storage] Failed to delete plan:', err);
  }
}

export function updateTask(planId: string, taskId: string, updates: Partial<Task>): Plan | null {
  const plan = getPlanById(planId);
  if (!plan) return null;

  const updated: Plan = {
    ...plan,
    phases: plan.phases.map(phase => ({
      ...phase,
      tasks: phase.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    })),
  };

  savePlan(updated);
  return updated;
}

export function getMonthlyUsage(): number {
  try {
    const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{"month":"","count":0}');
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (data.month !== currentMonth) return 0;
    return data.count;
  } catch {
    return 0;
  }
}

export function incrementUsage(): void {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const count = getMonthlyUsage() + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify({ month: currentMonth, count }));
    // Also push usage to cloud settings for cross-device
    updateSetting('usage', { month: currentMonth, count });
  } catch (err) {
    console.warn('[Storage] Failed to increment usage:', err);
  }
}
