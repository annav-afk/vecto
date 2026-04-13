/**
 * TomiPreventiveCoach — Detects risk of productivity drop-off and proactively
 * suggests task simplifications. Uses AI to generate specific recommendations.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, Shield, Zap, Brain, Sparkles, ArrowRight,
  Check, X, ChevronDown, Loader2, Flame, Target, Clock,
  TrendingDown, RefreshCw, Heart,
} from 'lucide-react';
import { TomiAvatar } from './TomiAssistant';
import { computeLocalInsights, getPatternSummaryForAI, getRawPatterns } from '../lib/patternTracker';
import { aiTomiPreventive } from '../lib/api';
import { playClick, playComplete } from '../lib/sounds';
import { Plan, Task } from '../lib/types';
import { toast } from 'sonner';

// ── Risk detection ──────────────────────────────────────────────────────────
export interface RiskSignals {
  level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  reasons: string[];
  daysUntilDropoff: number | null;
}

const RISK_CHECK_KEY = 'stride_risk_last_check';
const RISK_DISMISS_KEY = 'stride_risk_dismissed';

export function detectRiskSignals(): RiskSignals {
  const insights = computeLocalInsights();
  const patterns = getRawPatterns();
  const reasons: string[] = [];
  let score = 0;

  // 1. High postponement rate
  if (insights.postponementRate > 0.5) {
    score += 30;
    reasons.push(`Высокий процент откладывания (${(insights.postponementRate * 100).toFixed(0)}%)`);
  } else if (insights.postponementRate > 0.3) {
    score += 15;
    reasons.push(`Повышенный процент откладывания (${(insights.postponementRate * 100).toFixed(0)}%)`);
  }

  // 2. Declining streak
  if (insights.currentStreak === 0 && insights.longestStreak > 3) {
    score += 25;
    reasons.push('Стрик прерван — ты был на серии, но сегодня пропустил');
  }

  // 3. Low completions per day recently (last 3 days vs average)
  const last3Days = new Set<string>();
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    last3Days.add(d.toISOString().split('T')[0]);
  }
  const recentCompletions = patterns.taskEvents.filter(
    e => e.action === 'completed' && last3Days.has(e.date)
  ).length / 3;

  if (insights.avgCompletionsPerDay > 1 && recentCompletions < insights.avgCompletionsPerDay * 0.4) {
    score += 25;
    reasons.push(`Резкое падение продуктивности: ${recentCompletions.toFixed(1)} вместо ${insights.avgCompletionsPerDay.toFixed(1)} задач/день`);
  } else if (insights.avgCompletionsPerDay > 1 && recentCompletions < insights.avgCompletionsPerDay * 0.6) {
    score += 12;
    reasons.push('Продуктивность ниже среднего за последние 3 дня');
  }

  // 4. Danger zone proximity
  if (insights.dangerZonePercent !== null) {
    score += 15;
    reasons.push(`Исторически замедление на ~${insights.dangerZonePercent}% прогресса`);
  }

  // 5. Mood declining
  const moods = patterns.moodEntries.slice(-5);
  if (moods.length >= 3) {
    const recentMoods = moods.slice(-3).map(m => m.mood);
    const avgRecent = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
    if (avgRecent <= 2) {
      score += 20;
      reasons.push('Настроение последних записей низкое — возможен спад');
    } else if (avgRecent <= 3 && moods.length >= 4) {
      const olderMoods = moods.slice(0, -3).map(m => m.mood);
      const avgOlder = olderMoods.reduce((a, b) => a + b, 0) / olderMoods.length;
      if (avgRecent < avgOlder - 0.5) {
        score += 10;
        reasons.push('Настроение ухудшается по сравнению с ранними записями');
      }
    }
  }

  // 6. No activity in 2+ days
  const lastEvent = patterns.taskEvents[patterns.taskEvents.length - 1];
  if (lastEvent) {
    const daysSinceLast = Math.floor((Date.now() - lastEvent.ts) / 86400000);
    if (daysSinceLast >= 3) {
      score += 30;
      reasons.push(`${daysSinceLast} дней без активности`);
    } else if (daysSinceLast >= 2) {
      score += 15;
      reasons.push('2 дня без активности');
    }
  }

  // Clamp
  score = Math.min(100, score);

  // Estimate days until dropoff
  let daysUntilDropoff: number | null = null;
  if (score >= 50) daysUntilDropoff = Math.max(1, Math.round((100 - score) / 15));
  else if (score >= 30) daysUntilDropoff = Math.round((100 - score) / 10);

  // Level
  let level: RiskSignals['level'] = 'none';
  if (score >= 70) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 30) level = 'medium';
  else if (score >= 15) level = 'low';

  return { level, score, reasons, daysUntilDropoff };
}

// ── Should show preventive coach (max once per 12 hours, not if dismissed) ──
export function shouldShowPreventiveCoach(): boolean {
  try {
    const dismissed = localStorage.getItem(RISK_DISMISS_KEY);
    if (dismissed) {
      const dismissTs = Number(dismissed);
      if (Date.now() - dismissTs < 24 * 60 * 60 * 1000) return false; // 24h cooldown after dismiss
    }

    const lastCheck = localStorage.getItem(RISK_CHECK_KEY);
    if (lastCheck && Date.now() - Number(lastCheck) < 12 * 60 * 60 * 1000) return false;

    const risk = detectRiskSignals();
    return risk.level === 'high' || risk.level === 'critical';
  } catch {
    return false;
  }
}

// ── Risk level config ───────────────────────────────────────────────────────
const RISK_LEVELS = {
  none:     { color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'Всё отлично' },
  low:      { color: '#22c55e', bg: 'bg-green-500/10',   border: 'border-green-500/25',   label: 'Небольшой риск' },
  medium:   { color: '#f59e0b', bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   label: 'Умеренный риск' },
  high:     { color: '#f97316', bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  label: 'Высокий риск' },
  critical: { color: '#ef4444', bg: 'bg-red-500/10',     border: 'border-red-500/25',     label: 'Критический риск' },
};

// ── Preventive coach modal ──────────────────────────────────────────────────
interface PreventiveCoachProps {
  plan: Plan;
  onClose: () => void;
  onSimplifyTasks?: (taskUpdates: { taskId: string; newTitle?: string; newPriority?: string; remove?: boolean }[]) => void;
}

export function TomiPreventiveCoach({ plan, onClose, onSimplifyTasks }: PreventiveCoachProps) {
  const risk = detectRiskSignals();
  const riskConf = RISK_LEVELS[risk.level];
  const [step, setStep] = useState<'intro' | 'analyzing' | 'suggestions' | 'applied'>('intro');
  const [suggestions, setSuggestions] = useState<{
    greeting: string;
    simplifications: { taskId: string; taskTitle: string; action: string; reason: string; newTitle?: string; newPriority?: string }[];
    encouragement: string;
    alternativePlan: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    setStep('analyzing');
    setError('');
    try {
      const patternSummary = getPatternSummaryForAI();
      const pendingTasks = plan.phases.flatMap(p =>
        p.tasks.filter(t => t.status !== 'done').map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          difficulty: t.difficulty,
          status: t.status,
          phase: p.name,
          durationHours: t.duration_hours,
        }))
      );

      const data = await aiTomiPreventive({
        patternSummary,
        riskSignals: risk,
        pendingTasks,
        planGoal: plan.goal,
      });

      setSuggestions(data);
      setStep('suggestions');
    } catch (err: any) {
      console.error('Preventive coach error:', err);
      setError(err.message || 'Не удалось получить рекомендации');
      setStep('intro');
    }
  }, [plan, risk]);

  const handleApply = (taskId: string, action: string, newTitle?: string, newPriority?: string) => {
    if (onSimplifyTasks) {
      const update: any = { taskId };
      if (action === 'simplify' && newTitle) update.newTitle = newTitle;
      if (action === 'deprioritize' && newPriority) update.newPriority = newPriority;
      if (action === 'remove') update.remove = true;
      onSimplifyTasks([update]);
    }
    setAppliedIds(prev => new Set(prev).add(taskId));
    playComplete();
    toast.success('Рекомендация применена');
  };

  const handleDismiss = () => {
    try { localStorage.setItem(RISK_DISMISS_KEY, String(Date.now())); } catch {}
    try { localStorage.setItem(RISK_CHECK_KEY, String(Date.now())); } catch {}
    onClose();
  };

  if (risk.level === 'none' || risk.level === 'low') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDismiss} />

      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{
          background: 'rgba(10,15,30,0.97)',
          border: `1px solid ${riskConf.color}33`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 40px ${riskConf.color}15`,
        }}
      >
        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5">
          {/* ── Intro step ── */}
          {step === 'intro' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Tomi avatar + warning */}
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <TomiAvatar size={52} mood="concerned" />
                </motion.div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5" style={{ color: riskConf.color }} />
                    Превентивная защита
                  </h2>
                  <p className="text-xs text-white/40">Томи заметил тревожные сигналы</p>
                </div>
              </div>

              {/* Risk meter */}
              <div className={`rounded-xl ${riskConf.bg} ${riskConf.border} border p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: riskConf.color }}>
                    {riskConf.label}
                  </span>
                  <span className="text-xs text-white/40">{risk.score}/100</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: riskConf.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${risk.score}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
                {risk.daysUntilDropoff !== null && (
                  <p className="text-[10px] text-white/30 mt-1.5">
                    Прогноз: возможный спад через ~{risk.daysUntilDropoff} дн.
                  </p>
                )}
              </div>

              {/* Reasons */}
              <div className="space-y-1.5">
                {risk.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: riskConf.color }} />
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={fetchSuggestions}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${riskConf.color}, ${riskConf.color}cc)`,
                    boxShadow: `0 4px 16px ${riskConf.color}40`,
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Предложи упрощения
                </motion.button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-3 rounded-xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all"
                >
                  Потом
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Analyzing step ── */}
          {step === 'analyzing' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center space-y-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 mx-auto rounded-2xl bg-[#1d4ed8]/15 flex items-center justify-center"
              >
                <Brain className="w-8 h-8 text-[#1d4ed8]" />
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-white">Томи анализирует план...</p>
                <p className="text-xs text-white/40 mt-1">Ищу задачи, которые можно упростить</p>
              </div>
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 text-[#1d4ed8] animate-spin" />
              </div>
            </motion.div>
          )}

          {/* ── Suggestions step ── */}
          {step === 'suggestions' && suggestions && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Greeting */}
              <div className="flex items-start gap-3">
                <TomiAvatar size={40} mood="caring" />
                <div className="flex-1 rounded-xl bg-[#1d4ed8]/8 border border-[#1d4ed8]/20 p-3">
                  <p className="text-sm text-white/80 leading-relaxed">{suggestions.greeting}</p>
                </div>
              </div>

              {/* Simplification cards */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Рекомендации
                </h3>
                {suggestions.simplifications.map((s, i) => {
                  const applied = appliedIds.has(s.taskId);
                  return (
                    <motion.div
                      key={s.taskId || i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`rounded-xl border p-3.5 transition-all ${
                        applied
                          ? 'border-emerald-500/25 bg-emerald-500/5'
                          : 'border-white/8 bg-white/3'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          s.action === 'simplify' ? 'bg-blue-500/15' :
                          s.action === 'deprioritize' ? 'bg-amber-500/15' :
                          s.action === 'postpone' ? 'bg-orange-500/15' : 'bg-red-500/15'
                        }`}>
                          {s.action === 'simplify' ? <Zap className="w-4 h-4 text-blue-400" /> :
                           s.action === 'deprioritize' ? <TrendingDown className="w-4 h-4 text-amber-400" /> :
                           s.action === 'postpone' ? <Clock className="w-4 h-4 text-orange-400" /> :
                           <X className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/80 truncate">{s.taskTitle}</p>
                          <p className="text-[11px] text-white/40 mt-0.5">{s.reason}</p>
                          {s.newTitle && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <ArrowRight className="w-3 h-3 text-[#1d4ed8]" />
                              <span className="text-xs text-[#1d4ed8]">{s.newTitle}</span>
                            </div>
                          )}
                        </div>
                        {!applied ? (
                          <button
                            onClick={() => {
                              playClick();
                              handleApply(s.taskId, s.action, s.newTitle, s.newPriority);
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1d4ed8]/15 text-[#1d4ed8] text-xs font-semibold hover:bg-[#1d4ed8]/25 transition-all active:scale-95"
                          >
                            Применить
                          </button>
                        ) : (
                          <div className="shrink-0 w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-400" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Alternative plan */}
              {suggestions.alternativePlan && (
                <div className="rounded-xl border border-[#1d4ed8]/20 bg-[#1d4ed8]/5 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Target className="w-3.5 h-3.5 text-[#1d4ed8]" />
                    <span className="text-xs font-semibold text-[#1d4ed8]">Альтернативный подход</span>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">{suggestions.alternativePlan}</p>
                </div>
              )}

              {/* Encouragement */}
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 flex items-start gap-3">
                <Heart className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-white/55 leading-relaxed">{suggestions.encouragement}</p>
              </div>

              {/* Close */}
              <button
                onClick={handleDismiss}
                className="w-full py-3 rounded-xl bg-white/5 text-sm text-white/60 hover:bg-white/8 transition-all font-medium"
              >
                Понятно, спасибо!
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Compact risk indicator for plan page ────────────────────────────────────
export function RiskIndicator({ onClick }: { onClick: () => void }) {
  const risk = detectRiskSignals();

  if (risk.level === 'none' || risk.level === 'low') return null;

  const conf = RISK_LEVELS[risk.level];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => { playClick(); onClick(); }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${conf.border} ${conf.bg} transition-all hover:scale-105`}
    >
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Shield className="w-3.5 h-3.5" style={{ color: conf.color }} />
      </motion.div>
      <span className="text-xs font-semibold" style={{ color: conf.color }}>
        {conf.label}
      </span>
    </motion.button>
  );
}
