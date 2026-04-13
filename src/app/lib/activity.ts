/** Activity tracking — records task completions per day for the heatmap.
 *  Data is saved to localStorage AND synced to cloud via cloudSync. */
import { format, subDays, parseISO, isAfter, startOfDay } from 'date-fns';
import { setData, getData } from './cloudSync';

const ACTIVITY_KEY = 'stride_activity';

export interface DayActivity {
  date: string;  // YYYY-MM-DD
  count: number;
}

function readLocal(): DayActivity[] {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch { return []; }
}

function writeLocal(data: DayActivity[]) {
  try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(data)); } catch {}
}

export function recordActivity(date?: string) {
  const d = date ?? format(new Date(), 'yyyy-MM-dd');
  try {
    const data = getActivity();
    const existing = data.find(x => x.date === d);
    if (existing) {
      existing.count++;
    } else {
      data.push({ date: d, count: 1 });
    }
    // Keep only last 365 days
    const cutoff = startOfDay(subDays(new Date(), 365));
    const trimmed = data.filter(x => isAfter(parseISO(x.date), cutoff) || x.date === format(cutoff, 'yyyy-MM-dd'));
    writeLocal(trimmed);
    // Sync to cloud
    setData('activity', trimmed);
  } catch {}
}

export function getActivity(): DayActivity[] {
  // Read from localStorage (primary, instant)
  return readLocal();
}

export function getActivityMap(): Record<string, number> {
  const result: Record<string, number> = {};
  getActivity().forEach(d => { result[d.date] = d.count; });
  return result;
}

export function getTodayCount(): number {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getActivity().find(d => d.date === today)?.count ?? 0;
}

export function getTotalStreak(): number {
  const map = getActivityMap();
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (!map[key]) break;
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}
