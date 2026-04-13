import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Coffee, WifiOff, Target, ArrowRight, Clock, Sparkles, Zap } from 'lucide-react';
import { differenceInDays, parseISO, isToday } from 'date-fns';
import { TomiAvatar } from './TomiAssistant';
import { updateSetting, getSettings } from '../lib/cloudSync';
import { aiMorningBriefing } from '../lib/api';
import type { Plan, Task } from '../lib/types';

const BRIEFING_KEY = 'stride_last_briefing';

export function shouldShowBriefing(): boolean {
  const last = localStorage.getItem(BRIEFING_KEY);
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

export function markBriefingSeen() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(BRIEFING_KEY, today);
  try { updateSetting('briefing_last', today); } catch {}
}

const MOOD_CONFIG = {
  energized: { emoji: '⚡', label: 'Энергичный день',      color: '#f59e0b', bg: '#fffbeb' },
  focused:   { emoji: '🎯', label: 'Фокусный день',        color: '#1d4ed8', bg: '#eff6ff' },
  steady:    { emoji: '🌊', label: 'Спокойный день',       color: '#2563eb', bg: '#eff6ff' },
  recovery:  { emoji: '🌱', label: 'День восстановления',  color: '#10b981', bg: '#f0fdf7' },
};

const LOCAL_TIPS = [
  'Начни день с самой сложной задачи, пока голова свежая.',
  'Используй метод «помидора»: 25 мин работы — 5 мин отдыха.',
  'Одна задача за раз. Многозадачность снижает продуктивность на 40%.',
  'Каждая выполненная задача — шаг к цели. Не откладывай маленькие задачи.',
  'Запланируй важные задачи до 12:00 — утром концентрация выше.',
  'Запиши 3 вещи, которые хочешь сделать сегодня. Не больше.',
];

interface Props {
  plans: Plan[];
  onClose: () => void;
  onOpenTask?: (planId: string, taskId: string) => void;
}

interface BriefingData {
  greeting: string;
  focusTasks: { id: string; reason: string }[];
  optionalTasks: { id: string; reason: string }[];
  tip: string;
  mood: keyof typeof MOOD_CONFIG;
}

// Генерирует брифинг локально без AI
function buildLocalBriefing(
  activePlan: Plan,
  allPlanTasks: Task[],
  todayTasks: Task[],
  overdueTasks: Task[],
  progress: number,
  daysUntilDeadline: number,
): BriefingData {
  const hour = new Date().getHours();
  const greeting =
    progress === 0
      ? 'Отличный момент, чтобы сделать первый шаг к цели!'
      : progress >= 80
      ? 'Финишная прямая! Ты уже близко к цели.'
      : daysUntilDeadline <= 7
      ? 'Дедлайн близко — сосредоточься на ключевых задачах.'
      : 'Движемся вперёд! Каждый день приближает к результату.';

  // Список задач для фокуса: сначала просроченные, потом сегодняшние high, потом первые pending
  const prioritized = [
    ...overdueTasks.filter(t => t.priority === 'high'),
    ...overdueTasks.filter(t => t.priority !== 'high'),
    ...todayTasks.filter(t => !overdueTasks.some(o => o.id === t.id) && t.priority === 'high'),
    ...todayTasks.filter(t => !overdueTasks.some(o => o.id === t.id) && t.priority !== 'high'),
    ...allPlanTasks.filter(
      t => t.status !== 'done' && !overdueTasks.some(o => o.id === t.id) && !todayTasks.some(d => d.id === t.id)
    ),
  ];

  const focusTasks = prioritized.slice(0, 3).map(t => ({
    id: t.id,
    reason: overdueTasks.some(o => o.id === t.id)
      ? 'Просрочена — выполни сегодня в первую очередь'
      : t.priority === 'high'
      ? 'Высокий приоритет — не откладывай'
      : 'Запланирована на сегодня',
  }));

  const optionalTasks = prioritized.slice(3, 5).map(t => ({
    id: t.id,
    reason: 'Если останется время',
  }));

  const mood: keyof typeof MOOD_CONFIG =
    daysUntilDeadline <= 3 ? 'focused'
    : overdueTasks.length > 2 ? 'recovery'
    : progress > 60 ? 'energized'
    : 'steady';

  const tip = LOCAL_TIPS[new Date().getDate() % LOCAL_TIPS.length];

  return { greeting, focusTasks, optionalTasks, tip, mood };
}

