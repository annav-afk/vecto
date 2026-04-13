import { useMemo } from 'react';
import { motion } from 'motion/react';
import { format, subDays, startOfWeek, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getActivityMap, getTotalStreak } from '../lib/activity';
import { Flame, Target } from 'lucide-react';

const WEEKS = 16;
const DAYS_PER_WEEK = 7;

function getColor(count: number, maxCount: number): string {
  if (count === 0) return 'var(--heatmap-empty, #e2e8f0)';
  const ratio = Math.min(count / Math.max(maxCount, 1), 1);
  if (ratio < 0.25) return '#c7d2fe';
  if (ratio < 0.5)  return '#818cf8';
  if (ratio < 0.75) return '#1d4ed8';
  return '#4f46e5';
}

export function ActivityHeatmap() {
  const activityMap = useMemo(() => getActivityMap(), []);
  const streak = useMemo(() => getTotalStreak(), []);

  // Build grid: WEEKS columns × 7 rows
  const today = new Date();
  const startDay = startOfWeek(subDays(today, (WEEKS - 1) * 7), { weekStartsOn: 1 });

  const weeks: { date: Date; count: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: Date; count: number }[] = [];
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const date = addDays(startDay, w * 7 + d);
      const key = format(date, 'yyyy-MM-dd');
      week.push({ date, count: activityMap[key] ?? 0 });
    }
    weeks.push(week);
  }

  const maxCount = Math.max(...Object.values(activityMap), 1);
  const totalDone = Object.values(activityMap).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(activityMap).filter(c => c > 0).length;

  const DAY_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс'];

  // Month labels
  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = week[0].date.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: format(week[0].date, 'LLL', { locale: ru }), colIndex: wi });
      lastMonth = m;
    }
  });

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1d4ed8]/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-[#1d4ed8]" />
          </div>
          <div>
            <div className="text-xs text-slate-400 dark:text-white/40">Всего выполнено</div>
            <div className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>{totalDone} задач</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-xs text-slate-400 dark:text-white/40">Серия</div>
            <div className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>{streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#10b981]" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
              <rect x="6" y="1" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.7" />
              <rect x="11" y="1" width="3" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-slate-400 dark:text-white/40">Активных дней</div>
            <div className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>{activeDays}</div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: WEEKS * 14 + 28 }}>
          {/* Month labels */}
          <div className="flex mb-1 pl-7" style={{ gap: 2 }}>
            {weeks.map((week, wi) => {
              const ml = monthLabels.find(m => m.colIndex === wi);
              return (
                <div key={wi} style={{ width: 12, flexShrink: 0 }}>
                  {ml && (
                    <span className="text-xs text-slate-400 dark:text-white/30" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>
                      {ml.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1.5">
              {DAY_LABELS.map((d, i) => (
                <div key={i} style={{ width: 16, height: 12, fontSize: 8 }} className="flex items-center text-slate-400 dark:text-white/30">
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map(({ date, count }, di) => {
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const isFuture = date > today;
                  return (
                    <motion.div
                      key={di}
                      title={count > 0 ? `${format(date, 'dd MMM', { locale: ru })}: ${count} задач` : format(date, 'dd MMM', { locale: ru })}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (wi * 7 + di) * 0.003, duration: 0.15 }}
                      style={{
                        width: 12, height: 12,
                        borderRadius: 2,
                        background: isFuture ? 'transparent' : getColor(count, maxCount),
                        border: isToday ? '1px solid #1d4ed8' : isFuture ? '1px dashed #e2e8f0' : 'none',
                        cursor: count > 0 ? 'pointer' : 'default',
                        opacity: isFuture ? 0.3 : 1,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 pl-7">
            <span className="text-xs text-slate-400 dark:text-white/30" style={{ fontSize: 10 }}>Меньше</span>
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <div
                key={ratio}
                style={{ width: 10, height: 10, borderRadius: 2, background: getColor(ratio * maxCount, maxCount) }}
              />
            ))}
            <span className="text-xs text-slate-400 dark:text-white/30" style={{ fontSize: 10 }}>Больше</span>
          </div>
        </div>
      </div>
    </div>
  );
}