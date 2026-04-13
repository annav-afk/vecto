import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Target, Calendar, Search,
  ListChecks, Cloud, Loader2, Sun, Zap, SortAsc,
  Circle, ChevronRight,
  Filter, Brain, Share2,
} from 'lucide-react';
import { Plan, Task } from '../lib/types';
import { getPlans, deletePlan, getMonthlyUsage, savePlan } from '../lib/storage';
import { getCloudPlans, deleteCloudPlan, getCloudUsage, saveCloudPlan } from '../lib/api';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { Navbar } from '../components/Navbar';
import { PaywallModal } from '../components/PaywallModal';
import { AuthModal } from '../components/AuthModal';
import { OnboardingChecklist, markChecklistStep } from '../components/OnboardingChecklist';
import { MorningBriefing, shouldShowBriefing } from '../components/MorningBriefing';
import { TodayWidget } from '../components/TodayWidget';
import { AuroraBackground } from '../components/AuroraBackground';
import { TomiAvatar } from '../components/TomiAssistant';
import { useAuth } from '../lib/auth';
import { playClick } from '../lib/sounds';
import { getPlanLimit, TIERS } from '../lib/plans';
import { computeLocalInsights } from '../lib/patternTracker';
import { MoodPickerFloat, shouldShowMoodCheck } from '../components/MoodJournal';
import { TomiOnboardingQuiz, useTomiOnboardingQuiz } from '../components/TomiOnboardingQuiz';
import { UpgradeTrigger, shouldShowUpgradeTrigger } from '../components/UpgradeTrigger';
import { ShareAchievement } from '../components/ShareAchievement';

// ── Dark mode glass helper ───────────────────────────────────────────────────
function useIsDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const GLASS_LIGHT = {
  bg: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.88)',
  shadow: '0 4px 24px rgba(29,78,216,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
};
const GLASS_DARK = {
  bg: 'rgba(13,26,54,0.65)',
  border: '1px solid rgba(255,255,255,0.08)',
  shadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
};
function glass(dark: boolean) { return dark ? GLASS_DARK : GLASS_LIGHT; }

const GLASS_INPUT_LIGHT = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 2px 12px rgba(29,78,216,0.06)',
};
const GLASS_INPUT_DARK = {
  background: 'rgba(13,26,54,0.6)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
};
function glassInput(dark: boolean) { return dark ? GLASS_INPUT_DARK : GLASS_INPUT_LIGHT; }

function getProgress(plan: Plan) {
  const all = plan.phases.flatMap(p => p.tasks);
  if (!all.length) return 0;
  return Math.round((all.filter(t => t.status === 'done').length / all.length) * 100);
}
function getNextTask(plan: Plan): Task | null {
  for (const phase of plan.phases) {
    const t = phase.tasks.find(t => t.status !== 'done');
    if (t) return t;
  }
  return null;
}
function pluralize(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

type SortKey = 'newest' | 'oldest' | 'progress_asc' | 'progress_desc' | 'deadline';
type StatusFilter = 'all' | 'active' | 'done';

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest',        label: 'Новые сначала' },
  { id: 'oldest',        label: 'Старые сначала' },
  { id: 'deadline',      label: 'По дедлайну' },
  { id: 'progress_desc', label: 'Прогресс ↑' },
  { id: 'progress_asc',  label: 'Прогресс ↓' },
];

// ── Glass Plan Card ───────────────────────────────────────────────────────────

/* ── Circular Progress Ring ──────────────────────────────────────────────── */
function CircularProgress({ progress, size = 44, strokeWidth = 3.5, accentColor = '#1d4ed8', delay = 0 }: {
  progress: number; size?: number; strokeWidth?: number; accentColor?: string; delay?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  const color = progress === 100 ? '#10b981' : progress >= 70 ? '#10b981' : progress >= 40 ? accentColor : '#f59e0b';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(29,78,216,0.08)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, delay: delay * 0.05 + 0.3, ease: [0.33, 1, 0.68, 1] }}
        />
      </svg>
      <span className="absolute text-[10px] tabular-nums" style={{ fontWeight: 700, color }}>
        {progress}%
      </span>
    </div>
  );
}

