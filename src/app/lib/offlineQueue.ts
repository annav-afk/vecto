/**
 * Offline queue — persists failed cloud operations in localStorage
 * and retries them when the network is restored.
 */
import { Plan } from './types';

const QUEUE_KEY = 'stride_offline_queue';

export type QueueOpType = 'save_plan' | 'delete_plan' | 'increment_usage' | 'save_user_data';

export interface QueueItem {
  id: string;
  type: QueueOpType;
  payload: any;
  timestamp: number;
  retries: number;
}

function getQueue(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

function saveQueue(q: QueueItem[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}

export function enqueue(type: QueueOpType, payload: any) {
  const q = getQueue();
  q.push({ id: Math.random().toString(36).slice(2), type, payload, timestamp: Date.now(), retries: 0 });
  saveQueue(q);
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter(i => i.id !== id));
}

export function peekQueue(): QueueItem[] {
  return getQueue();
}

export function getQueueSize(): number {
  return getQueue().length;
}

/**
 * Flush the queue using the provided API functions.
 * Safe to call multiple times; deduplicates by id.
 */
export async function flushQueue(
  token: string,
  ops: {
    savePlan: (plan: Plan, token: string) => Promise<void>;
    deletePlan: (planId: string, token: string) => Promise<void>;
    incrementUsage: (token: string) => Promise<void>;
    saveUserData: (data: any, token: string) => Promise<void>;
  }
): Promise<{ flushed: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'save_plan') await ops.savePlan(item.payload as Plan, token);
      else if (item.type === 'delete_plan') await ops.deletePlan(item.payload as string, token);
      else if (item.type === 'increment_usage') await ops.incrementUsage(token);
      else if (item.type === 'save_user_data') await ops.saveUserData(item.payload, token);
      dequeue(item.id);
      flushed++;
    } catch {
      // Increment retry count, remove if too many
      const q = getQueue().map(i => i.id === item.id ? { ...i, retries: i.retries + 1 } : i);
      saveQueue(q.filter(i => i.retries < 5));
      failed++;
    }
  }

  return { flushed, failed };
}