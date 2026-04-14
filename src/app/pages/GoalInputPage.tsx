import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ChevronLeft, Calendar, Clock, Target,
  LayoutTemplate, AlertCircle, Zap, Sparkles, CheckCircle2,
  ListChecks, BarChart3, GitBranch, Timer, Brain,
} from 'lucide-react';
import { generatePlanAI } from '../lib/aiPlan';
import { savePlan, getMonthlyUsage, incrementUsage } from '../lib/storage';
import { saveCloudPlan, incrementCloudUsage } from '../lib/api';
import { format, addMonths } from 'date-fns';
import { TemplatesModal, Template } from '../components/TemplatesModal';
import { PaywallModal } from '../components/PaywallModal';
import { useAuth } from '../lib/auth';
import { getPlanLimit, TIERS } from '../lib/plans';
import { AuroraBackground } from '../components/AuroraBackground';
import { TomiAvatar } from '../components/TomiAssistant';
import { DeadlineValidator } from '../components/DeadlineValidator';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

// ── Animated placeholder ──────────────────────────────────────────────────────
const ROTATING_PLACEHOLDERS = [
  'Запустить SaaS-продукт за 3 месяца',
  'Выучить Python с нуля до Junior-разработчика',
  'Похудеть на 10 кг и выработать привычку к спорту',
  'Написать и опубликовать книгу за полгода',
  'Найти работу Flutter-разработчика за 2 месяца',
  'Запустить YouTube-канал и набрать 1000 подписчиков',
  'Изучить английский язык до уровня B2 за 6 месяцев',
];

