import { Plan } from '../lib/types';
import { parseISO, differenceInDays, addDays, format, isAfter, startOfDay, subDays } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingDown, Activity, Calendar } from 'lucide-react';

interface Props {
  plan: Plan;
}

// ── Build burn-down data ────────────────────────────────────────────────────
function buildBurndown(plan: Plan) {
  const allTasks = plan.phases.flatMap(p => p.tasks);
  const total = allTasks.length;
  const start = parseISO(plan.phases[0]?.start_date || plan.created_at);
  const end = parseISO(plan.deadline);
  const totalDays = Math.max(differenceInDays(end, start), 1);
  const doneCount = allTasks.filter(t => t.status === 'done').length;
  const today = startOfDay(new Date());

  const points: { date: string; ideal: number; actual: number | null }[] = [];
  const step = Math.max(1, Math.floor(totalDays / 16));

  for (let i = 0; i <= totalDays; i += step) {
    const date = addDays(start, i);
    const ideal = Math.round(total - (total * i) / totalDays);
    const isInPast = !isAfter(startOfDay(date), today);
    // Actual: for past dates interpolate based on done count vs today ratio
    let actual: number | null = null;
    if (isInPast) {
      const elapsed = Math.min(1, differenceInDays(today, start) / totalDays);
      const completionRate = elapsed > 0 ? doneCount / total : 0;
      const daysRatio = i / totalDays;
      // interpolate actual: assumes linear completion up to today
      actual = Math.round(total - (doneCount * daysRatio) / Math.max(elapsed, 0.01));
      actual = Math.max(0, Math.min(total, actual));
    }
    points.push({ date: format(date, 'dd.MM'), ideal, actual });
  }
  return points;
}

// ── Build velocity data (per-phase progress) ────────────────────────────────
function buildVelocity(plan: Plan) {
  return plan.phases.map(phase => ({
    name: phase.name.length > 10 ? phase.name.slice(0, 10) + '…' : phase.name,
    Выполнено: phase.tasks.filter(t => t.status === 'done').length,
    'В работе': phase.tasks.filter(t => t.status === 'in_progress').length,
    'Осталось': phase.tasks.filter(t => t.status === 'todo').length,
    color: phase.color,
  }));
}

// ── Build heatmap data (task density per day) ────────────────────────────────
function buildHeatmap(plan: Plan) {
  const allTasks = plan.phases.flatMap(p => p.tasks);
  const map: Record<string, { count: number; done: number }> = {};

  for (const task of allTasks) {
    const key = task.end_date;
    if (!map[key]) map[key] = { count: 0, done: 0 };
    map[key].count++;
    if (task.status === 'done') map[key].done++;
  }
  return map;
}

function HeatmapCell({ count, done, isToday }: { count: number; done: number; isToday: boolean; date: string }) {
  const intensity = count === 0 ? 0 : done === count ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : 1;
  const colors = ['#e2e8f0', '#bfdbfe', '#93c5fd', '#60a5fa', '#1d4ed8'];
  const darkColors = ['rgba(255,255,255,0.06)', '#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb'];

  return (
    <div
      className="w-3.5 h-3.5 rounded-sm transition-all hover:scale-125 relative group"
      style={{ backgroundColor: colors[intensity] }}
      title={`${count} задач, ${done} выполнено`}
    >
      {isToday && (
        <div className="absolute inset-0 rounded-sm ring-2 ring-[#1d4ed8] ring-offset-1" />
      )}
    </div>
  );
}

