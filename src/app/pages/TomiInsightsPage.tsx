import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, TrendingUp, BarChart3, Lightbulb, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Brain, Star } from 'lucide-react';
import { Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Navbar } from '../components/Navbar';
import { TomiKnowsYou } from '../components/TomiKnowsYou';
import { AuroraBackground } from '../components/AuroraBackground';
import { EnergyCurveWidget } from '../components/EnergyCurveWidget';
import { LifeInNumbers } from '../components/LifeInNumbers';
import { TomiAvatar } from '../components/TomiAssistant';
import { useAuth } from '../lib/auth';
import { getCloudPlanFeedbacks } from '../lib/api';
import { computeLocalInsights } from '../lib/patternTracker';
import { getPlans } from '../lib/storage';

// Dark mode detector (reused pattern)
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

// ── Pattern Recommendations ────────────────────────────────────────────────────
interface FeedbackEntry {
  planId: string;
  vote: 'up' | 'down';
  comment?: string;
  planGoal?: string;
  ts: number;
}

interface Recommendation {
  id: string;
  icon: string;
  title: string;
  body: string;
  type: 'improve' | 'strength' | 'warning';
}

function computeRecommendations(
  feedbacks: FeedbackEntry[],
  localFeedbacks: FeedbackEntry[],
): Recommendation[] {
  const all = [...feedbacks, ...localFeedbacks];
  const recs: Recommendation[] = [];

  if (all.length === 0) {
    recs.push({
      id: 'no_data',
      icon: '🤔',
      title: 'Ещё нет данных',
      body: 'Оцени несколько планов через кнопки 👍/👎, и Томи составит персональные рекомендации.',
      type: 'improve',
    });
    return recs;
  }

  const total = all.length;
  const upVotes = all.filter(f => f.vote === 'up').length;
  const downVotes = all.filter(f => f.vote === 'down').length;
  const approvalRate = Math.round((upVotes / total) * 100);

  // Comments analysis
  const downComments = all.filter(f => f.vote === 'down' && f.comment).map(f => f.comment!.toLowerCase());
  const tooManyTasks = downComments.filter(c => c.includes('много') || c.includes('перегруж')).length;
  const unrealisticDeadlines = downComments.filter(c => c.includes('срок') || c.includes('нереал')).length;
  const wrongApproach = downComments.filter(c => c.includes('подход') || c.includes('тему')).length;

  // Local insights for context
  const insights = computeLocalInsights();
  const plans = (() => { try { return getPlans(); } catch { return []; } })();
  const donePlans = plans.filter(p => {
    const all = p.phases.flatMap(ph => ph.tasks);
    return all.length > 0 && all.every(t => t.status === 'done');
  }).length;

  // Generate recommendations based on data
  if (approvalRate >= 75) {
    recs.push({
      id: 'high_approval',
      icon: '🏆',
      title: 'Планы попадают в точку',
      body: `${approvalRate}% твоих планов оценены положительно. Томи хорошо понимает твой стиль работы.`,
      type: 'strength',
    });
  }

  if (tooManyTasks >= 2) {
    recs.push({
      id: 'too_many_tasks',
      icon: '⚡',
      title: 'Упрости список задач',
      body: 'В нескольких планах ты отмечал перегруженность. Попробуй ограничивать планы до 3–5 ключевых задач на неделю.',
      type: 'improve',
    });
  }

  if (unrealisticDeadlines >= 2) {
    recs.push({
      id: 'unrealistic_deadlines',
      icon: '📅',
      title: 'Добавляй буфер к срокам',
      body: 'Ты часто отмечаешь сроки как нереалистичные. Томи рекомендует умножать оценки времени на 1.5.',
      type: 'warning',
    });
  }

  if (wrongApproach >= 1) {
    recs.push({
      id: 'wrong_approach',
      icon: '🎯',
      title: 'Точнее описывай цели',
      body: 'Чем детальнее ты опишешь цель — включая контекст и ограничения — тем лучше Томи подберёт подход.',
      type: 'improve',
    });
  }

  if (downVotes >= 3 && approvalRate < 50) {
    recs.push({
      id: 'low_approval',
      icon: '🔄',
      title: 'Скорректируй формат постановки целей',
      body: 'Попробуй добавлять в запрос: «Часы в неделю», «Приоритеты» и конкретный желаемый результат.',
      type: 'warning',
    });
  }

  if (insights.currentStreak >= 7 && approvalRate >= 60) {
    recs.push({
      id: 'streak_master',
      icon: '🔥',
      title: 'Ты в ударе — пора брать сложнее',
      body: `${insights.currentStreak} дней подряд + высокий рейтинг планов. Томи рекомендует попробовать более амбициозную цель.`,
      type: 'strength',
    });
  }

  if (donePlans >= 5) {
    recs.push({
      id: 'serial_achiever',
      icon: '✅',
      title: 'Ты систематически завершаешь планы',
      body: `${donePlans} завершённых планов — это показатель системности. Твой рабочий ритм складывается.`,
      type: 'strength',
    });
  }

  if (insights.avgCompletionsPerDay < 0.5 && total >= 3) {
    recs.push({
      id: 'low_daily_output',
      icon: '📈',
      title: 'Фокус на одном плане за раз',
      body: 'Небольшое кол-во завершённых задач в день говорит о разброс внимания. Попробуй вести только 1 активный план.',
      type: 'improve',
    });
  }

  return recs.slice(0, 5); // Не больше 5 рекомендаций
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const colors = {
    improve: {
      bg: 'rgba(29,78,216,0.08)',
      border: 'rgba(29,78,216,0.2)',
      badge: 'text-[#93bbfd] bg-[#1d4ed8]/15',
      label: 'К улучшению',
    },
    strength: {
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.2)',
      badge: 'text-emerald-300 bg-emerald-500/15',
      label: 'Сильная сторона',
    },
    warning: {
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.2)',
      badge: 'text-amber-300 bg-amber-500/15',
      label: 'Обратить внимание',
    },
  };
  const c = colors[rec.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl p-4"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
          </div>
          <p className="text-white text-sm font-semibold mb-1 leading-tight">{rec.title}</p>
          <p className="text-white/50 text-xs leading-relaxed">{rec.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Feedback Stats Widget ──────────────────────────────────────────────────────
function ScoreCircle({ pct, size = 88 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - filled }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </svg>
  );
}

function FeedbackStatsWidget() {
  const { token } = useAuth();
  const [cloudFeedbacks, setCloudFeedbacks] = useState<FeedbackEntry[]>([]);
  const [expanded, setExpanded] = useState(true);

  const localFeedbacks = useMemo<FeedbackEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('stride_plan_feedback') || '[]'); }
    catch { return []; }
  }, []);

  useEffect(() => {
    if (!token) return;
    getCloudPlanFeedbacks(token).then(d => setCloudFeedbacks(d as FeedbackEntry[])).catch(console.warn);
  }, [token]);

  // Merge: cloud takes priority (dedup by planId)
  const all = useMemo<FeedbackEntry[]>(() => {
    const map = new Map<string, FeedbackEntry>();
    localFeedbacks.forEach(f => map.set(f.planId, f));
    cloudFeedbacks.forEach(f => map.set(f.planId, f));
    return Array.from(map.values()).sort((a, b) => b.ts - a.ts);
  }, [cloudFeedbacks, localFeedbacks]);

  const total    = all.length;
  const upCount  = all.filter(f => f.vote === 'up').length;
  const downCount = total - upCount;
  const pct      = total > 0 ? Math.round((upCount / total) * 100) : 0;
  const scoreColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

  // BarChart data — last 8 votes
  const barData = all.slice(0, 8).reverse().map((f, i) => ({
    label: f.planGoal
      ? (f.planGoal.length > 16 ? f.planGoal.slice(0, 16) + '…' : f.planGoal)
      : `#${i + 1}`,
    vote: f.vote === 'up' ? 1 : -1,
    fill: f.vote === 'up' ? '#10b981' : '#ef4444',
  }));

  if (total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(13,26,54,0.7)',
        border: '1px solid rgba(29,78,216,0.2)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1d4ed8]/15 border border-[#1d4ed8]/25 flex items-center justify-center">
            <Star className="w-4 h-4 text-[#93bbfd]" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Статистика оценок планов</p>
            <p className="text-white/35 text-[11px] mt-0.5">{total} {total === 1 ? 'план оценён' : total < 5 ? 'плана оценено' : 'планов оценено'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-[11px] font-semibold">{upCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsDown className="w-3 h-3 text-red-400" />
              <span className="text-red-400 text-[11px] font-semibold">{downCount}</span>
            </div>
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-white/30" />
            : <ChevronDown className="w-4 h-4 text-white/30" />
          }
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5">
              {/* Score row */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <ScoreCircle pct={pct} size={88} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-white font-bold text-lg leading-none" style={{ color: scoreColor }}>{pct}%</span>
                    <span className="text-white/30 text-[10px] mt-0.5">одобрено</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {[
                    { label: 'Понравилось',    value: upCount,   color: '#10b981', pct: total > 0 ? (upCount / total) * 100 : 0 },
                    { label: 'Не понравилось', value: downCount, color: '#ef4444', pct: total > 0 ? (downCount / total) * 100 : 0 },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/50 text-[11px]">{item.label}</span>
                        <span className="font-semibold text-[11px]" style={{ color: item.color }}>{item.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/7 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: item.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.pct}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart (last 8 votes) */}
              {barData.length >= 2 && (
                <div>
                  <p className="text-white/30 text-[10px] font-medium uppercase tracking-wider mb-3">
                    Последние {barData.length} оценок
                  </p>
                  <div style={{ height: 90 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={14}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 9 }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis hide domain={[-1.4, 1.4]} />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                          contentStyle={{
                            background: '#0d1a36', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, fontSize: 11, color: 'white',
                          }}
                          formatter={(val: number) => [val === 1 ? '👍 Понравилось' : '👎 Не то', '']}
                        />
                        <Bar dataKey="vote" radius={[4, 4, 0, 0]}>
                          {barData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Recent list */}
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] font-medium uppercase tracking-wider">Последние оценки</p>
                {all.slice(0, 5).map((f, i) => (
                  <motion.div
                    key={f.planId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-2.5 py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-base leading-none mt-0.5 shrink-0">
                      {f.vote === 'up' ? '👍' : '👎'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-xs truncate">
                        {f.planGoal ?? `План ${f.planId.slice(0, 6)}`}
                      </p>
                      {f.comment && (
                        <p className="text-white/30 text-[10px] mt-0.5 italic truncate">«{f.comment}»</p>
                      )}
                    </div>
                    <span className="text-white/20 text-[10px] shrink-0 mt-0.5">
                      {new Date(f.ts).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PatternRecommendations() {
  const { token } = useAuth();
  const [cloudFeedbacks, setCloudFeedbacks] = useState<FeedbackEntry[]>([]);
  const [expanded, setExpanded] = useState(true);

  // Load local feedbacks
  const localFeedbacks = useMemo<FeedbackEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('stride_plan_feedback') || '[]');
    } catch { return []; }
  }, []);

  // Load cloud feedbacks
  useEffect(() => {
    if (!token) return;
    getCloudPlanFeedbacks(token).then(data => {
      setCloudFeedbacks(data as FeedbackEntry[]);
    }).catch(console.warn);
  }, [token]);

  const recs = useMemo(
    () => computeRecommendations(cloudFeedbacks, localFeedbacks),
    [cloudFeedbacks, localFeedbacks],
  );

  const total = [...cloudFeedbacks, ...localFeedbacks].length;
  const upCount = [...cloudFeedbacks, ...localFeedbacks].filter(f => f.vote === 'up').length;
  const downCount = total - upCount;

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(13,26,54,0.7)',
        border: '1px solid rgba(29,78,216,0.2)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1d4ed8]/15 border border-[#1d4ed8]/25 flex items-center justify-center">
            <Brain className="w-4 h-4 text-[#93bbfd]" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Рекомендации Томи</p>
            {total > 0 && (
              <p className="text-white/35 text-[11px] mt-0.5">
                На основе {total} {total === 1 ? 'оценки' : total < 5 ? 'оценок' : 'оценок'} планов
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 text-[11px] font-medium">{upCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="w-3 h-3 text-red-400" />
                <span className="text-red-400 text-[11px] font-medium">{downCount}</span>
              </div>
            </div>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-white/30" />
            : <ChevronDown className="w-4 h-4 text-white/30" />
          }
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2.5">
              {/* Tomi intro */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl mb-1"
                style={{ background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.15)' }}>
                <TomiAvatar size={28} mood="happy" />
                <p className="text-white/60 text-xs leading-relaxed">
                  {total === 0
                    ? 'Оцени планы в 👍/👎 — я составлю персональные советы на основе твоих паттернов.'
                    : `Анализирую ${total} оценок твоих планов. Вот что я вижу:`
                  }
                </p>
              </div>

              {recs.map((rec, i) => (
                <RecommendationCard key={rec.id} rec={rec} index={i} />
              ))}

              {total > 0 && (
                <p className="text-white/20 text-[10px] text-center pt-1">
                  Рекомендации обновляются по мере накопления оценок
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function TomiInsightsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <AuroraBackground />
      <div className="relative z-10">
        <Navbar
          showNav
          leftContent={
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors active:scale-95 touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>
          }
        />

        <div className="max-w-xl mx-auto px-4 pb-28 pt-4 space-y-6">
          {/* Томи знает тебя */}
          <TomiKnowsYou />

          {/* Статистика оценок планов */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-[#93bbfd]" />
              <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Оценки планов</h2>
            </div>
            <FeedbackStatsWidget />
          </div>

          {/* Рекомендации по паттернам */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Рекомендации</h2>
            </div>
            <PatternRecommendations />
          </div>

          {/* Жизнь в цифрах */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Жизнь в цифрах</h2>
            </div>
            <LifeInNumbers />
          </div>

          {/* Энергетическая кривая */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Энергетическая кривая</h2>
            </div>
            <EnergyCurveWidget />
          </div>
        </div>
      </div>
    </div>
  );
}