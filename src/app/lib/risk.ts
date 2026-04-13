import { Task } from './types';
import { differenceInDays, parseISO } from 'date-fns';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface RiskInfo {
  score: number;    // 0-100
  level: RiskLevel;
  reasons: string[];
}

const LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Критический', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
  high:     { label: 'Высокий',     color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  medium:   { label: 'Средний',     color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  low:      { label: 'Низкий',      color: '#10b981', bg: '#f0fdf7', border: '#a7f3d0' },
};

export function getRiskLevel(level: RiskLevel) {
  return LEVEL_CONFIG[level];
}

export function getRiskScore(task: Task, allTasks: Task[]): RiskInfo {
  if (task.status === 'done') return { score: 0, level: 'low', reasons: [] };

  const today = new Date();
  let score = 0;
  const reasons: string[] = [];

  // Deadline proximity
  try {
    const daysLeft = differenceInDays(parseISO(task.end_date), today);
    if (daysLeft < 0) {
      score += 45;
      reasons.push(`Просрочено на ${Math.abs(daysLeft)} дн.`);
    } else if (daysLeft < 2) {
      score += 35;
      reasons.push(`Дедлайн через ${daysLeft} дн.`);
    } else if (daysLeft < 5) {
      score += 20;
      reasons.push(`Дедлайн через ${daysLeft} дн.`);
    } else if (daysLeft < 14) {
      score += 8;
    }
  } catch {
    // invalid date — ignore
  }

  // Priority weight
  if (task.priority === 'high') { score += 25; reasons.push('Высокий приоритет'); }
  else if (task.priority === 'medium') score += 10;

  // Blocked dependencies
  const blockedDeps = task.depends_on.filter(depId => {
    const dep = allTasks.find(t => t.id === depId);
    return dep && dep.status !== 'done';
  });
  if (blockedDeps.length > 0) {
    score += blockedDeps.length * 15;
    reasons.push(`${blockedDeps.length} зависимост${blockedDeps.length === 1 ? 'ь' : 'и'} не выполнены`);
  }

  // Difficulty
  if (task.difficulty && task.difficulty >= 4) { score += 10; }

  // Status: todo is riskier than in_progress
  if (task.status === 'todo') score += 5;

  const clampedScore = Math.min(100, score);
  const level: RiskLevel =
    clampedScore >= 70 ? 'critical' :
    clampedScore >= 45 ? 'high' :
    clampedScore >= 22 ? 'medium' : 'low';

  return { score: clampedScore, level, reasons };
}

export function computeStreakUpdate(task: Task): { streak: number; last_completed_date: string } {
  const today = new Date().toISOString().slice(0, 10);
  const last = task.last_completed_date;
  let streak = task.streak ?? 0;

  if (last && task.recurring) {
    try {
      const daysSince = differenceInDays(parseISO(today), parseISO(last));
      const maxGap =
        task.recurrence_interval === 'daily'    ? 2 :
        task.recurrence_interval === 'weekly'   ? 8 :
        task.recurrence_interval === 'biweekly' ? 15 : 32;
      streak = daysSince <= maxGap ? streak + 1 : 1;
    } catch {
      streak = 1;
    }
  } else {
    streak = (task.recurring) ? 1 : streak;
  }

  return { streak, last_completed_date: today };
}
