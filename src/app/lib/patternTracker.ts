/**
 * Pattern Tracker — "Томи-клон" feature.
 * Passively records user behaviour patterns:
 *   - Task completions (time-of-day, day-of-week)
 *   - Postponements / status changes
 *   - Mood correlation
 *   - Streaks & dropoffs
 *   - Session durations
 *
 * Data stored in localStorage `stride_patterns` and synced via cloudSync.
 */
import { format, getHours, getDay, differenceInDays, parseISO } from 'date-fns';
import { setData, getData } from './cloudSync';

const PATTERNS_KEY = 'stride_patterns';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TaskEvent {
  taskId: string;
  taskTitle: string;
  action: 'completed' | 'postponed' | 'started' | 'created' | 'deleted';
  priority: 'high' | 'medium' | 'low';
  difficulty?: number;
  hour: number;       // 0-23
  dayOfWeek: number;  // 0 = Sun, 1 = Mon ...
  date: string;       // YYYY-MM-DD
  ts: number;         // epoch ms
  tags?: string[];
}

export interface MoodEntry {
  mood: number;  // 1-5
  date: string;
  hour: number;
  ts: number;
  note?: string; // optional text note: what influenced mood
}

export interface SessionEntry {
  date: string;
  startTs: number;
  endTs: number;
  durationMin: number;
  tasksCompleted: number;
}

export interface PatternData {
  taskEvents: TaskEvent[];
  moodEntries: MoodEntry[];
  sessions: SessionEntry[];
  firstRecordDate: string | null;
  version: number;
}

// ── Default ──────────────────────────────────────────────────────────────────

function defaultPatterns(): PatternData {
  return {
    taskEvents: [],
    moodEntries: [],
    sessions: [],
    firstRecordDate: null,
    version: 1,
  };
}

// ── Read / Write ─────────────────────────────────────────────────────────────

function readPatterns(): PatternData {
  try {
    const raw = localStorage.getItem(PATTERNS_KEY);
    if (!raw) return defaultPatterns();
    return { ...defaultPatterns(), ...JSON.parse(raw) };
  } catch {
    return defaultPatterns();
  }
}

function writePatterns(data: PatternData) {
  // Trim to last 2000 events to keep storage reasonable
  if (data.taskEvents.length > 2000) {
    data.taskEvents = data.taskEvents.slice(-2000);
  }
  if (data.moodEntries.length > 500) {
    data.moodEntries = data.moodEntries.slice(-500);
  }
  if (data.sessions.length > 300) {
    data.sessions = data.sessions.slice(-300);
  }
  try {
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(data));
  } catch {}
  // Sync to cloud (debounced internally)
  try { setData('patterns' as any, data); } catch {}
}

// ── Record Events ────────────────────────────────────────────────────────────

export function recordTaskEvent(
  taskId: string,
  taskTitle: string,
  action: TaskEvent['action'],
  priority: TaskEvent['priority'],
  difficulty?: number,
  tags?: string[],
) {
  const now = new Date();
  const data = readPatterns();
  if (!data.firstRecordDate) {
    data.firstRecordDate = format(now, 'yyyy-MM-dd');
  }
  data.taskEvents.push({
    taskId,
    taskTitle,
    action,
    priority,
    difficulty,
    hour: getHours(now),
    dayOfWeek: getDay(now),
    date: format(now, 'yyyy-MM-dd'),
    ts: now.getTime(),
    tags,
  });
  writePatterns(data);
}

export function recordMood(mood: number, note?: string) {
  const now = new Date();
  const data = readPatterns();
  if (!data.firstRecordDate) {
    data.firstRecordDate = format(now, 'yyyy-MM-dd');
  }
  data.moodEntries.push({
    mood,
    date: format(now, 'yyyy-MM-dd'),
    hour: getHours(now),
    ts: now.getTime(),
    note,
  });
  writePatterns(data);
}

export function recordSession(startTs: number, tasksCompleted: number) {
  const now = new Date();
  const data = readPatterns();
  if (!data.firstRecordDate) {
    data.firstRecordDate = format(now, 'yyyy-MM-dd');
  }
  data.sessions.push({
    date: format(now, 'yyyy-MM-dd'),
    startTs,
    endTs: now.getTime(),
    durationMin: Math.round((now.getTime() - startTs) / 60000),
    tasksCompleted,
  });
  writePatterns(data);
}

// ── Computed Insights (local, fast) ──────────────────────────────────────────

