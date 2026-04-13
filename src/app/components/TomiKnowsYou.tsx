/**
 * TomiKnowsYou — "Томи знает тебя" insights dashboard.
 * Shows behavioral patterns, AI insights, and "Что будет, если...?" feature.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Zap, Clock, TrendingUp, TrendingDown, AlertTriangle,
  Sparkles, Send, Loader2, ChevronRight, Target, Shield,
  Lightbulb, Flame, BarChart3, CalendarDays, Moon, Sun,
  HelpCircle, RefreshCw, ArrowRight, Star, Trophy, Heart,
  Activity, Coffee, Sunrise, Timer,
} from 'lucide-react';
import { TomiAvatar } from './TomiAssistant';
import { computeLocalInsights, getPatternSummaryForAI, type LocalInsights } from '../lib/patternTracker';
import { aiTomiInsights } from '../lib/api';
import { MoodHistoryWidget } from './MoodJournal';

// ── Day names ────────────────────────────────────────────────────────────────
const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

// ── Insight type colors ──────────────────────────────────────────────────────
const INSIGHT_COLORS: Record<string, { bg: string; border: string; icon: typeof Star; iconColor: string }> = {
  strength: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: Zap, iconColor: 'text-emerald-400' },
  risk:     { bg: 'bg-red-500/10',     border: 'border-red-500/25',     icon: AlertTriangle, iconColor: 'text-red-400' },
  pattern:  { bg: 'bg-[#1d4ed8]/15',   border: 'border-[#1d4ed8]/30',  icon: Brain, iconColor: 'text-blue-400' },
  tip:      { bg: 'bg-blue-500/10',    border: 'border-blue-500/25',   icon: Lightbulb, iconColor: 'text-blue-300' },
};

// ── Hour label ───────────────────────────────────────────────────────────────
function hourLabel(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

function hourPeriod(h: number): { icon: typeof Sun; label: string; color: string } {
  if (h >= 5 && h < 12) return { icon: Sunrise, label: 'Утро', color: 'text-blue-300' };
  if (h >= 12 && h < 17) return { icon: Sun, label: 'День', color: 'text-blue-400' };
  if (h >= 17 && h < 21) return { icon: Coffee, label: 'Вечер', color: 'text-blue-500' };
  return { icon: Moon, label: 'Ночь', color: 'text-blue-200' };
}

// ── Data readiness indicator ─────────────────────────────────────────────────
function DataReadiness({ richness, totalDays, totalEvents }: { richness: number; totalDays: number; totalEvents: number }) {
  const ready = richness >= 40;
  return (
    <div className={`rounded-2xl border p-4 ${ready ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-blue-400/25 bg-blue-500/5'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ready ? 'bg-emerald-500/15' : 'bg-blue-500/15'}`}>
          {ready
            ? <Brain className="w-5 h-5 text-emerald-400" />
            : <Timer className="w-5 h-5 text-blue-400" />}
        </div>
        <div>
          <p className={`text-sm font-semibold ${ready ? 'text-emerald-300' : 'text-blue-300'}`}>
            {ready ? 'Томи изучил тебя!' : 'Томи ещё учится...'}
          </p>
          <p className="text-xs text-white/50">
            {totalDays} дн. данных · {totalEvents} событий
          </p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${ready ? 'bg-emerald-500' : 'bg-[#1d4ed8]'}`}
          initial={{ width: 0 }}
          animate={{ width: `${richness}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[11px] text-white/40 mt-1.5">
        Обучение: {richness}% — {richness < 40 ? 'продолжай выполнять задачи для более точных инсайтов' : 'данных достаточно для анализа'}
      </p>
    </div>
  );
}

// ── Peak hours heatmap ───────────────────────────────────────────────────────
function PeakHoursChart({ peakHours }: { peakHours: LocalInsights['peakHours'] }) {
  const maxCount = Math.max(...peakHours.map(h => h.count), 1);

  // Fill all 24 hours
  const allHours = Array.from({ length: 24 }, (_, i) => {
    const found = peakHours.find(h => h.hour === i);
    return { hour: i, count: found?.count ?? 0 };
  });

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white/90">Пиковые часы</h3>
      </div>
      <div className="flex gap-[2px] items-end h-16">
        {allHours.map((h) => {
          const height = h.count > 0 ? Math.max(8, (h.count / maxCount) * 100) : 4;
          const opacity = h.count > 0 ? 0.3 + (h.count / maxCount) * 0.7 : 0.08;
          return (
            <motion.div
              key={h.hour}
              className="flex-1 rounded-t-sm bg-[#1d4ed8]"
              style={{ opacity }}
              initial={{ height: 0 }}
              animate={{ height: `${height}%` }}
              transition={{ duration: 0.6, delay: h.hour * 0.03 }}
              title={`${hourLabel(h.hour)}: ${h.count} задач`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-white/25">00:00</span>
        <span className="text-[9px] text-white/25">12:00</span>
        <span className="text-[9px] text-white/25">23:00</span>
      </div>
      {peakHours.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {peakHours.slice(0, 3).map(h => {
            const period = hourPeriod(h.hour);
            const Icon = period.icon;
            return (
              <span key={h.hour} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/8">
                <Icon className={`w-3 h-3 ${period.color}`} />
                <span className="text-white/70">{hourLabel(h.hour)}</span>
                <span className="text-white/30">({h.count})</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Peak days ────────────────────────────────────────────────────────────────
function PeakDaysChart({ peakDays }: { peakDays: LocalInsights['peakDays'] }) {
  const maxCount = Math.max(...peakDays.map(d => d.count), 1);
  const allDays = Array.from({ length: 7 }, (_, i) => {
    const found = peakDays.find(d => d.day === i);
    return { day: i, count: found?.count ?? 0 };
  });

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white/90">Продуктивные дни</h3>
      </div>
      <div className="space-y-1.5">
        {allDays.map(d => {
          const pct = d.count > 0 ? Math.max(5, (d.count / maxCount) * 100) : 0;
          const isTop = peakDays[0]?.day === d.day;
          return (
            <div key={d.day} className="flex items-center gap-2">
              <span className={`text-[11px] w-5 ${isTop ? 'text-white font-semibold' : 'text-white/40'}`}>
                {DAY_NAMES_SHORT[d.day]}
              </span>
              <div className="flex-1 h-4 rounded-md bg-white/4 overflow-hidden">
                <motion.div
                  className={`h-full rounded-md ${isTop ? 'bg-[#1d4ed8]' : 'bg-[#1d4ed8]/50'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: d.day * 0.05 }}
                />
              </div>
              <span className="text-[10px] text-white/30 w-5 text-right">{d.count || '-'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Productivity score circle ────────────────────────────────────────────────
function ScoreCircle({ score, label }: { score: number; label: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#3b82f6' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
        </div>
      </div>
      <p className="text-xs text-white/40 mt-1.5">{label}</p>
    </div>
  );
}

// ── Stats cards ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: typeof Star; label: string; value: string; subtext?: string; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-white/3 p-3 flex items-start gap-3"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/5`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-semibold">{value}</p>
        <p className="text-white/50 text-xs">{label}</p>
        {subtext && <p className="text-white/35 text-[11px] mt-0.5">{subtext}</p>}
      </div>
    </motion.div>
  );
}

// ── AI Insight card ──────────────────────────────────────────────────────────
function InsightCard({ insight, index }: {
  insight: { emoji: string; title: string; body: string; type: string };
  index: number;
}) {
  const config = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.pattern;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-xl border ${config.border} ${config.bg} p-3.5`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none mt-0.5">{insight.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">{insight.title}</p>
          <p className="text-white/65 text-xs mt-1 leading-relaxed">{insight.body}</p>
        </div>
        <Icon className={`w-4 h-4 ${config.iconColor} shrink-0 mt-0.5`} />
      </div>
    </motion.div>
  );
}

// ── What-If panel ────────────────────────────────────────────────────────────
function WhatIfPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    answer: string; confidence: number; impact: string; recommendation: string;
  } | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const EXAMPLE_QUESTIONS = [
    'Что если я возьму ещё один проект?',
    'Успею ли я к дедлайну?',
    'Что если буду работать только утром?',
    'Что если возьму выходной завтра?',
    'Что если увеличу нагрузку вдвое?',
  ];

  const ask = useCallback(async (q?: string) => {
    const query = q ?? question;
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const summary = getPatternSummaryForAI();
      const data = await aiTomiInsights({ patternSummary: summary, question: query });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка анализа');
      console.error('What-if error:', err);
    } finally {
      setLoading(false);
    }
  }, [question]);

  const impactColor = result?.impact === 'positive' ? 'text-emerald-400' : result?.impact === 'negative' ? 'text-red-400' : 'text-blue-300';
  const impactBg = result?.impact === 'positive' ? 'bg-emerald-500/10 border-emerald-500/25' : result?.impact === 'negative' ? 'bg-red-500/10 border-red-500/25' : 'bg-blue-500/10 border-blue-500/25';
  const impactLabel = result?.impact === 'positive' ? 'Позитивно' : result?.impact === 'negative' ? 'Негативно' : 'Нейтрально';

  return (
    <div className="rounded-2xl border border-[#1d4ed8]/30 bg-[#1d4ed8]/8 p-4">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white/90">Спроси будущего себя</h3>
      </div>
      <p className="text-xs text-white/40 mb-3">
        Задай вопрос «Что если…?» — Томи предскажет результат на основе твоих паттернов.
      </p>

      {/* Example chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {EXAMPLE_QUESTIONS.map((eq, i) => (
          <button
            key={i}
            onClick={() => { setQuestion(eq); ask(eq); }}
            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8 transition-all active:scale-95 touch-manipulation"
          >
            {eq}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }}}
          placeholder="Что если я..."
          rows={1}
          className="flex-1 resize-none text-sm text-white bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 placeholder-white/25 focus:outline-none focus:border-[#1d4ed8]/50 transition-colors"
        />
        <button
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          className="w-10 h-10 rounded-xl bg-[#1d4ed8] text-white flex items-center justify-center hover:bg-[#1e40af] transition-colors disabled:opacity-40 active:scale-95 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-3 rounded-xl border p-3.5 ${impactBg}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`text-xs font-semibold px-2 py-0.5 rounded-md ${impactBg} ${impactColor}`}>
                {impactLabel}
              </div>
              <div className="text-[10px] text-white/30">
                Уверенность: {result.confidence}%
              </div>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{result.answer}</p>
            {result.recommendation && (
              <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-lg bg-white/5 border border-white/8">
                <Lightbulb className="w-3.5 h-3.5 text-blue-300 shrink-0 mt-0.5" />
                <p className="text-xs text-white/60 leading-relaxed">{result.recommendation}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ── Postponement rate visual ─────────────────────────────────────────────────
function PostponementGauge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct <= 20 ? 'text-emerald-400' : pct <= 45 ? 'text-blue-300' : 'text-red-400';
  const barColor = pct <= 20 ? 'bg-emerald-500' : pct <= 45 ? 'bg-blue-500' : 'bg-red-500';
  const label = pct <= 20 ? 'Отлично!' : pct <= 45 ? 'Нормально' : 'Высоко';

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs text-white/60">Откладывание</span>
        </div>
        <span className={`text-xs font-semibold ${color}`}>{pct}% · {label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  );
}

// ── Mood vs Productivity ─────────────────────────────────────────────────────
function MoodProductivityChart({ data }: { data: LocalInsights['moodVsProductivity'] }) {
  if (data.length === 0) return null;
  const maxComp = Math.max(...data.map(d => d.avgCompletions), 1);
  const MOOD_EMOJI = ['', '😞', '😐', '🙂', '😊', '🤩'];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-semibold text-white/90">Настроение → Продуктивность</h3>
      </div>
      <div className="space-y-2">
        {data.map(d => {
          const pct = Math.max(8, (d.avgCompletions / maxComp) * 100);
          return (
            <div key={d.mood} className="flex items-center gap-2">
              <span className="text-base w-6 text-center">{MOOD_EMOJI[d.mood] || '❓'}</span>
              <div className="flex-1 h-5 rounded-md bg-white/4 overflow-hidden">
                <motion.div
                  className="h-full rounded-md bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6]"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              <span className="text-[11px] text-white/40 w-12 text-right">{d.avgCompletions} задач</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Priority breakdown ───────────────────────────────────────────────────────
function PriorityBreakdown({ data }: { data: LocalInsights['completionsByPriority'] }) {
  const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
    high:   { label: 'Высокий', color: 'bg-red-500' },
    medium: { label: 'Средний', color: 'bg-blue-500' },
    low:    { label: 'Низкий',  color: 'bg-blue-400' },
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <Target className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs text-white/60">По приоритетам</span>
      </div>
      <div className="space-y-1.5">
        {data.map(p => {
          const config = PRIORITY_LABELS[p.priority];
          return (
            <div key={p.priority} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config?.color ?? 'bg-gray-500'}`} />
              <span className="text-[11px] text-white/50 w-16">{config?.label}</span>
              <span className="text-[11px] text-white/70 font-medium">{p.count}</span>
              <span className="text-[10px] text-white/30 ml-auto">{Math.round(p.rate * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TomiKnowsYou() {
  const [insights, setInsights] = useState<LocalInsights | null>(null);
  const [aiInsights, setAiInsights] = useState<{
    greeting: string;
    insights: { emoji: string; title: string; body: string; type: string }[];
    personalityProfile: string;
    topRecommendation: string;
    predictedDropoffDay: number | null;
    productivityScore: number;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'whatif'>('overview');

  // Load local insights
  useEffect(() => {
    setInsights(computeLocalInsights());
  }, []);

  // Fetch AI insights
  const fetchAI = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      const summary = getPatternSummaryForAI();
      const data = await aiTomiInsights({ patternSummary: summary });
      setAiInsights(data);
    } catch (err: any) {
      setAiError(err.message || 'Ошибка загрузки инсайтов');
      console.error('AI insights error:', err);
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading]);

  // Auto-fetch AI on tab switch
  useEffect(() => {
    if (activeTab === 'ai' && !aiInsights && !aiLoading) {
      fetchAI();
    }
  }, [activeTab, aiInsights, aiLoading, fetchAI]);

  if (!insights) return null;

  const bestHour = insights.peakHours[0];
  const bestDay = insights.peakDays[0];

  return (
    <div className="space-y-5">
      {/* Header with Tomi avatar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <TomiAvatar size={56} mood="happy" />
        </motion.div>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Томи знает тебя
            <Sparkles className="w-5 h-5 text-[#1d4ed8]" />
          </h1>
          <p className="text-sm text-white/60">
            Персональный анализ твоих паттернов продуктивности
          </p>
        </div>
      </motion.div>

      {/* Data readiness */}
      <DataReadiness
        richness={insights.dataRichness}
        totalDays={insights.totalDays}
        totalEvents={insights.totalEvents}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-white/4 rounded-xl p-1">
        {([
          { id: 'overview', label: 'Обзор', icon: BarChart3 },
          { id: 'ai', label: 'AI-инсайты', icon: Brain },
          { id: 'whatif', label: 'Что если?', icon: HelpCircle },
        ] as const).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${
                active ? 'bg-[#1d4ed8] text-white shadow-lg' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview tab ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Key stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard
                icon={TrendingUp}
                label="Среднее в день"
                value={`${insights.avgCompletionsPerDay.toFixed(1)} задач`}
                color="text-emerald-400"
              />
              <StatCard
                icon={Flame}
                label="Текущий стрик"
                value={`${insights.currentStreak} дн.`}
                subtext={`Рекорд: ${insights.longestStreak}`}
                color="text-blue-400"
              />
              <StatCard
                icon={Clock}
                label="Лучшее время"
                value={bestHour ? hourLabel(bestHour.hour) : '—'}
                subtext={bestHour ? `${bestHour.count} задач` : undefined}
                color="text-blue-400"
              />
              <StatCard
                icon={CalendarDays}
                label="Лучший день"
                value={bestDay ? DAY_NAMES_FULL[bestDay.day] : '—'}
                subtext={bestDay ? `${bestDay.count} задач` : undefined}
                color="text-blue-400"
              />
            </div>

            {/* Peak hours heatmap */}
            <PeakHoursChart peakHours={insights.peakHours} />

            {/* Peak days */}
            <PeakDaysChart peakDays={insights.peakDays} />

            {/* Postponement gauge */}
            <PostponementGauge rate={insights.postponementRate} />

            {/* Mood vs Productivity */}
            {insights.moodVsProductivity.length > 0 && (
              <MoodProductivityChart data={insights.moodVsProductivity} />
            )}

            {/* Mood History Journal */}
            <MoodHistoryWidget />

            {/* Priority breakdown */}
            <PriorityBreakdown data={insights.completionsByPriority} />

            {/* Session stats */}
            {insights.avgSessionMinutes > 0 && (
              <StatCard
                icon={Timer}
                label="Средняя сессия"
                value={`${insights.avgSessionMinutes} мин`}
                color="text-blue-400"
              />
            )}

            {/* Danger zone warning */}
            {insights.dangerZonePercent !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 flex items-start gap-3"
              >
                <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Зона риска: {insights.dangerZonePercent}%</p>
                  <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
                    Томи заметил, что ты обычно замедляешься, достигнув ~{insights.dangerZonePercent}% прогресса.
                    Когда приблизишься — Томи включит усиленную мотивацию!
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── AI Insights tab ───────────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {aiLoading && (
              <div className="flex flex-col items-center py-12 gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Brain className="w-10 h-10 text-[#1d4ed8]" />
                </motion.div>
                <p className="text-sm text-white/40">Томи анализирует твои паттерны...</p>
              </div>
            )}

            {aiError && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-center">
                <p className="text-sm text-red-400">{aiError}</p>
                <button
                  onClick={fetchAI}
                  className="mt-2 text-xs text-white/40 hover:text-white/60 flex items-center gap-1 mx-auto"
                >
                  <RefreshCw className="w-3 h-3" /> Повторить
                </button>
              </div>
            )}

            {aiInsights && !aiLoading && (
              <>
                {/* Productivity score + greeting */}
                <div className="rounded-2xl border border-[#1d4ed8]/20 bg-[#1d4ed8]/5 p-4 flex items-center gap-4">
                  <ScoreCircle score={aiInsights.productivityScore} label="Продуктивность" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 leading-relaxed">{aiInsights.greeting}</p>
                  </div>
                </div>

                {/* Personality profile */}
                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white/90">Твой рабочий стиль</h3>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">{aiInsights.personalityProfile}</p>
                </div>

                {/* Top recommendation */}
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 flex items-start gap-3">
                  <Star className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300 mb-0.5">Главная рекомендация</p>
                    <p className="text-xs text-white/55 leading-relaxed">{aiInsights.topRecommendation}</p>
                  </div>
                </div>

                {/* AI insight cards */}
                <div className="space-y-2.5">
                  {aiInsights.insights.map((ins, i) => (
                    <InsightCard key={i} insight={ins} index={i} />
                  ))}
                </div>

                {/* Predicted dropoff */}
                {aiInsights.predictedDropoffDay && (
                  <div className="rounded-xl border border-blue-400/25 bg-blue-500/5 p-3.5 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-300 mb-0.5">Прогноз Томи</p>
                      <p className="text-xs text-white/55 leading-relaxed">
                        Судя по паттернам, через ~{aiInsights.predictedDropoffDay} дней возможно снижение мотивации.
                        Томи автоматически включит усиленную поддержку в этот период!
                      </p>
                    </div>
                  </div>
                )}

                {/* Refresh button */}
                <button
                  onClick={fetchAI}
                  disabled={aiLoading}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-medium hover:bg-white/8 hover:text-white/60 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Обновить анализ
                </button>
              </>
            )}

            {/* Not enough data fallback */}
            {!insights.dataReady && !aiLoading && !aiInsights && (
              <div className="rounded-2xl border border-white/8 bg-white/3 p-6 text-center">
                <Brain className="w-12 h-12 text-white/15 mx-auto mb-3" />
                <p className="text-sm text-white/50 mb-1">Недостаточно данных</p>
                <p className="text-xs text-white/30">
                  Продолжай пользоваться Vecto — через несколько дней Томи составит персональный анализ
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── What-If tab ───────────────────────────────────────────────────── */}
        {activeTab === 'whatif' && (
          <motion.div
            key="whatif"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <WhatIfPanel />

            {/* Tip */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-3.5 flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
              <p className="text-xs text-white/40 leading-relaxed">
                Томи отвечает на основе реальных данных о твоём поведении. Чем больше ты
                пользуешься Vecto, тем точнее прогнозы.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}