function PlanCard({ plan, index, onDelete, onClick, isDark }: {
  plan: Plan; index: number;
  onDelete: (id: string) => void;
  onClick: () => void;
  isDark: boolean;
}) {
  const progress   = getProgress(plan);
  const nextTask   = getNextTask(plan);
  const totalTasks = plan.phases.flatMap(p => p.tasks).length;
  const doneTasks  = plan.phases.flatMap(p => p.tasks).filter(t => t.status === 'done').length;
  const daysLeft   = differenceInDays(parseISO(plan.deadline), new Date());
  const isDone     = progress === 100;
  const isOverdue  = daysLeft < 0 && !isDone;

  const deadlineColor = isDone ? '#10b981' : isOverdue ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#64748b';
  const deadlineLabel = isDone ? 'Выполнен ✓'
    : isOverdue ? `Просрочен ${Math.abs(daysLeft)}д`
    : daysLeft === 0 ? 'Дедлайн сегодня!'
    : `${daysLeft} ${pluralize(daysLeft, 'день', 'дня', 'дней')}`;

  // dominant phase color for glow
  const accentColor = plan.phases[0]?.color ?? '#1d4ed8';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      onClick={onClick}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative rounded-3xl overflow-hidden cursor-pointer noise-overlay"
      style={{
        background: isDark ? GLASS_DARK.bg : GLASS_LIGHT.bg,
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: isDark ? GLASS_DARK.border : GLASS_LIGHT.border,
        boxShadow: isDark ? GLASS_DARK.shadow : GLASS_LIGHT.shadow,
        transition: 'box-shadow 0.3s, transform 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = isDark
          ? `0 16px 48px rgba(0,0,0,0.4), 0 4px 16px ${accentColor}20`
          : `0 16px 48px ${accentColor}28, 0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = isDark ? GLASS_DARK.shadow : GLASS_LIGHT.shadow;
      }}
    >
      {/* Phase color strip */}
      <div className="h-1 w-full flex overflow-hidden">
        {plan.phases.map(ph => (
          <div key={ph.id} className="flex-1 h-full" style={{ background: ph.color }} />
        ))}
      </div>

      {/* Gradient overlay hint */}
      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${accentColor}08, transparent 60%)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-slate-900 dark:text-white text-sm leading-snug flex-1 font-bold pr-1">
            {plan.goal.length > 70 ? plan.goal.slice(0, 70) + '…' : plan.goal}
          </h3>
          <button
            onClick={e => { e.stopPropagation(); onDelete(plan.id); }}
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: 'rgba(239,68,68,0)', border: '1px solid transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0)';
              (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
            }}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Target className="w-3 h-3" />{totalTasks} задач
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-200" />
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: deadlineColor }}>
            <Calendar className="w-3 h-3" />{deadlineLabel}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4 flex items-center gap-3">
          <CircularProgress progress={progress} size={44} strokeWidth={3.5} accentColor={accentColor} delay={index} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-400 font-medium mb-0.5">{doneTasks}/{totalTasks} выполнено</div>
            <div className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(29,78,216,0.08)' }}>
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: progress === 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : `linear-gradient(90deg, ${accentColor}dd, ${accentColor})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.9, delay: index * 0.05 + 0.2, ease: 'easeOut' }}
              >
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)', animation: 'shimmer-slide 2s linear infinite' }} />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Next task */}
        {nextTask && !isDone && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-4"
            style={{ background: 'rgba(29,78,216,0.05)', border: '1px solid rgba(29,78,216,0.1)' }}>
            <Circle className="w-3 h-3 text-[#1d4ed8] shrink-0" />
            <span className="text-xs text-slate-500 dark:text-white/50 truncate">
              <span className="font-semibold text-slate-700">Далее: </span>{nextTask.title}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {plan.phases.slice(0, 5).map(ph => (
              <div key={ph.id} className="w-2 h-2 rounded-full"
                style={{ background: ph.color, opacity: ph.tasks.some(t => t.status !== 'done') ? 1 : 0.35 }} />
            ))}
            {plan.phases.length > 5 && (
              <span className="text-[10px] text-slate-400 ml-0.5">+{plan.phases.length - 5}</span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#1d4ed8] transition-colors font-semibold">
            Открыть <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Glass Empty State ─────────────────────────────────────────────────────────
function EmptyState({ onNew, onAuth, isLoggedIn }: { onNew: () => void; onAuth: () => void; isLoggedIn: boolean }) {
  const examples = [
    { goal: 'Запустить SaaS за 3 месяца', phases: 4, emoji: '🚀', color: '#1d4ed8' },
    { goal: 'Выучить Python до Junior',   phases: 5, emoji: '🐍', color: '#10b981' },
    { goal: 'Похудеть на 10 кг',          phases: 3, emoji: '💪', color: '#f59e0b' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-10">
      <div className="flex justify-center mb-8">
        <div className="relative">
          {/* Tomi mascot floating */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10"
          >
            {/* Glow behind mascot */}
            <motion.div
              animate={{ scale: [1, 1.18, 1], opacity: [0.2, 0.45, 0.2] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(29,78,216,0.4) 0%, transparent 70%)', margin: '-20px' }}
            />
            <TomiAvatar size={96} mood="excited" />
          </motion.div>
          {/* Orbiting dots */}
          {[0,1,2].map(i => (
            <motion.div key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{ background: ['#2563eb','#10b981','#f59e0b'][i], top: '50%', left: '50%' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'linear' }}
              transformOrigin="-44px 0"
            />
          ))}
        </div>
      </div>

      <div className="text-center max-w-md mx-auto mb-3">
        <p className="text-xs font-semibold text-[#1d4ed8] uppercase tracking-wider mb-2 opacity-70">Томи ждёт вашу цель</p>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.5rem' }}
          className="text-slate-900 dark:text-white mb-3">
          Нет планов — нет прогресса
        </h2>
        <p className="text-slate-500 dark:text-white/50 text-sm leading-relaxed">
          Опишите цель — Томи разобьёт её на этапы, задачи, расставит приоритеты и сроки.
        </p>
      </div>

      {/* Speech bubble from Tomi */}
      <div className="flex justify-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm text-[#1d4ed8] font-medium"
          style={{
            background: 'rgba(29,78,216,0.07)',
            border: '1px solid rgba(29,78,216,0.15)',
          }}
        >
          <span>💬</span>
          Привет! Расскажи мне о своей цели, я всё распланирую
        </motion.div>
      </div>

      {/* Example cards */}
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-10">
        {examples.map((ex, i) => (
          <motion.div key={ex.goal}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
            className="p-4 rounded-2xl text-left noise-overlay"
            style={{
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.85)',
              boxShadow: '0 4px 20px rgba(29,78,216,0.06)',
            }}
          >
            <div className="text-2xl mb-2">{ex.emoji}</div>
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1 leading-tight">{ex.goal}</p>
            <p className="text-xs text-slate-400">{ex.phases} этапа · AI-план</p>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: ex.phases }).map((_, j) => (
                <div key={j} className="flex-1 h-1.5 rounded-full"
                  style={{ background: ['#1d4ed8','#2563eb','#10b981','#f59e0b','#1e40af'][j % 5] }} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <motion.button onClick={onNew} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 8px 28px rgba(29,78,216,0.35)' }}>
          <Zap className="w-4 h-4" /> Создать первый план
        </motion.button>
        {!isLoggedIn && (
          <button onClick={onAuth}
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(29,78,216,0.07)', border: '1px solid rgba(29,78,216,0.15)', color: '#1d4ed8' }}>
            <Cloud className="w-4 h-4" /> Войти и восстановить
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Tomi Insights Card ────────────────────────────────────────────────────────
function TomiInsightsCard({ isDark, onShare }: { isDark: boolean; onShare?: () => void }) {
  const navigate = useNavigate();
  const insights = computeLocalInsights();
  const g = glass(isDark);

  const bestHour = insights.peakHours[0];
  const streak = insights.currentStreak;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-6 rounded-2xl p-4 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-transform touch-manipulation"
      style={{ background: g.bg, border: g.border, boxShadow: g.shadow }}
    >
      <div className="flex items-center gap-3" onClick={() => navigate('/tomi-insights')}>
        <div className="w-10 h-10 rounded-xl bg-[#1d4ed8]/15 flex items-center justify-center">
          <Brain className="w-5 h-5 text-[#1d4ed8]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Томи знает тебя
          </p>
          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
            {insights.dataReady
              ? `${insights.totalDays} дн. данных · Стрик ${streak} · Пик: ${bestHour ? `${bestHour.hour}:00` : '—'}`
              : `Данные: ${insights.dataRichness}% · Продолжай пользоваться Vecto`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Share achievement button */}
          {insights.currentStreak >= 1 && onShare && (
            <button
              onClick={e => { e.stopPropagation(); onShare(); }}
              title="Поделиться достижением"
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${isDark ? 'bg-white/8 hover:bg-[#1d4ed8]/20' : 'bg-[#1d4ed8]/08 hover:bg-[#1d4ed8]/15'}`}
            >
              <Share2 className="w-3.5 h-3.5 text-[#1d4ed8]" />
            </button>
          )}
          {/* Mini richness indicator */}
          <div className="w-8 h-8 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(29,78,216,0.1)'} strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none"
                stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${insights.dataRichness * 0.88} 88`}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold ${isDark ? 'text-white/60' : 'text-[#1d4ed8]'}`}>
              {insights.dataRichness}
            </span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white/20' : 'text-slate-400'}`} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const navigate = useNavigate();
  const { user, token, setSyncStatus, tier } = useAuth();
  const isDark = useIsDark();

  const [plans,         setPlans]         = useState<Plan[]>(() => getPlans());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [showAuth,      setShowAuth]      = useState(false);
  const [cloudLoading,  setCloudLoading]  = useState(false);
  const [usage,         setUsage]         = useState(() => getMonthlyUsage());
  const [activeTab,     setActiveTab]     = useState<'plans' | 'today'>('plans');
  const [showBriefing,  setShowBriefing]  = useState(false);
  const [sortKey,       setSortKey]       = useState<SortKey>('newest');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [showSortMenu,  setShowSortMenu]  = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showUpgradeTrigger, setShowUpgradeTrigger] = useState(false);
  const [showShareAchievement, setShowShareAchievement] = useState(false);
  const { show: showQuiz, dismiss: dismissQuiz } = useTomiOnboardingQuiz();

  // Show mood picker after a delay
  useEffect(() => {
    const t = setTimeout(() => {
      if (shouldShowMoodCheck()) setShowMoodPicker(true);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Show upgrade trigger after a delay if eligible
  useEffect(() => {
    const t = setTimeout(() => {
      if (shouldShowUpgradeTrigger(tier)) setShowUpgradeTrigger(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [tier]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (shouldShowBriefing() && plans.length > 0) setShowBriefing(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const syncFromCloud = useCallback(async () => {
    if (!token) return;
    setCloudLoading(true); setSyncStatus('syncing');
    try {
      const [cloudPlans, cloudUsage] = await Promise.all([getCloudPlans(token), getCloudUsage(token)]);

      // Merge: cloud is authoritative, but keep local-only plans and push them
      const localPlans = getPlans();
      const cloudIds = new Set(cloudPlans.map(cp => cp.id));
      const localOnly = localPlans.filter(lp => !cloudIds.has(lp.id));

      // Save cloud plans to local
      cloudPlans.forEach(cp => savePlan(cp));
      // Push local-only plans to cloud
      for (const lp of localOnly) {
        savePlan(lp); // ensure local
        try { await saveCloudPlan(lp, token); } catch {}
      }

      setPlans(getPlans());
      setUsage(Math.max(getMonthlyUsage(), cloudUsage));
      setSyncStatus('synced');
    } catch { setSyncStatus('error'); }
    finally { setCloudLoading(false); }
  }, [token, setSyncStatus]);

  useEffect(() => { if (token) syncFromCloud(); else setSyncStatus('idle'); }, [token, syncFromCloud, setSyncStatus]);

  const handleDelete = async (id: string) => {
    const prev = plans;
    setPlans(p => p.filter(x => x.id !== id)); setDeleteConfirm(null); toast.success('План удалён'); deletePlan(id);
    if (token) {
      setSyncStatus('syncing');
      try { await deleteCloudPlan(id, token); setSyncStatus('synced'); }
      catch { setPlans(prev); const d = prev.find(p => p.id === id); if (d) savePlan(d); toast.error('Не удалось удалить'); setSyncStatus('error'); }
    }
  };

  const planLimit = getPlanLimit(tier);
  const handleNewPlan = () => { if (usage >= planLimit) { setShowPaywall(true); return; } navigate('/new'); };

  const processed = useMemo(() => {
    let list = [...plans];
    if (search) list = list.filter(p => p.goal.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === 'active') list = list.filter(p => getProgress(p) < 100);
    if (statusFilter === 'done')   list = list.filter(p => getProgress(p) === 100);
    list.sort((a, b) => {
      if (sortKey === 'newest')        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortKey === 'oldest')        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === 'deadline')      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (sortKey === 'progress_desc') return getProgress(b) - getProgress(a);
      if (sortKey === 'progress_asc')  return getProgress(a) - getProgress(b);
      return 0;
    });
    return list;
  }, [plans, search, sortKey, statusFilter]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen text-slate-900 dark:text-white">
      {/* Page background */}
      <div className="fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f0f4ff 40%, #e8f5ff 100%)' }}>
        <div className="hidden dark:block absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #060d1e 0%, #070f1e 100%)' }} />
        <AuroraBackground variant="dashboard" />
      </div>

      <Navbar
        rightContent={
          <div className="flex items-center gap-2">
            {/* Брифинг — icon-only on mobile, text on sm+ */}
            <button onClick={() => setShowBriefing(true)} title="Утренний брифинг"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-slate-500 dark:text-white/50 hover:text-[#1d4ed8] text-xs transition-all"
              style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.9)' }}>
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Брифинг</span>
            </button>
            {/* Новый план — hidden on mobile (MobileTabBar handles it) */}
            <motion.button onClick={handleNewPlan} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 4px 16px rgba(29,78,216,0.4)' }}>
              <Plus className="w-4 h-4" />
              Новый план
            </motion.button>
          </div>
        }
      />

      <AnimatePresence>
        {showBriefing && (
          <MorningBriefing plans={plans} onClose={() => setShowBriefing(false)}
            onOpenTask={(planId) => navigate(`/plan/${planId}`)} />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
        style={{ paddingBottom: 'max(7rem, calc(5.5rem + env(safe-area-inset-bottom)))' }}
        >

        {/* Tab switcher — glass */}
        <div className="flex items-center gap-1 mb-7 w-fit p-1.5 rounded-2xl"
          style={glassInput(isDark)}>
          {([
            { id: 'plans' as const, label: 'Мои планы', icon: ListChecks },
            { id: 'today' as const, label: 'Сегодня',   icon: Zap },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => { playClick(); setActiveTab(tab.id); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all font-semibold ${
                activeTab === tab.id ? 'text-white shadow-md' : 'text-slate-500 dark:text-white/40 hover:text-slate-700'
              }`}
              style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 4px 12px rgba(29,78,216,0.35)' } : {}}>
              <tab.icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'today' && (
          <TodayWidget plans={plans} onTaskClick={planId => navigate(`/plan/${planId}`)} />
        )}

        {activeTab === 'plans' && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.65rem' }}
                  className="text-slate-900 dark:text-white leading-tight">
                  Мои планы
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-slate-400 dark:text-white/45 text-sm">
                    {plans.length === 0 ? 'Создайте первый план'
                      : `${plans.length} ${pluralize(plans.length, 'план', 'плана', 'планов')}`}
                  </p>
                  {cloudLoading && (
                    <span className="flex items-center gap-1 text-xs text-[#1d4ed8] font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />Синхронизация...
                    </span>
                  )}
                  {!user && !cloudLoading && (
                    <button onClick={() => setShowAuth(true)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1d4ed8] transition-colors">
                      <Cloud className="w-3 h-3" />Войдите для синхронизации
                    </button>
                  )}
                </div>
              </div>

              {/* Usage dots */}
              <div className="shrink-0 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-xs text-slate-400 font-medium">
                    Тариф: <span className="font-bold" style={{ color: TIERS[tier].color }}>{TIERS[tier].name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap max-w-[220px] sm:max-w-none">
                  {Array.from({ length: Math.min(planLimit, 50) }).map((_, i) => (
                    <div key={i} className="h-2 rounded-full transition-all shrink-0"
                      style={{
                        width: planLimit <= 10 ? 16 : planLimit <= 20 ? 8 : 4,
                        background: i < usage ? TIERS[tier].color : `${TIERS[tier].color}18`,
                      }} />
                  ))}
                  <span className="text-xs text-slate-400 ml-1 font-medium whitespace-nowrap">{usage}/{planLimit}</span>
                </div>
              </div>
            </div>

            {/* Search + filter + sort — glass toolbar */}
            {plans.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск по целям..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition-all"
                    style={glassInput(isDark)}
                    onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.12), 0 2px 12px rgba(29,78,216,0.08)')}
                    onBlur={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(29,78,216,0.06)')}
                  />
                </div>

                {/* Status filter pills */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
                  style={glassInput(isDark)}>
                  {(['all','active','done'] as StatusFilter[]).map((f, fi) => (
                    <button key={f} onClick={() => { playClick(); setStatusFilter(f); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        statusFilter === f ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      style={statusFilter === f ? { background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 2px 8px rgba(29,78,216,0.3)' } : {}}>
                      {['Все','Активные','Готовые'][fi]}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <div className="relative">
                  <button onClick={() => { playClick(); setShowSortMenu(s => !s); }}
                    className="w-full sm:w-auto flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-600 dark:text-white/50 text-xs font-semibold whitespace-nowrap transition-all"
                    style={glassInput(isDark)}>
                    <SortAsc className="w-3.5 h-3.5" />
                    {SORT_OPTIONS.find(s => s.id === sortKey)?.label}
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                        <motion.div initial={{ opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 sm:left-auto right-0 top-full mt-2 z-20 rounded-2xl overflow-hidden min-w-[180px]"
                          style={{ ...glassInput(isDark), boxShadow: '0 16px 48px rgba(29,78,216,0.14)' }}>
                          {SORT_OPTIONS.map(opt => (
                            <button key={opt.id} onClick={() => { playClick(); setSortKey(opt.id); setShowSortMenu(false); }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                sortKey === opt.id ? 'font-semibold text-[#1d4ed8]' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              style={sortKey === opt.id ? { background: 'rgba(29,78,216,0.07)' } : {}}>
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Grid */}
            {plans.length === 0 ? (
              <EmptyState onNew={handleNewPlan} onAuth={() => setShowAuth(true)} isLoggedIn={!!user} />
            ) : processed.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <Filter className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-3">Ничего не найдено</p>
                <button onClick={() => { setSearch(''); setStatusFilter('all'); }}
                  className="text-xs text-[#1d4ed8] hover:underline font-semibold">
                  Сбросить фильтры
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence>
                  {processed.map((plan, i) => (
                    <PlanCard key={plan.id} plan={plan} index={i}
                      onDelete={id => setDeleteConfirm(id)}
                      onClick={() => { navigate(`/plan/${plan.id}`); markChecklistStep('create_plan'); }}
                      isDark={isDark} />
                  ))}
                </AnimatePresence>

                {usage < planLimit && (
                  <motion.button
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: processed.length * 0.05 }}
                    onClick={handleNewPlan}
                    whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(29,78,216,0.15)' }}
                    className="group p-5 rounded-3xl flex flex-col items-center justify-center gap-3 min-h-44 transition-all"
                    style={{ ...glassInput(isDark), border: '1.5px dashed rgba(29,78,216,0.2)' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                      style={{ background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.15)' }}>
                      <Plus className="w-6 h-6 text-[#1d4ed8]/70" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-500 group-hover:text-[#1d4ed8] transition-colors">Новый план</p>
                      <p className="text-xs text-slate-400 mt-0.5">{planLimit - usage} из {planLimit} осталось</p>
                    </div>
                  </motion.button>
                )}
              </div>
            )}

            {/* Tomi Knows You — card */}
            <TomiInsightsCard isDark={isDark} onShare={() => setShowShareAchievement(true)} />

            <div className="mt-8 max-w-sm"><OnboardingChecklist /></div>
          </>
        )}
      </div>

      {/* Delete modal — glass */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
              onClick={() => setDeleteConfirm(null)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl noise-overlay"
              style={{
                background: isDark ? 'rgba(13,26,54,0.95)' : 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(28px)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '0 none',
                boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
                padding: '1.75rem 1.75rem max(1.75rem, env(safe-area-inset-bottom))',
              }}>
              {/* Drag handle */}
              <div className="sm:hidden sheet-handle mb-4" />
              <h3 className="text-slate-900 dark:text-white font-bold mb-2 text-lg">Удалить план?</h3>
              <p className="text-slate-500 dark:text-white/50 text-sm mb-6">
                {user ? 'Удалится и в облаке, и локально.' : 'Все задачи будут удалены.'} Это нельзя отменить.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-2xl text-slate-600 text-sm font-semibold transition-all min-h-[44px]"
                  style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}>
                  Отмена
                </button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-3 rounded-2xl text-red-600 text-sm font-bold transition-all min-h-[44px]"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} reason="limit" />}
      <AnimatePresence>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </AnimatePresence>

      {/* Mood Picker */}
      <AnimatePresence>
        {showMoodPicker && (
          <MoodPickerFloat onClose={() => setShowMoodPicker(false)} />
        )}
      </AnimatePresence>

      {/* Upgrade Trigger */}
      <AnimatePresence>
        {showUpgradeTrigger && (
          <UpgradeTrigger onClose={() => setShowUpgradeTrigger(false)} />
        )}
      </AnimatePresence>

      {/* Share Achievement */}
      <AnimatePresence>
        {showShareAchievement && (
          <ShareAchievement onClose={() => setShowShareAchievement(false)} />
        )}
      </AnimatePresence>

      {/* Tomi Onboarding Quiz */}
      <AnimatePresence>
        {showQuiz && (
          <TomiOnboardingQuiz
            onComplete={(_mode) => dismissQuiz()}
            onSkip={dismissQuiz}
          />
        )}
      </AnimatePresence>
    </div>
  );
}