export interface LocalInsights {
  totalEvents: number;
  totalDays: number;
  dataReady: boolean;            // >= 5 days of data
  dataRichness: number;          // 0-100 score
  peakHours: { hour: number; count: number }[];
  peakDays: { day: number; count: number }[];
  avgCompletionsPerDay: number;
  postponementRate: number;      // 0-1
  topPostponedTags: string[];
  moodVsProductivity: { mood: number; avgCompletions: number }[];
  streakHistory: { date: string; streak: number }[];
  currentStreak: number;
  longestStreak: number;
  dangerZonePercent: number | null; // progress % where user typically slows down
  avgSessionMinutes: number;
  completionsByPriority: { priority: string; count: number; rate: number }[];
}

export function computeLocalInsights(): LocalInsights {
  const data = readPatterns();
  const completions = data.taskEvents.filter(e => e.action === 'completed');
  const postponements = data.taskEvents.filter(e => e.action === 'postponed');
  const allEvents = data.taskEvents;

  const firstDate = data.firstRecordDate ? parseISO(data.firstRecordDate) : new Date();
  const totalDays = Math.max(1, differenceInDays(new Date(), firstDate) + 1);
  const dataReady = totalDays >= 5 && completions.length >= 10;

  // Richness score (how much data we have)
  const dataRichness = Math.min(100, Math.round(
    (Math.min(completions.length, 100) / 100) * 40 +
    (Math.min(totalDays, 30) / 30) * 30 +
    (Math.min(data.moodEntries.length, 20) / 20) * 15 +
    (Math.min(data.sessions.length, 15) / 15) * 15
  ));

  // Peak hours
  const hourMap: Record<number, number> = {};
  completions.forEach(e => { hourMap[e.hour] = (hourMap[e.hour] || 0) + 1; });
  const peakHours = Object.entries(hourMap)
    .map(([h, c]) => ({ hour: Number(h), count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Peak days
  const dayMap: Record<number, number> = {};
  completions.forEach(e => { dayMap[e.dayOfWeek] = (dayMap[e.dayOfWeek] || 0) + 1; });
  const peakDays = Object.entries(dayMap)
    .map(([d, c]) => ({ day: Number(d), count: c }))
    .sort((a, b) => b.count - a.count);

  // Avg completions per day
  const avgCompletionsPerDay = completions.length / totalDays;

  // Postponement rate
  const totalActions = completions.length + postponements.length;
  const postponementRate = totalActions > 0 ? postponements.length / totalActions : 0;

  // Top postponed tags
  const tagPostponeMap: Record<string, number> = {};
  postponements.forEach(e => {
    (e.tags ?? []).forEach(t => { tagPostponeMap[t] = (tagPostponeMap[t] || 0) + 1; });
  });
  const topPostponedTags = Object.entries(tagPostponeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  // Mood vs productivity
  const moodDayMap: Record<string, number[]> = {};
  data.moodEntries.forEach(m => {
    if (!moodDayMap[m.date]) moodDayMap[m.date] = [];
    moodDayMap[m.date].push(m.mood);
  });
  const dayCompletionMap: Record<string, number> = {};
  completions.forEach(e => {
    dayCompletionMap[e.date] = (dayCompletionMap[e.date] || 0) + 1;
  });
  const moodBuckets: Record<number, number[]> = {};
  Object.entries(moodDayMap).forEach(([date, moods]) => {
    const avgMood = Math.round(moods.reduce((s, m) => s + m, 0) / moods.length);
    const comps = dayCompletionMap[date] ?? 0;
    if (!moodBuckets[avgMood]) moodBuckets[avgMood] = [];
    moodBuckets[avgMood].push(comps);
  });
  const moodVsProductivity = Object.entries(moodBuckets)
    .map(([mood, comps]) => ({
      mood: Number(mood),
      avgCompletions: Math.round((comps.reduce((s, c) => s + c, 0) / comps.length) * 10) / 10,
    }))
    .sort((a, b) => a.mood - b.mood);

  // Streak calculation
  const completionDates = new Set(completions.map(e => e.date));
  const sortedDates = Array.from(completionDates).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  const streakHistory: { date: string; streak: number }[] = [];

  const today = format(new Date(), 'yyyy-MM-dd');
  // Check from today backwards
  let cursor = new Date();
  while (true) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (completionDates.has(key)) {
      currentStreak++;
      cursor = new Date(cursor.getTime() - 86400000);
    } else break;
  }

  // Longest streak from sorted dates
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) { streak = 1; }
    else {
      const diff = differenceInDays(parseISO(sortedDates[i]), parseISO(sortedDates[i - 1]));
      streak = diff === 1 ? streak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, streak);
    streakHistory.push({ date: sortedDates[i], streak });
  }

  // Danger zone — detect where users typically slow down (not enough data for real analysis, use heuristic)
  let dangerZonePercent: number | null = null;
  // Simple heuristic: if we see a pattern of postponements increasing around certain progress
  // For now we'll flag ~60% as danger zone if postponement rate is high
  if (postponementRate > 0.3 && completions.length > 20) {
    dangerZonePercent = 60;
  }

  // Avg session minutes
  const avgSessionMinutes = data.sessions.length > 0
    ? Math.round(data.sessions.reduce((s, sess) => s + sess.durationMin, 0) / data.sessions.length)
    : 0;

  // Completions by priority
  const priorityCompletions: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const priorityTotal: Record<string, number> = { high: 0, medium: 0, low: 0 };
  allEvents.forEach(e => {
    if (e.action === 'completed') priorityCompletions[e.priority] = (priorityCompletions[e.priority] || 0) + 1;
    if (e.action === 'completed' || e.action === 'postponed' || e.action === 'created') {
      priorityTotal[e.priority] = (priorityTotal[e.priority] || 0) + 1;
    }
  });
  const completionsByPriority = ['high', 'medium', 'low'].map(p => ({
    priority: p,
    count: priorityCompletions[p] || 0,
    rate: priorityTotal[p] ? (priorityCompletions[p] || 0) / priorityTotal[p] : 0,
  }));

  return {
    totalEvents: allEvents.length,
    totalDays,
    dataReady,
    dataRichness,
    peakHours,
    peakDays,
    avgCompletionsPerDay,
    postponementRate,
    topPostponedTags,
    moodVsProductivity,
    streakHistory,
    currentStreak,
    longestStreak,
    dangerZonePercent,
    avgSessionMinutes,
    completionsByPriority,
  };
}

// ── Export raw data for AI analysis ──────────────────────────────────────────

export function getPatternSummaryForAI(): string {
  const insights = computeLocalInsights();
  const data = readPatterns();

  const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const lines: string[] = [
    `Данных за ${insights.totalDays} дней.`,
    `Всего событий: ${insights.totalEvents}.`,
    `Завершено задач: ${data.taskEvents.filter(e => e.action === 'completed').length}.`,
    `Отложено задач: ${data.taskEvents.filter(e => e.action === 'postponed').length}.`,
    `Среднее завершений в день: ${insights.avgCompletionsPerDay.toFixed(1)}.`,
    `Процент откладывания: ${(insights.postponementRate * 100).toFixed(0)}%.`,
    `Текущий стрик: ${insights.currentStreak} дней, рекорд: ${insights.longestStreak}.`,
  ];

  if (insights.peakHours.length > 0) {
    lines.push(`Пиковые часы продуктивности: ${insights.peakHours.map(h => `${h.hour}:00 (${h.count} задач)`).join(', ')}.`);
  }

  if (insights.peakDays.length > 0) {
    lines.push(`Продуктивные дни: ${insights.peakDays.map(d => `${DAY_NAMES[d.day]} (${d.count})`).join(', ')}.`);
  }

  if (insights.moodVsProductivity.length > 0) {
    lines.push(`Настроение→продуктивность: ${insights.moodVsProductivity.map(m => `настр.${m.mood}→${m.avgCompletions} задач/день`).join(', ')}.`);
  }

  // Include recent mood notes for AI context
  const recentNotedMoods = data.moodEntries.filter(m => m.note).slice(-5);
  if (recentNotedMoods.length > 0) {
    lines.push(`Последние заметки о настроении: ${recentNotedMoods.map(m => `[${m.date} настр.${m.mood}] "${m.note}"`).join('; ')}.`);
  }

  if (insights.dangerZonePercent !== null) {
    lines.push(`Зона риска: пользователь замедляется на ~${insights.dangerZonePercent}% прогресса.`);
  }

  if (insights.avgSessionMinutes > 0) {
    lines.push(`Средняя сессия: ${insights.avgSessionMinutes} минут.`);
  }

  lines.push(`Приоритеты: ${insights.completionsByPriority.map(p => `${p.priority}: ${p.count} завершено (${(p.rate * 100).toFixed(0)}%)`).join('; ')}.`);

  return lines.join('\n');
}

// ── Get raw patterns for the insights page ───────────────────────────────────

export function getRawPatterns(): PatternData {
  return readPatterns();
}