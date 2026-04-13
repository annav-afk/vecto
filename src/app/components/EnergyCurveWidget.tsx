/**
 * EnergyCurveWidget — энергетическая кривая дня.
 * Анализирует паттерны выполнения задач по часам и строит визуальный график.
 * Даёт персональные рекомендации: когда браться за сложное, а когда — за рутину.
 */
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Sun, Sunrise, Coffee, Moon, Zap, Clock, TrendingUp, Brain } from 'lucide-react';
import { computeLocalInsights } from '../lib/patternTracker';

// ── Hours we show ─────────────────────────────────────────────────────────────
const DISPLAY_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

type Period = { label: string; hours: number[]; icon: typeof Sun; iconColor: string; bg: string };
const PERIODS: Period[] = [
  { label: 'Утро',  hours: [6,7,8,9,10,11],     icon: Sunrise, iconColor: 'text-blue-300',  bg: 'from-blue-500/10' },
  { label: 'День',  hours: [12,13,14,15,16],     icon: Sun,     iconColor: 'text-blue-400',  bg: 'from-blue-600/10' },
  { label: 'Вечер', hours: [17,18,19,20,21],     icon: Coffee,  iconColor: 'text-blue-500',  bg: 'from-blue-700/10' },
  { label: 'Ночь',  hours: [22,23,0,1,2,3,4,5], icon: Moon,    iconColor: 'text-blue-200',  bg: 'from-blue-900/10' },
];

function getPeriodForHour(h: number): Period {
  return PERIODS.find(p => p.hours.includes(h)) ?? PERIODS[1];
}

function hourLabel(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

// ── Recommendations based on peak hour ─────────────────────────────────────
function getRecommendation(peakHour: number, completionsByHour: number[]): {
  focus: string; routine: string; rest: string;
} {
  const period = getPeriodForHour(peakHour);
  const focusTime = `${hourLabel(peakHour)}–${hourLabel((peakHour + 2) % 24)}`;

  // Find lowest energy hours
  const nonZero = completionsByHour.map((v, i) => ({ v, h: DISPLAY_HOURS[i] ?? i })).filter(x => x.h >= 6);
  nonZero.sort((a, b) => a.v - b.v);
  const restHour = nonZero[0]?.h ?? 15;

  return {
    focus:   `Сложные задачи — ${focusTime} (твой пик энергии в ${period.label.toLowerCase()})`,
    routine: `Рутина и почта — за 2 часа до/после ${hourLabel(peakHour)}`,
    rest:    `Перерыв и восстановление — около ${hourLabel(restHour)}`,
  };
}

export function EnergyCurveWidget() {
  const insights = useMemo(() => computeLocalInsights(), []);

  // Build hourly completion map
  const completionsByHour = useMemo(() => {
    return DISPLAY_HOURS.map(h => {
      const idx = insights.peakHours.findIndex(p => p.hour === h);
      return idx >= 0 ? insights.peakHours[idx].completions : 0;
    });
  }, [insights]);

  const maxVal  = Math.max(...completionsByHour, 1);
  const peakIdx = completionsByHour.indexOf(Math.max(...completionsByHour));
  const peakH   = DISPLAY_HOURS[peakIdx] ?? 10;

  const hasData  = insights.peakHours.length > 0 && maxVal > 0;
  const recs     = useMemo(() => getRecommendation(peakH, completionsByHour), [peakH, completionsByHour]);

  // Period averages for the summary row
  const periodAvgs = useMemo(() => PERIODS.map(p => {
    const hrs = p.hours.filter(h => DISPLAY_HOURS.includes(h));
    const vals = hrs.map(h => {
      const i = DISPLAY_HOURS.indexOf(h);
      return i >= 0 ? completionsByHour[i] : 0;
    });
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { ...p, avg };
  }), [completionsByHour]);

  const bestPeriod = [...periodAvgs].sort((a, b) => b.avg - a.avg)[0];

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center">
        <Clock className="w-10 h-10 text-blue-400/40 mx-auto mb-3" />
        <p className="text-white/50 text-sm font-medium mb-1">Энергетическая кривая</p>
        <p className="text-white/30 text-xs">
          Выполни несколько задач в разное время дня — Томи построит твой персональный график энергии.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1a36]/80 to-[#070f1e]/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-xl bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 flex items-center justify-center">
          <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">Энергетическая кривая</p>
          <p className="text-white/40 text-xs">Твоя продуктивность по часам</p>
        </div>
        {bestPeriod && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1d4ed8]/15 border border-[#1d4ed8]/30">
            <bestPeriod.icon className={`w-3 h-3 ${bestPeriod.iconColor}`} />
            <span className="text-[#93bbfd] text-[10px] font-semibold">Пик: {bestPeriod.label}</span>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="px-4 pb-2">
        <div className="flex items-end gap-[3px] h-20 relative">
          {DISPLAY_HOURS.map((h, i) => {
            const val      = completionsByHour[i];
            const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            const isPeak   = i === peakIdx;
            const period   = getPeriodForHour(h);

            return (
              <div key={h} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
                {isPeak && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.03 }}
                    className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <Zap className="w-3 h-3 text-blue-300 drop-shadow" />
                  </motion.div>
                )}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPct, val > 0 ? 8 : 2)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: 'easeOut' }}
                  className="w-full rounded-t-sm relative overflow-hidden"
                  style={{
                    background: isPeak
                      ? 'linear-gradient(to top, #1d4ed8, #3b82f6)'
                      : val > 0
                        ? 'rgba(59,130,246,0.35)'
                        : 'rgba(255,255,255,0.04)',
                  }}>
                  {/* Shimmer on peak */}
                  {isPeak && (
                    <motion.div
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  )}
                </motion.div>
                {/* Hour label — show every 3rd */}
                {h % 3 === 0 && (
                  <span className="text-[8px] text-white/20 shrink-0">{h}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Period summary pills */}
      <div className="flex gap-2 px-4 pb-3 flex-wrap">
        {periodAvgs.filter(p => p.avg > 0).map(p => {
          const Icon = p.icon;
          const pct  = maxVal > 0 ? Math.round((p.avg / maxVal) * 100) : 0;
          return (
            <div key={p.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/8">
              <Icon className={`w-3 h-3 ${p.iconColor}`} />
              <span className="text-white/60 text-[10px] font-medium">{p.label}</span>
              <div className="w-8 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#1d4ed8]"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      <div className="border-t border-white/6 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-white/60 text-xs font-semibold">Рекомендации Томи</span>
        </div>
        {[
          { icon: '🧠', text: recs.focus,   color: 'text-blue-300' },
          { icon: '📋', text: recs.routine, color: 'text-white/60' },
          { icon: '☕', text: recs.rest,    color: 'text-white/40' },
        ].map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="flex items-start gap-2">
            <span className="text-base shrink-0 leading-none mt-0.5">{r.icon}</span>
            <p className={`text-[11px] leading-relaxed ${r.color}`}>{r.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