export function AnalyticsPanel({ plan }: Props) {
  const burndownData = buildBurndown(plan);
  const velocityData = buildVelocity(plan);
  const heatmapData = buildHeatmap(plan);

  const allTasks = plan.phases.flatMap(p => p.tasks);
  const doneCount = allTasks.filter(t => t.status === 'done').length;
  const inProgressCount = allTasks.filter(t => t.status === 'in_progress').length;
  const totalCount = allTasks.length;
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const totalPlannedHours = allTasks.reduce((s, t) => s + t.duration_hours, 0);
  const totalTrackedSeconds = allTasks.reduce((s, t) => s + (t.tracked_seconds ?? 0), 0);
  const totalTrackedHours = Math.round((totalTrackedSeconds / 3600) * 10) / 10;

  // Heatmap: last 12 weeks grid
  const today = startOfDay(new Date());
  const heatmapStart = subDays(today, 11 * 7);
  const weeks: Date[][] = [];
  let weekDay = new Date(heatmapStart);
  // align to Monday
  const dayOfWeek = weekDay.getDay();
  weekDay = subDays(weekDay, dayOfWeek === 0 ? 6 : dayOfWeek - 1);

  for (let w = 0; w < 12; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(weekDay));
      weekDay = addDays(weekDay, 1);
    }
    weeks.push(week);
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-[#1e1e3a] border border-slate-200 dark:border-white/15 rounded-xl p-3 shadow-xl text-xs">
        <p className="text-slate-500 dark:text-white/50 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value ?? '—'}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Выполнено задач', value: `${doneCount} / ${totalCount}`, color: '#10b981', pct: completionRate },
          { label: 'Дней осталось', value: `${Math.max(0, differenceInDays(parseISO(plan.deadline), today))}д`, color: '#1d4ed8', pct: null },
          { label: 'Часов запланировано', value: `${totalPlannedHours}ч`, color: '#f59e0b', pct: null },
          { label: 'Часов отслежено', value: `${totalTrackedHours}ч`, color: '#ec4899', pct: null },
        ].map(card => (
          <div key={card.label} className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
            <div className="text-xs text-slate-400 dark:text-white/40 mb-1">{card.label}</div>
            <div className="text-slate-900 dark:text-white text-base" style={{ fontWeight: 700, color: card.color }}>{card.value}</div>
            {card.pct !== null && (
              <div className="mt-1.5 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${card.pct}%`, background: card.color }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Burn-down chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-[#1d4ed8]" />
          <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>
            Burn-down chart
          </span>
          <span className="text-xs text-slate-400 dark:text-white/40">— сгорание задач по времени</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={burndownData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="idealGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Area type="monotone" dataKey="ideal" name="Идеальный" stroke="#1d4ed8" strokeWidth={2} fill="url(#idealGrad)" strokeDasharray="5 3" dot={false} />
            <Area type="monotone" dataKey="actual" name="Фактический" stroke="#10b981" strokeWidth={2} fill="url(#actualGrad)" dot={false} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Velocity / Phase progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#2563eb]" />
          <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>
            Прогресс по этапам
          </span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={velocityData} margin={{ top: 0, right: 5, bottom: 0, left: -20 }} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="Выполнено" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="В работе" stackId="a" fill="#1d4ed8" />
            <Bar dataKey="Осталось" stackId="a" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[#1d4ed8]" />
          <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>
            Heatmap активности
          </span>
          <span className="text-xs text-slate-400 dark:text-white/40">— плотность задач по дням</span>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-1 shrink-0">
            {['Пн', '', 'Ср', '', 'Пт', '', ''].map((d, i) => (
              <div key={i} className="h-3.5 text-xs text-slate-400 dark:text-white/30 leading-none flex items-center" style={{ fontSize: '9px' }}>
                {d}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1 shrink-0">
              {week.map((date, dIdx) => {
                const key = format(date, 'yyyy-MM-dd');
                const data = heatmapData[key] || { count: 0, done: 0 };
                const isT = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                return (
                  <HeatmapCell
                    key={dIdx}
                    count={data.count}
                    done={data.done}
                    isToday={isT}
                    date={key}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-xs text-slate-400 dark:text-white/30">Меньше</span>
          {['#e2e8f0', '#bfdbfe', '#93c5fd', '#60a5fa', '#1d4ed8'].map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span className="text-xs text-slate-400 dark:text-white/30">Больше</span>
        </div>
      </motion.div>
    </div>
  );
}