function useAnimatedPlaceholder(active: boolean) {
  const [text,  setText]  = useState('');
  const [idx,   setIdx]   = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!active) { setText(''); return; }
    const full = ROTATING_PLACEHOLDERS[idx];
    if (phase === 'typing') {
      if (text.length < full.length) {
        timerRef.current = setTimeout(() => setText(full.slice(0, text.length + 1)), 38);
      } else {
        timerRef.current = setTimeout(() => setPhase('pause'), 2000);
      }
    } else if (phase === 'pause') {
      timerRef.current = setTimeout(() => setPhase('erasing'), 500);
    } else {
      if (text.length > 0) {
        timerRef.current = setTimeout(() => setText(t => t.slice(0, -1)), 18);
      } else {
        setIdx(i => (i + 1) % ROTATING_PLACEHOLDERS.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [active, text, phase, idx]);

  return text;
}

const GENERATING_STEPS = [
  'Анализируем вашу цель...',
  'Разбиваем на этапы...',
  'Формируем задачи...',
  'Расставляем приоритеты...',
  'Рассчитываем сроки...',
  'Финализируем план ✓',
];

const TOMI_GENERATING_LINES = [
  'Читаю твою цель…',
  'Придумываю этапы…',
  'Собираю задачи…',
  'Расставляю приоритеты…',
  'Считаю дедлайны…',
  'Готово! Открываю план ✨',
];

function genMood(step: number): 'focused' | 'cool' | 'excited' {
  if (step >= 5) return 'excited';
  if (step >= 3) return 'cool';
  return 'focused';
}

// ── Desktop right-panel mock plan ─────────────────────────────────────────────
const MOCK_PHASES = [
  { label: 'Исследование',  color: '#1d4ed8', tasks: ['Анализ рынка', 'Изучение конкурентов', 'Портрет ЦА'], pct: 100 },
  { label: 'Разработка',    color: '#2563eb', tasks: ['MVP функционал', 'Дизайн-система', 'Тесты'], pct: 60 },
  { label: 'Маркетинг',     color: '#1d4ed8', tasks: ['Лендинг', 'Email-рассылка', 'SEO'], pct: 30 },
  { label: 'Запуск',        color: '#10b981', tasks: ['Бета-тест', 'Пресс-кит', 'Запуск!'], pct: 0 },
];

const FEATURES = [
  { icon: ListChecks, label: 'Задачи и подзадачи', desc: 'Пошаговый чеклист к каждому этапу' },
  { icon: BarChart3,  label: 'Приоритеты',         desc: 'Важное — вперёд, второстепенное — потом' },
  { icon: Timer,      label: 'Временные оценки',   desc: 'Реалистичные сроки и дедлайны' },
  { icon: GitBranch,  label: 'Зависимости',        desc: 'Что делать сначала — AI решит за вас' },
];

type Step = 'details' | 'clarifying' | 'generating';

export function GoalInputPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, tier } = useAuth();

  const [step,           setStep]          = useState<Step>('details');
  const [goal,           setGoal]          = useState((location.state as { goal?: string })?.goal ?? '');
  const [deadline,       setDeadline]      = useState(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [hoursPerWeek,   setHoursPerWeek]  = useState(10);
  const [generatingStep, setGeneratingStep]= useState(0);
  const [error,          setError]         = useState('');
  const [showTemplates,  setShowTemplates] = useState(false);
  const [showPaywall,    setShowPaywall]   = useState(false);

  // Clarification state
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [clarifyAnswers,   setClarifyAnswers]  = useState<string[]>([]);
  const [clarifyComment,   setClarifyComment]  = useState('');
  const [clarifyLoading,   setClarifyLoading]  = useState(false);
  const clarifyCache = useRef<Map<string, { questions: string[]; comment: string }>>(new Map());

  const usage          = getMonthlyUsage();
  const planLimit      = getPlanLimit(tier);
  const isLimitReached = usage >= planLimit;
  const animPlaceholder = useAnimatedPlaceholder(step === 'details' && goal === '');
  const charCount      = goal.length;
  const charMax        = 600;
  const charGood       = charCount >= 20;

  const applyTemplate = (tmpl: Template) => {
    setGoal(tmpl.goal); setDeadline(tmpl.deadline); setHoursPerWeek(tmpl.hoursPerWeek);
  };

  // Build enriched goal from clarification answers
  const buildEnrichedGoal = () => {
    if (clarifyQuestions.length === 0) return goal;
    let enriched = goal;
    const qaPairs = clarifyQuestions
      .map((q, i) => clarifyAnswers[i]?.trim() ? `\n- ${q}: ${clarifyAnswers[i].trim()}` : '')
      .filter(Boolean)
      .join('');
    if (qaPairs) enriched += '\n\nДополнительные детали:' + qaPairs;
    return enriched;
  };

  // Check if goal needs clarification before generating
  const handleCreatePlan = async () => {
    if (!goal.trim()) { setError('Опишите вашу цель'); return; }
    if (isLimitReached) { setShowPaywall(true); return; }
    setError('');

    const trimmedGoal = goal.trim();

    // Skip clarification for detailed goals (>50 chars)
    if (trimmedGoal.length > 50) {
      startGenerating(trimmedGoal);
      return;
    }

    // Check cache first
    const cached = clarifyCache.current.get(trimmedGoal);
    if (cached) {
      setClarifyQuestions(cached.questions);
      setClarifyAnswers(new Array(cached.questions.length).fill(''));
      setClarifyComment(cached.comment);
      setStep('clarifying');
      return;
    }

    setClarifyLoading(true);

    try {
      const res = await fetch(`${SERVER_URL}/ai/clarify-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ goal: trimmedGoal }),
      });
      const data = await res.json();

      if (data.needsClarification && data.questions?.length > 0) {
        // Save to cache
        clarifyCache.current.set(trimmedGoal, { questions: data.questions, comment: data.tomiComment || '' });
        setClarifyQuestions(data.questions);
        setClarifyAnswers(new Array(data.questions.length).fill(''));
        setClarifyComment(data.tomiComment || '');
        setClarifyLoading(false);
        setStep('clarifying');
        return;
      }
    } catch (err) {
      console.warn('[GoalInput] Clarify check failed, proceeding:', err);
    }

    setClarifyLoading(false);
    startGenerating(trimmedGoal);
  };

  // Proceed to generate (with or without enriched goal)
  const startGenerating = async (finalGoal: string) => {
    setStep('generating'); setGeneratingStep(0);

    (async () => {
      for (let i = 0; i < GENERATING_STEPS.length; i++) {
        await new Promise(r => setTimeout(r, 480));
        setGeneratingStep(i + 1);
      }
    })();

    try {
      const plan = await generatePlanAI(finalGoal, deadline, hoursPerWeek);
      savePlan(plan); incrementUsage();
      if (token) {
        Promise.all([saveCloudPlan(plan, token), incrementCloudUsage(token)])
          .catch(e => console.warn('Cloud save failed:', e));
      }
      navigate(`/plan/${plan.id}`);
    } catch (err) {
      console.error('[GoalInput] Generation failed:', err);
      setStep('details');
      setError('Не удалось создать план. Попробуйте ещё раз.');
    }
  };

  const handleGenerate = async () => {
    handleCreatePlan();
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen text-slate-900 dark:text-white flex flex-col">

      {/* ── Background ── */}
      <div className="fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f0f4ff 40%, #e8f5ff 100%)' }}>
        <div className="hidden dark:block absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #060d1e 0%, #070f1e 100%)' }} />
        <AuroraBackground variant="form" />
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 border-b navbar-safe"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: 'rgba(29,78,216,0.08)',
          boxShadow: '0 1px 0 rgba(29,78,216,0.06)',
        }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }} className="text-slate-900 dark:text-white text-sm">
              Vecto
            </span>
          </button>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-colors text-sm">
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col lg:flex-row">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════
              DETAILS STEP
          ════════════════════════════════════════════════════════════ */}
          {step === 'details' && (
            <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}
              className="flex-1 flex flex-col lg:flex-row">

              {/* ── LEFT: Form ─────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-8 lg:px-16 xl:px-24
                              py-8 lg:py-12 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] lg:pb-12">
                <div className="w-full max-w-xl mx-auto lg:mx-0 flex items-start lg:items-center min-h-full">
                  <div className="w-full">

                    {/* Badge */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1d4ed8]/8 border border-[#1d4ed8]/18 text-[#1d4ed8] text-xs font-semibold mb-5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Vecto AI Планировщик
                      </div>
                    </motion.div>

                    {/* Heading */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, lineHeight: 1.12 }}
                        className="text-[clamp(1.9rem,3.5vw,2.8rem)] text-slate-900 dark:text-white mb-3">
                        Опишите вашу цель
                      </h1>
                      <p className="text-slate-500 dark:text-white/50 text-[15px] leading-relaxed mb-7">
                        Vecto превратит её в чёткий пошаговый план — этапы, задачи, приоритеты и дедлайны.
                      </p>
                    </motion.div>

                    {isLimitReached && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mb-6 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Лимит исчерпан ({planLimit} планов за {TIERS[tier].cycleName}). Напишите администратору для смены тарифа.
                      </motion.div>
                    )}

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                      className="space-y-5">

                      {/* ── Goal textarea ── */}
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-[#1d4ed8]" />
                            <label className="text-sm font-semibold text-slate-700 dark:text-white/80">Ваша цель</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <AnimatePresence>
                              {charGood && (
                                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                  className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />Хорошо!
                                </motion.span>
                              )}
                            </AnimatePresence>
                            <button onClick={() => setShowTemplates(true)}
                              className="flex items-center gap-1.5 text-xs text-[#1d4ed8] hover:text-[#1e40af] border border-[#1d4ed8]/25 hover:border-[#1d4ed8]/50 px-2.5 py-1.5 rounded-lg bg-[#1d4ed8]/5 hover:bg-[#1d4ed8]/10 font-semibold transition-all">
                              <LayoutTemplate className="w-3 h-3" />Шаблоны
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <textarea
                            value={goal}
                            onChange={e => { setGoal(e.target.value.slice(0, charMax)); setError(''); }}
                            placeholder={animPlaceholder || 'Например: Запустить SaaS-продукт за 3 месяца...'}
                            rows={5}
                            className="w-full rounded-2xl px-4 py-4 text-slate-900 dark:text-white placeholder-slate-400/70 resize-none focus:outline-none transition-all text-sm leading-relaxed"
                            style={{
                              background: 'rgba(255,255,255,0.82)',
                              backdropFilter: 'blur(16px)',
                              border: goal ? '1.5px solid rgba(29,78,216,0.32)' : '1.5px solid rgba(255,255,255,0.95)',
                              boxShadow: goal
                                ? '0 0 0 4px rgba(29,78,216,0.07), 0 4px 20px rgba(29,78,216,0.08)'
                                : '0 4px 20px rgba(29,78,216,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                            }}
                          />
                          <div className={`absolute bottom-3 right-3 text-[11px] font-medium transition-colors ${
                            charCount > charMax * 0.9 ? 'text-amber-500' : 'text-slate-400 dark:text-white/25'
                          }`}>{charCount}/{charMax}</div>
                        </div>

                        {error && (
                          <div className="flex items-center gap-1.5 mt-2 text-red-500 dark:text-red-400 text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />{error}
                          </div>
                        )}

                        {/* Quick chips */}
                        {!goal && (
                          <div className="flex overflow-x-auto gap-2 mt-3 pb-1 scrollbar-none">
                            {ROTATING_PLACEHOLDERS.slice(0, 5).map(ex => (
                              <button key={ex} onClick={() => setGoal(ex)}
                                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-500 dark:text-white/50 hover:text-[#1d4ed8] hover:border-[#1d4ed8]/35 hover:bg-[#1d4ed8]/5 transition-colors whitespace-nowrap shrink-0 shadow-sm">
                                {ex.length > 36 ? ex.slice(0, 36) + '…' : ex}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ── Deadline + Hours ── */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2.5">
                            <Calendar className="w-4 h-4 text-[#2563eb]" />
                            <label className="text-sm font-semibold text-slate-700 dark:text-white/80">Дедлайн</label>
                          </div>
                          <input type="date" value={deadline}
                            onChange={e => setDeadline(e.target.value)}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            className="w-full rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none transition-all text-sm"
                            style={{
                              background: 'rgba(255,255,255,0.82)',
                              backdropFilter: 'blur(14px)',
                              border: '1.5px solid rgba(255,255,255,0.95)',
                              boxShadow: '0 2px 12px rgba(29,78,216,0.05)',
                            }}
                            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 4px rgba(29,78,216,0.09)')}
                            onBlur={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(29,78,216,0.05)')}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[#1d4ed8]" />
                              <label className="text-sm font-semibold text-slate-700 dark:text-white/80">Часов/нед.</label>
                            </div>
                            <span className="text-sm font-bold text-[#1d4ed8]">{hoursPerWeek}ч</span>
                          </div>
                          <div className="rounded-xl px-4 py-3" style={{
                            background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)',
                            border: '1.5px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(29,78,216,0.05)',
                          }}>
                            <input type="range" min={2} max={60} step={1} value={hoursPerWeek}
                              onChange={e => setHoursPerWeek(Number(e.target.value))}
                              className="w-full h-2 appearance-none rounded-full outline-none cursor-pointer"
                              style={{ background: `linear-gradient(to right, #1d4ed8 0%, #1d4ed8 ${((hoursPerWeek - 2) / 58) * 100}%, #e2e8f0 ${((hoursPerWeek - 2) / 58) * 100}%, #e2e8f0 100%)` }}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-white/30 mt-1 font-medium">
                              <span>2ч</span><span>30ч</span><span>60ч</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Time Calculation Info */}
                      {goal && deadline && hoursPerWeek && (() => {
                        const deadlineDate = new Date(deadline);
                        const today = new Date();
                        const totalDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                        const totalHours = Math.floor(totalDays * (hoursPerWeek / 7));
                        return (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1d4ed8]/8 border border-[#1d4ed8]/20 text-[#1d4ed8] text-xs"
                          >
                            <Brain className="w-4 h-4 shrink-0" />
                            <span>
                              AI рассчитает план на <strong>{totalDays} дней</strong> с доступными <strong>{totalHours} часами</strong>
                            </span>
                          </motion.div>
                        );
                      })()}

                      {/* ── AI Deadline Validation ── */}
                      <DeadlineValidator
                        goal={goal}
                        deadline={deadline}
                        hoursPerWeek={hoursPerWeek}
                        onSuggestedDeadline={d => setDeadline(d)}
                        onSuggestedHours={h => setHoursPerWeek(h)}
                      />

                      {/* ── CTA ── */}
                      <button onClick={handleGenerate} disabled={isLimitReached || clarifyLoading}
                        className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                        style={{
                          background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                          boxShadow: '0 8px 32px rgba(29,78,216,0.4)',
                          fontWeight: 700, fontSize: '1rem',
                        }}>
                        <motion.div className="absolute inset-0 bg-white/10"
                          initial={{ x: '-100%' }} whileHover={{ x: '100%' }} transition={{ duration: 0.5 }} />
                        {clarifyLoading ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full relative" />
                            <span className="relative">Анализируем цель...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 relative" />
                            <span className="relative">Создать план</span>
                            <ArrowRight className="w-5 h-5 relative group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </button>

                      <p className="text-center text-slate-400 dark:text-white/30 text-xs">
                        {planLimit - usage} из {planLimit} планов ({TIERS[tier].cycleName}) осталось
                      </p>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Desktop Preview Panel ───────────────────────── */}
              <div className="hidden lg:flex w-[480px] xl:w-[520px] shrink-0 border-l border-[#1d4ed8]/08 flex-col overflow-y-auto"
                style={{ background: 'rgba(240,244,255,0.6)', backdropFilter: 'blur(24px)' }}>

                {/* Tomi hero */}
                <div className="flex-1 flex flex-col justify-center px-10 xl:px-14 py-12">
                  <div className="flex items-center gap-4 mb-8">
                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                      <TomiAvatar size={56} mood="happy" />
                    </motion.div>
                    <div>
                      <p className="text-slate-800 dark:text-white font-bold text-base">Томи подготовит</p>
                      <p className="text-slate-500 dark:text-white/45 text-sm">Персональный план под вашу цель</p>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="space-y-3.5 mb-10">
                    {FEATURES.map((f, i) => (
                      <motion.div key={f.label}
                        initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.08 }}
                        className="flex items-start gap-3.5 p-3.5 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(29,78,216,0.08)', boxShadow: '0 2px 12px rgba(29,78,216,0.05)' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(29,78,216,0.1)' }}>
                          <f.icon className="w-4.5 h-4.5 text-[#1d4ed8]" style={{ width: 18, height: 18 }} />
                        </div>
                        <div>
                          <p className="text-slate-800 dark:text-white text-sm font-semibold leading-snug">{f.label}</p>
                          <p className="text-slate-400 dark:text-white/40 text-xs mt-0.5">{f.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Mock plan preview */}
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(29,78,216,0.1)', boxShadow: '0 4px 24px rgba(29,78,216,0.08)' }}>
                    <div className="px-5 py-3.5 border-b border-[#1d4ed8]/08 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Пример плана</span>
                      <span className="text-[11px] text-[#1d4ed8] font-semibold">4 этапа · 12 задач</span>
                    </div>
                    <div className="p-5 space-y-3.5">
                      {MOCK_PHASES.map((ph, i) => (
                        <div key={ph.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ph.color }} />
                              <span className="text-xs font-semibold text-slate-700 dark:text-white/80">{ph.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{ph.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/8 overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              style={{ background: ph.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${ph.pct}%` }}
                              transition={{ delay: 0.6 + i * 0.1, duration: 0.7, ease: 'easeOut' }}
                            />
                          </div>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {ph.tasks.map(t => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full text-slate-500 dark:text-white/40"
                                style={{ background: ph.color + '12', border: `1px solid ${ph.color}22` }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              CLARIFYING STEP
          ════════════════════════════════════════════════════════════ */}
          {step === 'clarifying' && (
            <motion.div key="clarifying"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex-1 overflow-y-auto px-5 sm:px-8 lg:px-16 xl:px-24 py-8 lg:py-12 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] lg:pb-12">
              <div className="w-full max-w-xl mx-auto">

                {/* Tomi avatar + comment */}
                <div className="flex items-start gap-4 mb-8">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="shrink-0">
                    <TomiAvatar size={56} mood="focused" />
                  </motion.div>
                  <div>
                    <p className="text-slate-800 dark:text-white font-bold text-base mb-1">Томи хочет уточнить</p>
                    {clarifyComment && (
                      <p className="text-slate-500 dark:text-white/50 text-sm leading-relaxed">{clarifyComment}</p>
                    )}
                  </div>
                </div>

                {/* Goal reminder */}
                <div className="mb-6 p-3.5 rounded-xl bg-[#1d4ed8]/5 border border-[#1d4ed8]/15">
                  <p className="text-xs text-slate-400 dark:text-white/40 font-semibold mb-1">Ваша цель:</p>
                  <p className="text-sm text-slate-700 dark:text-white/80">{goal}</p>
                </div>

                {/* Enriched goal preview */}
                {clarifyAnswers.some(a => a.trim()) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Обогащённая цель для AI</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed whitespace-pre-line">
                      {buildEnrichedGoal()}
                    </p>
                  </motion.div>
                )}

                {/* Questions */}
                <div className="space-y-5 mb-8">
                  {clarifyQuestions.map((q, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-white/80 mb-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1d4ed8] text-white text-[11px] font-bold mr-2">
                          {i + 1}
                        </span>
                        {q}
                      </label>
                      <textarea
                        value={clarifyAnswers[i]}
                        onChange={e => {
                          const next = [...clarifyAnswers];
                          next[i] = e.target.value;
                          setClarifyAnswers(next);
                        }}
                        rows={2}
                        placeholder="Ваш ответ..."
                        className="w-full rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400/60 resize-none focus:outline-none transition-all text-sm leading-relaxed"
                        style={{
                          background: 'rgba(255,255,255,0.82)',
                          backdropFilter: 'blur(16px)',
                          border: clarifyAnswers[i] ? '1.5px solid rgba(29,78,216,0.32)' : '1.5px solid rgba(255,255,255,0.95)',
                          boxShadow: clarifyAnswers[i]
                            ? '0 0 0 4px rgba(29,78,216,0.07), 0 4px 20px rgba(29,78,216,0.08)'
                            : '0 4px 20px rgba(29,78,216,0.06)',
                        }}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => startGenerating(buildEnrichedGoal())}
                    className="flex-1 py-3.5 rounded-2xl text-white flex items-center justify-center gap-2.5 transition-all relative overflow-hidden group"
                    style={{
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                      boxShadow: '0 8px 32px rgba(29,78,216,0.4)',
                      fontWeight: 700, fontSize: '0.95rem',
                    }}>
                    <Sparkles className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    Создать план
                    <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 transition-transform" style={{ width: 18, height: 18 }} />
                  </button>

                  <button
                    onClick={() => startGenerating(goal)}
                    className="py-3.5 px-6 rounded-2xl text-slate-500 dark:text-white/50 text-sm font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    Пропустить
                  </button>

                  <button
                    onClick={() => { setStep('details'); setClarifyQuestions([]); setClarifyAnswers([]); }}
                    className="py-3.5 px-6 rounded-2xl text-slate-400 dark:text-white/40 text-sm font-medium hover:text-slate-600 dark:hover:text-white/60 transition-colors">
                    <ChevronLeft className="w-4 h-4 inline mr-1" />Назад
                  </button>
                </div>

                <p className="text-center text-slate-400 dark:text-white/30 text-xs mt-4">
                  Ответы необязательны — но чем больше деталей, тем точнее план
                </p>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              GENERATING STEP
          ════════════════════════════════════════════════════════════ */}
          {step === 'generating' && (
            <motion.div key="generating"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center px-6 py-12">

              {/* Desktop: two-column */}
              <div className="w-full max-w-3xl grid lg:grid-cols-[1fr_340px] gap-12 items-center">

                {/* Left: Tomi + text */}
                <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
                  <motion.div className="relative mb-6"
                    animate={{ y: [0, -10, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>
                    <motion.div
                      animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }}
                      transition={{ duration: 2.6, repeat: Infinity }}
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'radial-gradient(circle, rgba(29,78,216,0.35) 0%, transparent 70%)', margin: '-20px' }}
                    />
                    <TomiAvatar size={96} mood={genMood(generatingStep)} />
                  </motion.div>

                  <motion.div key={generatingStep}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#1d4ed8] self-center lg:self-start"
                    style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(29,78,216,0.18)', boxShadow: '0 4px 16px rgba(29,78,216,0.1)' }}>
                    {TOMI_GENERATING_LINES[Math.min(generatingStep, TOMI_GENERATING_LINES.length - 1)]}
                  </motion.div>

                  <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}
                    className="text-slate-900 dark:text-white mb-3">
                    Создаём ваш план
                  </h2>
                  <p className="text-slate-500 dark:text-white/50 text-sm max-w-xs">
                    Томи анализирует цель и строит структуру специально для вас…
                  </p>

                  {/* Progress bar */}
                  <div className="mt-6 w-full max-w-xs h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #2563eb, #1d4ed8)' }}
                      animate={{ width: `${(generatingStep / GENERATING_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>

                {/* Right: Steps checklist */}
                <div className="rounded-3xl p-6"
                  style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(29,78,216,0.1)', boxShadow: '0 8px 32px rgba(29,78,216,0.08)' }}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Прогресс</p>
                  <div className="space-y-3">
                    {GENERATING_STEPS.map((s, i) => (
                      <motion.div key={s}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: i <= generatingStep ? 1 : 0.28, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          i < generatingStep
                            ? 'bg-[#10b981] text-white'
                            : i === generatingStep
                            ? 'bg-[#1d4ed8]/10 border-2 border-[#1d4ed8]'
                            : 'bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10'
                        }`}>
                          {i < generatingStep ? (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : i === generatingStep ? (
                            <motion.div animate={{ scale: [1, 1.6, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
                              className="w-2 h-2 rounded-full bg-[#1d4ed8]" />
                          ) : null}
                        </div>
                        <span className={`text-sm ${i < generatingStep ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400 dark:text-white/30'}`}>
                          {s}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {showTemplates && <TemplatesModal onSelect={applyTemplate} onClose={() => setShowTemplates(false)} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} reason="limit" />}
    </div>
  );
}