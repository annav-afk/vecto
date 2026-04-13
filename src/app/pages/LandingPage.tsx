import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, BarChart3, Calendar, Download, ChevronRight,
  CheckCircle2, Clock, Target, GitBranch,
  Star, ListChecks, Sparkles, Send, ArrowRight,
  Shield, Layers, MousePointer2, X,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { AuroraBackground } from '../components/AuroraBackground';
import { TIERS, TIER_ORDER, PlanTier } from '../lib/plans';
import { VectoLogo, VECTO_FONT_STYLE } from '../components/VectoLogo';

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: ListChecks, title: 'Умный план за секунды',   desc: 'Опишите цель — получите структурированный план с этапами и задачами', color: '#1d4ed8', glow: 'rgba(29,78,216,0.25)' },
  { icon: Clock,      title: 'Временные рамки',         desc: 'Расчёт сроков на основе вашей доступности и дедлайна',                color: '#2563eb', glow: 'rgba(37,99,235,0.25)' },
  { icon: Target,     title: 'Приоритизация задач',     desc: 'Высокий, средний, низкий приоритет с зависимостями',                  color: '#10b981', glow: 'rgba(16,185,129,0.25)' },
  { icon: GitBranch,  title: 'Зависимости задач',       desc: 'Понимайте, что нужно сделать сначала — стрелки на таймлайне',        color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  { icon: BarChart3,  title: '3 режима просмотра',      desc: 'Таймлайн, Kanban и Календарь — выберите свой',                       color: '#1e40af', glow: 'rgba(30,64,175,0.25)' },
  { icon: Download,   title: 'Экспорт везде',           desc: 'CSV, Google Calendar, Notion-совместимый формат',                    color: '#ef4444', glow: 'rgba(239,68,68,0.25)' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: MousePointer2, title: 'Опишите вашу цель', desc: 'Напишите в свободной форме — Vecto сам разберётся в деталях', color: '#1d4ed8' },
  { step: '02', icon: Sparkles,      title: 'AI строит план',    desc: 'Этапы, задачи, приоритеты, временные оценки и зависимости',   color: '#10b981' },
  { step: '03', icon: Layers,        title: 'Работайте и растите', desc: 'Трекайте прогресс, экспортируйте, делитесь командой',       color: '#1e40af' },
];

const PRICING = TIER_ORDER.map(id => TIERS[id]);

const DEMO_PLANS = [
  {
    goal: 'Запустить SaaS-продукт за 3 месяца',
    phases: [
      { name: 'Исследование', color: '#1d4ed8', w: 30 },
      { name: 'MVP',          color: '#2563eb', w: 55 },
      { name: 'Маркетинг',   color: '#10b981', w: 42 },
      { name: 'Запуск 🚀',   color: '#f59e0b', w: 20 },
    ],
    tasks: ['Анализ конкурентов', 'Интервью с клиентами', 'Прототип', 'Backend API'],
  },
  {
    goal: 'Выучить Python до уровня Junior',
    phases: [
      { name: 'Основы',   color: '#1d4ed8', w: 38 },
      { name: 'ООП',      color: '#2563eb', w: 50 },
      { name: 'Проекты',  color: '#10b981', w: 65 },
      { name: 'Портфолио', color: '#1e40af', w: 28 },
    ],
    tasks: ['Переменные', 'Функции', 'Файлы', 'Django'],
  },
  {
    goal: 'Похудеть на 10 кг за 4 месяца',
    phases: [
      { name: 'Питание',    color: '#10b981', w: 22 },
      { name: 'Тренировки', color: '#1d4ed8', w: 68 },
      { name: 'Привычки',   color: '#f59e0b', w: 45 },
      { name: 'Контроль',   color: '#ef4444', w: 30 },
    ],
    tasks: ['КБЖУ', 'Кардио', 'Шагомер', 'Вода'],
  },
];

// ── Animated typing placeholder ───────────────────────────────────────────────
const PLACEHOLDERS = [
  'Запустить SaaS за 3 месяца...',
  'Выучить Python до Junior...',
  'Написать книгу за полгода...',
  'Набрать 10 000 подписчиков...',
];

