/**
 * LifeInNumbers — «Жизнь в цифрах»
 * Красивая сводная статистика: задачи, стрики, сессии, настроение.
 * Анимированные каунтеры + мотивационные фразы.
 */
import { useMemo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2, Flame, Trophy, Clock, TrendingUp,
  BarChart3, Smile, Calendar, Target, Zap,
} from 'lucide-react';
import { computeLocalInsights, getRawPatterns } from '../lib/patternTracker';
import { getPlans } from '../lib/storage';

// ── Animated counter ─────────────────────────────────────────────────────────
function AnimCounter({ value, delay = 0 }: { value: number; delay?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = Date.now() + delay * 1000;
    const end   = start + 900;
    let raf: number;
    function tick() {
      const now = Date.now();
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      const t   = Math.min(1, (now - start) / (end - start));
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(ease * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);
  return <>{display.toLocaleString('ru-RU')}</>;
}

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MOOD_LABELS: Record<number, string> = { 1:'😞', 2:'😕', 3:'😐', 4:'😊', 5:'🤩' };

interface StatCard {
  icon: typeof CheckCircle2;
  iconColor: string;
  iconBg: string;
  value: number;
  unit: string;
  label: string;
  sub?: string;
  highlight?: boolean;
}

export function LifeInNumbers() {
  const insights = useMemo(() => computeLocalInsights(), []);
  const patterns = useMemo(() => getRawPatterns(), []);
  const plans    = useMemo(() => { try { return getPlans(); } catch { return []; } }, []);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const totalCompleted = patterns.taskEvents.filter(e => e.action === 'completed').length;
  const totalPostponed = patterns.taskEvents.filter(e => e.action === 'postponed').length;
  const totalPlans     = plans.length;
  const totalTasks     = plans.reduce((s, p) => s + p.phases.flatMap(ph => ph.tasks).length, 0);
  const doneTasks      = plans.reduce((s, p) => s + p.phases.flatMap(ph => ph.tasks).filter(t => t.status === 'done').length, 0);

  const avgMood = patterns.moodEntries.length
    ? (patterns.moodEntries.reduce((s, m) => s + m.mood, 0) / patterns.moodEntries.length)
    : 0;

  const totalSessionMin = patterns.sessions.reduce((s, se) => s + se.durationMin, 0);
  const totalSessionHrs = Math.round(totalSessionMin / 60);

  const bestDay  = insights.peakDays[0];
  const bestDayLabel = bestDay ? DAY_NAMES[bestDay.day] : '—';

  // Procrastination patterns: tasks postponed 3+ times
  const postponeMap: Record<string, number> = {};
  for (const ev of patterns.taskEvents) {
    if (ev.action === 'postponed') {
      postponeMap[ev.taskId] = (postponeMap[ev.taskId] ?? 0) + 1;
    }
  }
  const chronicPostpone = Object.values(postponeMap).filter(c => c >= 3).length;

  const hasData = totalCompleted > 0 || doneTasks > 0;

  // ── Stat cards ─────────────────────────────────────────────────────────────
  const cards: StatCard[] = [
    {
      icon: CheckCircle2, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/25',
      value: totalCompleted || doneTasks, unit: '', label: 'Задач выполнено',
      sub: totalCompleted > 50 ? 'Отличный результат! 🏆' : 'Каждая засчитывается!',
      highlight: totalCompleted > 10,
    },
    {
      icon: Flame, iconColor: 'text-red-400', iconBg: 'bg-red-500/15 border-red-500/25',
      value: insights.longestStreak, unit: ' дн', label: 'Лучший стрик',
      sub: insights.currentStreak > 0 ? `Текущий: ${insights.currentStreak} дн. 🔥` : 'Начни сегодня!',
      highlight: insights.longestStreak >= 7,
    },
    {
      icon: Target, iconColor: 'text-blue-400', iconBg: 'bg-[#1d4ed8]/15 border-[#1d4ed8]/30',
      value: totalPlans, unit: '', label: 'Планов создано',
      sub: `${doneTasks} / ${totalTasks} задач закрыто`,
    },
    {
      icon: Clock, iconColor: 'text-sky-400', iconBg: 'bg-sky-500/15 border-sky-500/25',
      value: totalSessionHrs, unit: ' ч', label: 'В приложении',
      sub: `${patterns.sessions.length} сессий`,
    },
    {
      icon: TrendingUp, iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/15 border-indigo-500/25',
      value: Math.round(insights.avgCompletionsPerDay * 10) / 10 || 0, unit: '', label: 'Задач в день (ср.)',
      sub: bestDay ? `Пик: ${bestDayLabel}` : 'Копим статистику...',
    },
    {
      icon: Smile, iconColor: 'text-yellow-400', iconBg: 'bg-yellow-500/15 border-yellow-500/25',
      value: Math.round(avgMood * 10) / 10 || 0, unit: '/5', label: 'Среднее настроение',
      sub: avgMood > 0 ? `${MOOD_LABELS[Math.round(avgMood)] ?? '😐'} ${patterns.moodEntries.length} записей` : 'Веди журнал настроения',
    },
  ];

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-6 text-center">
        <BarChart3 className="w-10 h-10 text-blue-400/40 mx-auto mb-3" />
        <p className="text-white/50 text-sm font-semibold mb-1">Жизнь в цифрах</p>
        <p className="text-white/30 text-xs">
          Начни выполнять задачи — здесь появится твоя персональная статистика.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1a36]/70 to-[#070f1e]/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/6">
        <div className="w-9 h-9 rounded-xl bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 flex items-center justify-center">
          <BarChart3 className="w-4.5 h-4.5 text-blue-400" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">Жизнь в цифрах</p>
          <p className="text-white/40 text-xs">Твои достижения за всё время</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1d4ed8]/15 border border-[#1d4ed8]/30">
          <Zap className="w-3 h-3 text-[#93bbfd]" />
          <span className="text-[#93bbfd] text-[10px] font-semibold">{insights.totalDays} дн.</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className={`relative rounded-2xl border p-3 overflow-hidden ${
                c.highlight
                  ? 'border-[#1d4ed8]/35 bg-[#1d4ed8]/10'
                  : 'border-white/8 bg-white/3'
              }`}>
              {c.highlight && (
                <motion.div
                  animate={{ opacity: [0.5, 0.15, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-br from-[#1d4ed8]/10 to-transparent pointer-events-none"
                />
              )}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border mb-2 ${c.iconBg}`}>
                <Icon className={`w-3.5 h-3.5 ${c.iconColor}`} />
              </div>
              <p className="text-white text-xl font-bold leading-none mb-0.5">
                <AnimCounter value={c.value} delay={i * 0.08} />
                <span className="text-sm font-medium text-white/50">{c.unit}</span>
              </p>
              <p className="text-white/55 text-[11px] font-medium">{c.label}</p>
              {c.sub && (
                <p className="text-white/30 text-[10px] mt-0.5 leading-tight">{c.sub}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Procrastination insight */}
      {chronicPostpone > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mx-3 mb-3 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-xs font-semibold mb-0.5">Паттерн прокрастинации</p>
            <p className="text-amber-200/60 text-[11px] leading-relaxed">
              {chronicPostpone} {chronicPostpone === 1 ? 'задача откладывалась' : 'задачи откладывались'} 3+ раза.
              Давай разберёмся — может, их стоит разбить на части?
            </p>
          </div>
        </motion.div>
      )}

      {/* Big win banner */}
      {insights.longestStreak >= 7 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="mx-3 mb-3 flex items-center gap-3 bg-gradient-to-r from-[#1d4ed8]/20 to-emerald-500/10 border border-[#1d4ed8]/30 rounded-xl p-3">
          <Trophy className="w-6 h-6 text-yellow-400 shrink-0" />
          <div>
            <p className="text-white text-xs font-bold">Легенда Vecto!</p>
            <p className="text-white/50 text-[11px]">
              Стрик {insights.longestStreak} дней — ты в топе! 🏆
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