export function MorningBriefing({ plans, onClose, onOpenTask }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BriefingData | null>(null);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState('');

  // Build task lookup across all plans
  const allTasks: (Task & { planId: string; planGoal: string })[] = plans.flatMap(p =>
    p.phases.flatMap(ph => ph.tasks.map(t => ({ ...t, planId: p.id, planGoal: p.goal })))
  );
  const findTask = (id: string) => allTasks.find(t => t.id === id);

  useEffect(() => {
    const load = async () => {
      if (plans.length === 0) { setLoading(false); return; }

      // Pick most active plan
      const activePlan = [...plans].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).find(p => {
        const all = p.phases.flatMap(ph => ph.tasks);
        return all.filter(t => t.status === 'done').length < all.length;
      }) ?? plans[0];

      const allPlanTasks = activePlan.phases.flatMap(ph => ph.tasks);
      const progress = allPlanTasks.length > 0
        ? Math.round((allPlanTasks.filter(t => t.status === 'done').length / allPlanTasks.length) * 100)
        : 0;

      const daysUntilDeadline = differenceInDays(parseISO(activePlan.deadline), new Date());

      const overdueTasks = allPlanTasks.filter(t => {
        if (t.status === 'done') return false;
        try { return parseISO(t.end_date) < new Date(); } catch { return false; }
      });

      const todayTasks = allPlanTasks.filter(t => {
        if (t.status === 'done') return false;
        try { return isToday(parseISO(t.end_date)) || isToday(parseISO(t.start_date)); } catch { return false; }
      });

      try {
        const res = await aiMorningBriefing({
          goal: activePlan.goal,
          todayTasks: todayTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, duration_hours: t.duration_hours })),
          overdueTasks: overdueTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
          daysUntilDeadline,
          progress,
        });
        setData(res);
      } catch (err: any) {
        // Любая ошибка AI → показываем локальный бриф��нг
        const code = err?.code ?? '';
        const msg =
          code === 'quota_exceeded' ? 'Баланс AI исчерпан' :
          code === 'rate_limited'   ? 'AI временно перегружен' :
          code === 'not_configured' ? 'AI не настроен' :
          'AI недоступен';
        setAiErrorMsg(msg);
        setIsLocalFallback(true);
        setData(buildLocalBriefing(activePlan, allPlanTasks, todayTasks, overdueTasks, progress, daysUntilDeadline));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleClose = () => {
    markBriefingSeen();
    onClose();
  };

  const moodConfig = data ? (MOOD_CONFIG[data.mood] ?? MOOD_CONFIG.focused) : MOOD_CONFIG.focused;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
        className="relative bg-white dark:bg-[#13132b] border-0 sm:border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[92vh] overflow-y-auto">

        {/* Drag handle — mobile only */}
        <div className="sm:hidden sheet-handle" />

        {/* Gradient top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#10b981]" />

        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <TomiAvatar size={44} mood={
                  data?.mood === 'energized' ? 'excited' :
                  data?.mood === 'focused'   ? 'focused' :
                  data?.mood === 'recovery'  ? 'happy'   : 'happy'
                } />
              </motion.div>
              <div>
                <h2 className="text-slate-900 dark:text-white text-base" style={{ fontWeight: 700 }}>
                  {timeGreeting}! ☀️
                </h2>
                <p className="text-xs" style={{ color: moodConfig.color, fontWeight: 500 }}>
                  {moodConfig.label} · {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="py-8 flex flex-col items-center gap-4">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <TomiAvatar size={64} mood="focused" />
              </motion.div>
              <div className="flex items-center gap-1.5">
                {[0,1,2].map(i => (
                  <motion.div key={i}
                    animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                    className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8]"
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500 dark:text-white/40">Томи готовит твой план на день…</p>
            </div>
          )}

          {/* No plans */}
          {!loading && plans.length === 0 && (
            <div className="py-6 text-center">
              <Coffee className="w-8 h-8 text-slate-300 dark:text-white/20 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-white/50 text-sm">Нет активных планов.<br />Создай первый план!</p>
            </div>
          )}

          {/* Data (AI or local fallback) */}
          {!loading && data && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

              {/* AI unavailable banner */}
              {isLocalFallback && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 mb-4">
                  <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>
                    {aiErrorMsg} — показан локальный брифинг
                  </span>
                </div>
              )}

              {/* Greeting */}
              <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 mb-4">
                <p className="text-sm text-slate-700 dark:text-white/70 leading-relaxed">{data.greeting}</p>
              </div>

              {/* Focus tasks */}
              {data.focusTasks.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-[#ef4444]" />
                    <span className="text-xs text-slate-500 dark:text-white/50" style={{ fontWeight: 600 }}>ПРИОРИТЕТ СЕГОДНЯ</span>
                  </div>
                  <div className="space-y-2">
                    {data.focusTasks.map(({ id, reason }) => {
                      const task = findTask(id);
                      if (!task) return null;
                      return (
                        <motion.div key={id} whileHover={{ x: 2 }}
                          className="flex items-start gap-3 p-3 rounded-xl bg-red-50/60 dark:bg-red-500/8 border border-red-100 dark:border-red-500/15 cursor-pointer"
                          onClick={() => { onOpenTask?.(task.planId, id); handleClose(); }}>
                          <div className="w-5 h-5 rounded-full border-2 border-red-300 dark:border-red-500/40 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-900 dark:text-white truncate" style={{ fontWeight: 500 }}>{task.title}</p>
                            <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5">{reason}</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-white/20 shrink-0 mt-0.5" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optional tasks */}
              {data.optionalTasks.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
                    <span className="text-xs text-slate-400 dark:text-white/40" style={{ fontWeight: 600 }}>ЕСЛИ БУДЕТ ВРЕМЯ</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.optionalTasks.slice(0, 2).map(({ id }) => {
                      const task = findTask(id);
                      if (!task) return null;
                      return (
                        <div key={id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/8 transition-colors"
                          onClick={() => { onOpenTask?.(task.planId, id); handleClose(); }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 shrink-0" />
                          <span className="text-xs text-slate-600 dark:text-white/55 truncate">{task.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tip */}
              <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-[#1d4ed8]/8 border border-[#1d4ed8]/15 mb-5">
                <Sparkles className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0 mt-0.5" />
                <p className="text-xs text-[#1d4ed8]/80" style={{ fontWeight: 500 }}>{data.tip}</p>
              </div>

              <button onClick={handleClose}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm hover:opacity-90 transition-all shadow-md shadow-[#1d4ed8]/25 flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}>
                <Zap className="w-4 h-4" />
                Начать день
              </button>
            </motion.div>
          )}
        </div>

        {/* Safe area bottom spacer */}
        <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom)', minHeight: 12 }} />
      </motion.div>
    </div>
  );
}