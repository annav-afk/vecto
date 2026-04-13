/**
 * Global timer context — tracks the one active task timer across the whole app.
 * - Reads active timer from localStorage every second (polling).
 * - Provides stopTimer() that updates localStorage and fires a custom event
 *   so PlanPage can refresh its local state without prop drilling.
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getPlans } from './storage';
import { updateTask } from './storage';

export interface ActiveTimer {
  taskId:    string;
  taskTitle: string;
  planId:    string;
  startTime: string; // ISO string
}

interface TimerCtx {
  active:    ActiveTimer | null;
  elapsed:   number;           // seconds since startTime
  stopTimer: () => void;
}

const Ctx = createContext<TimerCtx>({ active: null, elapsed: 0, stopTimer: () => {} });

export function useTimer() { return useContext(Ctx); }

export function TimerProvider({ children }: { children: ReactNode }) {
  const [active, setActive]   = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick]       = useState(0);

  // Poll localStorage every second to find a running timer
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const plans = getPlans();
    let found: ActiveTimer | null = null;
    for (const plan of plans) {
      for (const phase of plan.phases) {
        for (const task of phase.tasks) {
          if (task.timer_start) {
            found = {
              taskId:    task.id,
              taskTitle: task.title,
              planId:    plan.id,
              startTime: task.timer_start,
            };
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    setActive(found);
    if (found) {
      const secs = Math.floor((Date.now() - new Date(found.startTime).getTime()) / 1000);
      setElapsed(secs);
    } else {
      setElapsed(0);
    }
  }, [tick]);

  const stopTimer = useCallback(() => {
    if (!active) return;
    // Find the task in storage and stop it
    const plans = getPlans();
    const plan  = plans.find(p => p.id === active.planId);
    if (!plan) return;
    const task = plan.phases.flatMap(p => p.tasks).find(t => t.id === active.taskId);
    if (!task) return;
    const elapsedSec = Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
    updateTask(active.planId, active.taskId, {
      timer_start:     undefined,
      tracked_seconds: (task.tracked_seconds ?? 0) + elapsedSec,
    });
    setActive(null);
    setElapsed(0);
    // Notify PlanPage to refresh (if open)
    window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: active.planId } }));
  }, [active]);

  return (
    <Ctx.Provider value={{ active, elapsed, stopTimer }}>
      {children}
    </Ctx.Provider>
  );
}

export function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