function useTypingText() {
  const [text, setText] = useState('');
  const [idx,  setIdx]  = useState(0);
  const [del,  setDel]  = useState(false);
  const ref = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const full = PLACEHOLDERS[idx];
    if (!del) {
      if (text.length < full.length) {
        ref.current = setTimeout(() => setText(full.slice(0, text.length + 1)), 42);
      } else {
        ref.current = setTimeout(() => setDel(true), 2400);
      }
    } else {
      if (text.length > 0) {
        ref.current = setTimeout(() => setText(t => t.slice(0, -1)), 22);
      } else {
        setIdx(i => (i + 1) % PLACEHOLDERS.length);
        setDel(false);
      }
    }
    return () => clearTimeout(ref.current);
  }, [text, del, idx]);

  return text;
}

function useDemoLoop() {
  const [idx,   setIdx]   = useState(0);
  const [fade,  setFade]  = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => { setIdx(i => (i + 1) % DEMO_PLANS.length); setFade(false); }, 400);
    }, 5500);
    return () => clearInterval(t);
  }, []);
  return { plan: DEMO_PLANS[idx], fade, idx };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LandingPage() {
  const navigate    = useNavigate();
  const [heroGoal, setHeroGoal] = useState('');
  const typingText  = useTypingText();
  const { plan: demoPlan, fade, idx: demoIdx } = useDemoLoop();

  const submit = () => navigate('/new', { state: { goal: heroGoal.trim() } });

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen text-slate-900 dark:text-white overflow-x-hidden"
    >
      {/* ── Page background ── */}
      <div className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(160deg, #eef2ff 0%, #f0f4ff 35%, #e8f5ff 70%, #eff6ff 100%)',
        }}
      >
        <div className="dark:hidden absolute inset-0" style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f0f4ff 35%, #e8f5ff 70%, #eff6ff 100%)' }} />
        <div className="hidden dark:block absolute inset-0" style={{ background: 'linear-gradient(160deg, #060d1e 0%, #07101f 40%, #060b18 100%)' }} />
        <AuroraBackground variant="landing" />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-28 sm:pt-36 pb-0 px-4 sm:px-6">
        <div className="relative max-w-6xl mx-auto">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-7"
          >
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[#1d4ed8] text-sm font-semibold"
              style={{
                background: 'rgba(29,78,216,0.08)',
                border: '1px solid rgba(29,78,216,0.18)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-[#1d4ed8] animate-pulse" />
              Планировщик нового поколения — на базе AI
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65 }}
            style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 'clamp(2rem, 8vw, 5.5rem)', lineHeight: 1.04, letterSpacing: '-0.02em' }}
            className="text-center mb-6"
          >
            <span className="text-slate-900 dark:text-white">Превратите цель</span>
            <br />
            <span className="shimmer-text">в пошаговый план</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="text-center text-slate-500 dark:text-white/55 text-base sm:text-lg max-w-lg mx-auto mb-10 sm:mb-12 leading-relaxed px-2"
          >
            Напишите цель — Vecto построит структуру с этапами, задачами, приоритетами и сроками за секунды.
          </motion.p>

          {/* ── Hero input glass ── */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.55 }}
            className="max-w-2xl mx-auto mb-5"
          >
            <div
              className="flex items-center gap-2 p-2 rounded-2xl noise-overlay"
              style={{
                background: 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 12px 48px rgba(29,78,216,0.14), inset 0 1px 0 rgba(255,255,255,1)',
              }}
            >
              <Sparkles className="w-5 h-5 text-[#1d4ed8]/50 ml-2 shrink-0" />
              <input
                value={heroGoal}
                onChange={e => setHeroGoal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={typingText || 'Опишите вашу цель...'}
                className="flex-1 bg-transparent px-2 py-2.5 text-slate-900 dark:text-white placeholder-slate-400/80 text-sm sm:text-base focus:outline-none"
              />
              <motion.button
                onClick={submit}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-bold shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                  boxShadow: '0 4px 20px rgba(29,78,216,0.45)',
                }}
              >
                <span className="hidden sm:inline">Создать план</span>
                <Send className="w-4 h-4" />
              </motion.button>
            </div>
            <p className="text-center text-xs text-slate-400/80 dark:text-white/30 mt-2.5">
              Бесплатно · 10 планов/мес · Без установки
            </p>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-6 sm:gap-12 flex-wrap mb-16 sm:mb-20"
          >
            {[['500+','активных пользователей'],['4.9 ★','средний рейтинг'],['~5 сек','генерация плана']].map(([v,l]) => (
              <div key={l} className="text-center">
                <div className="text-xl font-black text-slate-900 dark:text-white">{v}</div>
                <div className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{l}</div>
              </div>
            ))}
          </motion.div>

          {/* ── Live Demo glass window ── */}
          <motion.div
            initial={{ opacity: 0, y: 70 }} animate={{ opacity: 1, y: 16 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl mx-auto"
          >
            {/* Floating decorative chips */}
            <div className="absolute -left-8 top-16 hidden lg:block float-anim" style={{ animationDelay: '0.5s' }}>
              <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/80">MVP готов ✓</span>
              </div>
            </div>
            <div className="absolute -right-6 top-32 hidden lg:block float-anim" style={{ animationDelay: '1.2s' }}>
              <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-lg">
                <Zap className="w-4 h-4 text-[#f59e0b]" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/80">68% выполнено</span>
              </div>
            </div>
            <div className="absolute -left-10 bottom-24 hidden lg:block float-anim-slow">
              <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-lg">
                <Target className="w-4 h-4 text-[#1d4ed8]" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/80">4 этапа</span>
              </div>
            </div>

            {/* Browser chrome */}
            <div
              className="rounded-3xl overflow-hidden noise-overlay"
              style={{
                background: 'rgba(255,255,255,0.68)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 40px 100px rgba(29,78,216,0.18), 0 0 0 1px rgba(255,255,255,0.7), inset 0 1px 0 rgba(255,255,255,1)',
              }}
            >
              {/* Title bar */}
              <div
                className="flex items-center gap-3 px-5 py-4 border-b"
                style={{ borderColor: 'rgba(29,78,216,0.08)', background: 'rgba(255,255,255,0.5)' }}
              >
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
                </div>
                <div className="flex-1 mx-4 h-6 rounded-lg flex items-center px-3"
                  style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.1)' }}>
                  <span className="text-slate-400 text-xs">vecto.app/plan/my-goal</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-emerald-700">Live</span>
                </div>
              </div>

              {/* Plan content */}
              <div className="p-6 sm:p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={demoPlan.goal}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: fade ? 0 : 1, y: fade ? -8 : 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35 }}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#1d4ed8]/60 mb-2">Ваш план</p>
                        <h3 className="text-slate-900 dark:text-white font-bold text-xl leading-snug">{demoPlan.goal}</h3>
                      </div>
                      <div className="shrink-0">
                        <div
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                          style={{ background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.2)', color: '#1d4ed8' }}
                        >
                          <Zap className="w-3 h-3" /> В работе
                        </div>
                      </div>
                    </div>

                    {/* Phases timeline */}
                    <div className="space-y-3 mb-7">
                      {demoPlan.phases.map((ph, i) => (
                        <motion.div
                          key={ph.name}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center gap-3"
                        >
                          <span className="w-24 sm:w-32 shrink-0 text-xs text-slate-500 dark:text-white/45 text-right font-medium truncate">
                            {ph.name}
                          </span>
                          <div className="flex-1 h-8 rounded-xl overflow-hidden"
                            style={{ background: 'rgba(29,78,216,0.06)' }}>
                            <motion.div
                              className="h-full rounded-xl flex items-center px-3 relative overflow-hidden"
                              style={{ background: `linear-gradient(90deg, ${ph.color}bb, ${ph.color})` }}
                              initial={{ width: 0 }}
                              animate={{ width: `${ph.w}%` }}
                              transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: 'easeOut' }}
                            >
                              {/* Inner highlight */}
                              <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
                                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)' }} />
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Task chips */}
                    <div className="flex flex-wrap gap-2">
                      {demoPlan.tasks.map((t, i) => (
                        <motion.span
                          key={t}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4 + i * 0.07 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{
                            background: 'rgba(29,78,216,0.07)',
                            border: '1px solid rgba(29,78,216,0.14)',
                            color: '#1e40af',
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />{t}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Demo pagination dots */}
                <div className="flex justify-center gap-2 mt-6">
                  {DEMO_PLANS.map((_, i) => (
                    <motion.div key={i} className="h-1.5 rounded-full transition-all duration-400"
                      animate={{ width: i === demoIdx ? 20 : 6, background: i === demoIdx ? '#1d4ed8' : 'rgba(29,78,216,0.2)' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="h-32 relative z-10"
          style={{ background: 'linear-gradient(to bottom, transparent, #f0f4ff)' }}
        />
        <style>{`.dark .hero-fade { background: linear-gradient(to bottom, transparent, #060d1e) !important; }`}</style>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="how" className="relative py-24 sm:py-32 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[#1d4ed8] text-xs font-bold mb-4"
              style={{ background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.15)' }}>
              Как это работает
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.7rem, 5vw, 2.6rem)' }}
              className="text-slate-900 dark:text-white">
              Три шага до готового плана
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[33%] right-[33%] h-px"
              style={{ background: 'linear-gradient(90deg, rgba(29,78,216,0.2), rgba(29,78,216,0.5), rgba(29,78,216,0.2))' }} />

            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative group"
              >
                <div
                  className="relative p-7 rounded-3xl h-full transition-all duration-300 noise-overlay"
                  style={{
                    background: 'rgba(255,255,255,0.65)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 8px 32px rgba(29,78,216,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
                  }}
                >
                  {/* Step number watermark */}
                  <div className="absolute top-4 right-5 text-5xl font-black select-none pointer-events-none"
                    style={{ color: `${item.color}12`, fontFamily: "'Syne', sans-serif" }}>
                    {item.step}
                  </div>
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 relative"
                    style={{ background: `linear-gradient(135deg, ${item.color}18, ${item.color}30)`, border: `1px solid ${item.color}25` }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                    <div className="absolute inset-0 rounded-2xl"
                      style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)' }} />
                  </div>
                  <p className="text-xs font-bold mb-2" style={{ color: item.color }}>{item.step}</p>
                  <h3 className="text-slate-900 dark:text-white font-bold text-base mb-2">{item.title}</h3>
                  <p className="text-slate-500 dark:text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FEATURES                                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24 sm:py-32 px-4 sm:px-6">
        {/* Section backdrop */}
        <div className="absolute inset-0"
          style={{ background: 'rgba(29,78,216,0.03)', backdropFilter: 'blur(0px)' }} />

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[#2563eb] text-xs font-bold mb-4"
              style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>
              Функции
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.7rem, 5vw, 2.6rem)' }}
              className="text-slate-900 dark:text-white">
              Всё для реализации цели
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group relative p-6 rounded-3xl cursor-default noise-overlay"
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 4px 24px rgba(29,78,216,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
                  transition: 'box-shadow 0.3s, transform 0.2s',
                }}
                // hover glow via inline style
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 48px ${f.glow}, inset 0 1px 0 rgba(255,255,255,0.9)`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(29,78,216,0.05), inset 0 1px 0 rgba(255,255,255,0.9)';
                }}
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 relative group-hover:scale-110 transition-transform"
                  style={{ background: `linear-gradient(135deg, ${f.color}15, ${f.color}28)`, border: `1px solid ${f.color}20` }}>
                  <f.icon className="w-5 h-5 relative z-10" style={{ color: f.color }} />
                  <div className="absolute inset-0 rounded-2xl"
                    style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.6), transparent)' }} />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-2">{f.title}</h3>
                <p className="text-slate-500 dark:text-white/50 text-sm leading-relaxed">{f.desc}</p>

                {/* Hover shimmer border */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: `linear-gradient(135deg, ${f.color}08, transparent, ${f.color}05)` }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRICING                                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-24 sm:py-32 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[#1d4ed8] text-xs font-bold mb-4"
              style={{ background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.15)' }}>
              Тарифы
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.7rem, 5vw, 2.6rem)' }}
              className="text-slate-900 dark:text-white">
              Начните бесплатно
            </h2>
            <p className="text-slate-500 dark:text-white/50 mt-3 text-sm">Три дня бесплатно — потом выберите подходящий план</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PRICING.map((plan, i) => {
              const isHighlighted = plan.id === 'pro';
              const isMedium = plan.id === 'medium';
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="relative p-7 rounded-3xl noise-overlay flex flex-col"
                  style={isHighlighted ? {
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: `1.5px solid ${plan.color}40`,
                    boxShadow: `0 20px 60px ${plan.glowColor}, inset 0 1px 0 rgba(255,255,255,0.95)`,
                  } : {
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                    border: '1px solid rgba(255,255,255,0.82)',
                    boxShadow: '0 8px 32px rgba(29,78,216,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                  }}
                >
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`, boxShadow: `0 4px 16px ${plan.glowColor}` }}>
                      {plan.badge}
                    </div>
                  )}

                  {/* Tier icon */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: `${plan.color}14`, border: `1px solid ${plan.color}25` }}>
                    {plan.id === 'free' && <Zap className="w-5 h-5" style={{ color: plan.color }} />}
                    {plan.id === 'medium' && <Target className="w-5 h-5" style={{ color: plan.color }} />}
                    {plan.id === 'pro' && <Star className="w-5 h-5" style={{ color: plan.color }} />}
                  </div>

                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: plan.color }}>{plan.name}</p>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl text-slate-900 dark:text-white font-black">{plan.price}</span>
                      <span className="text-slate-400 text-sm mb-1">{plan.period}</span>
                    </div>
                    {plan.id === 'free' && (
                      <p className="text-xs text-slate-400 mt-1">Пробный период — 3 дня</p>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-white/65">
                        <div className="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${plan.color}14`, minWidth: 18, minHeight: 18 }}>
                          <CheckCircle2 className="w-3 h-3" style={{ color: plan.color }} />
                        </div>
                        {f}
                      </li>
                    ))}
                    {plan.notFeatures?.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400/60 dark:text-white/30 line-through">
                        <div className="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: 'rgba(100,116,139,0.08)', minWidth: 18, minHeight: 18 }}>
                          <X className="w-3 h-3 text-slate-300" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    onClick={() => navigate('/new')}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
                    style={isHighlighted ? {
                      background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                      color: 'white',
                      boxShadow: `0 8px 24px ${plan.glowColor}`,
                    } : isMedium ? {
                      background: `${plan.color}10`,
                      border: `1px solid ${plan.color}25`,
                      color: plan.color,
                    } : {
                      background: 'rgba(100,116,139,0.08)',
                      border: '1px solid rgba(100,116,139,0.15)',
                      color: '#64748b',
                    }}
                  >
                    {plan.cta}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>

          {/* Comparison note */}
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center text-xs text-slate-400 mt-6"
          >
            Тариф активируется администратором после подтверждения оплаты
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CTA                                                                    */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div
            className="relative p-8 sm:p-16 rounded-3xl text-center overflow-hidden noise-overlay"
            style={{
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 24px 80px rgba(29,78,216,0.14), inset 0 1px 0 rgba(255,255,255,1)',
            }}
          >
            {/* Inner glow blobs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(29,78,216,0.12), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.10), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 8px 24px rgba(29,78,216,0.4)' }}>
                <Star className="w-7 h-7 text-white" />
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(1.5rem, 4vw, 2.2rem)' }}
                className="text-slate-900 dark:text-white mb-4">
                Готовы перейти от идеи к действию?
              </h2>
              <p className="text-slate-500 dark:text-white/50 mb-8 text-base">
                Тысячи людей уже используют Vecto для реализации своих целей
              </p>
              <motion.button
                onClick={() => navigate('/new')}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl text-white font-bold text-base"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                  boxShadow: '0 8px 32px rgba(29,78,216,0.4)',
                }}
              >
                <Sparkles className="w-5 h-5" />
                Создать первый план
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative py-10 px-6 text-center text-sm"
        style={{ borderTop: '1px solid rgba(29,78,216,0.08)' }}>
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <VectoLogo size={28} />
          <span style={VECTO_FONT_STYLE} className="text-slate-700 dark:text-white/60 text-base">
            Vecto
          </span>
        </div>
        <p className="text-slate-400 dark:text-white/30">© 2026 Vecto. Планировщик задач нового поколения.</p>
        <div className="flex items-center justify-center gap-5 mt-3">
          <a href="/prd" className="text-xs text-slate-400 hover:text-[#1d4ed8] transition-colors">PRD документ</a>
          <span className="text-slate-300">·</span>
          <a href="/dashboard" className="text-xs text-slate-400 hover:text-[#1d4ed8] transition-colors">Мои планы</a>
          <span className="text-slate-300">·</span>
          <a href="/branding" className="text-xs text-slate-400 hover:text-[#1d4ed8] transition-colors">Брендинг</a>
        </div>
      </footer>
    </div>
  );
}