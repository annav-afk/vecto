import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, ArrowLeft, Check, Rocket, Flame, Compass,
  Target, Sparkles, ArrowUpRight, ChevronRight,
  LayoutDashboard, Plus, User, Star, Clock, BarChart3,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Three brand concepts + current "Stride" for comparison
   ═══════════════════════════════════════════════════════════════════════════ */

interface BrandConcept {
  id: string;
  name: string;
  tagline: string;
  description: string;
  philosophy: string;
  icon: React.ElementType;
  /** SVG logo rendered inline */
  renderLogo: (size: number, glow?: boolean) => React.ReactNode;
  /** Gradient for the logo background */
  gradient: string;
  /** Glow colour */
  glow: string;
  /** Navbar text style */
  fontWeight: number;
  letterSpacing: string;
}

const CONCEPTS: BrandConcept[] = [
  /* ── Current: Stride ─────────────────────────────────────────────────── */
  {
    id: 'stride',
    name: 'Stride',
    tagline: 'Превратите цель в пошаговый план',
    description: 'Текущее название. Stride — «шаг», «темп», уверенное продвижение вперёд. Ассоциируется с ритмичным прогрессом и целеустремлённостью.',
    philosophy: 'Каждый шаг приближает к цели. Постоянный ритм важнее скорости.',
    icon: Zap,
    renderLogo: (s, glow) => (
      <div className="relative flex items-center justify-center" style={{ width: s, height: s }}>
        <div className="absolute inset-0 rounded-[28%]" style={{
          background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
          boxShadow: glow ? '0 0 32px rgba(29,78,216,0.6)' : '0 4px 16px rgba(29,78,216,0.3)',
        }} />
        <div className="absolute inset-0 rounded-[28%] bg-gradient-to-b from-white/25 to-transparent" />
        <Zap className="relative text-white" style={{ width: s * 0.48, height: s * 0.48 }} />
      </div>
    ),
    gradient: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
    glow: 'rgba(29,78,216,0.5)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },

  /* ── Option 1: Forge ─────────────────────────────────────────────────── */
  {
    id: 'forge',
    name: 'Forge',
    tagline: 'Выкуйте свой идеальный план',
    description: 'Forge — «ковать», «создавать». Кузница планов, где сырая идея превращается в отточенную стратегию. Сильный, мощный образ творения.',
    philosophy: 'Великие планы не рождаются — их куют. Огонь амбиций, молот дисциплины.',
    icon: Flame,
    renderLogo: (s, glow) => (
      <div className="relative flex items-center justify-center" style={{ width: s, height: s }}>
        <div className="absolute inset-0 rounded-[28%]" style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 50%, #172554 100%)',
          boxShadow: glow ? '0 0 32px rgba(29,78,216,0.55), 0 0 64px rgba(251,146,60,0.2)' : '0 4px 16px rgba(29,78,216,0.3)',
        }} />
        <div className="absolute inset-0 rounded-[28%] bg-gradient-to-b from-white/20 to-transparent" />
        {/* Anvil + spark icon */}
        <svg className="relative" width={s * 0.52} height={s * 0.52} viewBox="0 0 24 24" fill="none">
          {/* Anvil body */}
          <path d="M4 14h16l-2 4H6l-2-4z" fill="white" opacity="0.95" />
          <path d="M6 14V11a2 2 0 012-2h8a2 2 0 012 2v3" stroke="white" strokeWidth="1.5" fill="none" />
          {/* Hammer / spark */}
          <path d="M12 9V5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 6l3-3 3 3" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Sparks */}
          <circle cx="7" cy="7" r="1" fill="#fbbf24" />
          <circle cx="17" cy="6" r="0.8" fill="#fb923c" />
          <circle cx="15" cy="4" r="0.6" fill="#fbbf24" opacity="0.7" />
        </svg>
      </div>
    ),
    gradient: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
    glow: 'rgba(29,78,216,0.5)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
  },

  /* ── Option 2: Leap ──────────────────────────────────────────────────── */
  {
    id: 'leap',
    name: 'Leap',
    tagline: 'Один прыжок от идеи к результату',
    description: 'Leap — «прыжок», «рывок». Энергия квантового скачка: от хаоса мыслей — к чёткому плану за секунды. Динамичный, оптимистичный бренд.',
    philosophy: 'Не маленькие шаги, а смелые прыжки. Быстрый старт важнее идеального плана.',
    icon: Rocket,
    renderLogo: (s, glow) => (
      <div className="relative flex items-center justify-center" style={{ width: s, height: s }}>
        <div className="absolute inset-0 rounded-[28%]" style={{
          background: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 40%, #1e40af 100%)',
          boxShadow: glow ? '0 0 32px rgba(37,99,235,0.55)' : '0 4px 16px rgba(37,99,235,0.3)',
        }} />
        <div className="absolute inset-0 rounded-[28%] bg-gradient-to-b from-white/22 to-transparent" />
        {/* Upward arc + arrow */}
        <svg className="relative" width={s * 0.54} height={s * 0.54} viewBox="0 0 24 24" fill="none">
          {/* Arc trajectory */}
          <path d="M4 18C4 18 7 6 12 6s8 12 8 12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
          {/* Person leaping */}
          <circle cx="12" cy="7" r="2.2" fill="white" />
          <path d="M12 9.2l-3 4.5h2v3.3h2v-3.3h2l-3-4.5z" fill="white" />
          {/* Motion lines */}
          <path d="M6 15l-2 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <path d="M7 17l-2.5 0.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </svg>
      </div>
    ),
    gradient: 'linear-gradient(145deg, #2563eb, #1d4ed8)',
    glow: 'rgba(37,99,235,0.5)',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },

  /* ── Option 3: Vecto ─────────────────────────────────────────────────── */
  {
    id: 'vecto',
    name: 'Vecto',
    tagline: 'Задайте вектор к своей цели',
    description: 'Vecto — от «вектор»: направление + величина. Чёткое направление от точки А к цели. Техничный, современный, лаконичный бренд.',
    philosophy: 'У каждой цели есть вектор. AI задаёт направление, вы — скорость.',
    icon: Compass,
    renderLogo: (s, glow) => (
      <div className="relative flex items-center justify-center" style={{ width: s, height: s }}>
        <div className="absolute inset-0 rounded-[28%]" style={{
          background: 'linear-gradient(160deg, #1d4ed8 0%, #1e40af 60%, #172554 100%)',
          boxShadow: glow ? '0 0 32px rgba(29,78,216,0.55)' : '0 4px 16px rgba(29,78,216,0.3)',
        }} />
        <div className="absolute inset-0 rounded-[28%] bg-gradient-to-b from-white/20 to-transparent" />
        {/* Vector arrow / compass */}
        <svg className="relative" width={s * 0.52} height={s * 0.52} viewBox="0 0 24 24" fill="none">
          {/* Grid dots */}
          {[4, 8, 12, 16, 20].map(x =>
            [4, 8, 12, 16, 20].map(y => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5" fill="white" opacity="0.15" />
            ))
          )}
          {/* Vector arrow */}
          <path d="M5 19L19 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13 5h6v6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Origin dot */}
          <circle cx="5" cy="19" r="2" fill="white" opacity="0.6" />
          {/* Target pulse */}
          <circle cx="19" cy="5" r="2.5" fill="white" opacity="0.3" />
          <circle cx="19" cy="5" r="1.2" fill="white" />
        </svg>
      </div>
    ),
    gradient: 'linear-gradient(160deg, #1d4ed8, #172554)',
    glow: 'rgba(29,78,216,0.5)',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Miniature UI previews for each concept
   ═══════════════════════════════════════════════════════════════════════════ */

function MiniNavbar({ concept }: { concept: BrandConcept }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/60 dark:border-white/8 bg-white/80 dark:bg-[#0a1122]/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        {concept.renderLogo(24, false)}
        <span
          style={{ fontFamily: "'Syne', sans-serif", fontWeight: concept.fontWeight, letterSpacing: concept.letterSpacing }}
          className="text-slate-900 dark:text-white text-xs"
        >
          {concept.name}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-white/8 flex items-center justify-center">
          <LayoutDashboard className="w-2.5 h-2.5 text-slate-400" />
        </div>
        <div className="h-5 px-2 rounded-md text-white flex items-center text-[8px] font-bold" style={{ background: concept.gradient }}>
          <Plus className="w-2 h-2 mr-0.5" />
        </div>
      </div>
    </div>
  );
}

function MiniTabBar({ concept }: { concept: BrandConcept }) {
  return (
    <div className="flex items-center justify-around py-1.5 border-t border-slate-200/60 dark:border-white/8 bg-white/80 dark:bg-[#0a1122]/80">
      {[LayoutDashboard, Plus, User].map((Icon, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          {i === 1 ? (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center -mt-2" style={{ background: concept.gradient }}>
              <Icon className="w-3 h-3 text-white" />
            </div>
          ) : (
            <Icon className="w-3 h-3" style={{ color: i === 0 ? '#1d4ed8' : '#94a3b8' }} />
          )}
          <span className="text-[6px] font-semibold" style={{ color: i === 0 ? '#1d4ed8' : '#94a3b8' }}>
            {['Планы', 'Создать', 'Профиль'][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniPhonePreview({ concept }: { concept: BrandConcept }) {
  return (
    <div className="w-full max-w-[200px] mx-auto">
      {/* Phone frame */}
      <div className="relative rounded-[20px] overflow-hidden border-2 border-slate-200 dark:border-white/15 shadow-xl" style={{ aspectRatio: '9/18' }}>
        {/* Status bar */}
        <div className="h-4 flex items-center justify-between px-3" style={{ background: concept.gradient }}>
          <span className="text-white text-[6px] font-bold">9:41</span>
          <div className="flex gap-1">
            <div className="w-2 h-1.5 bg-white/60 rounded-sm" />
            <div className="w-2 h-1.5 bg-white/60 rounded-sm" />
          </div>
        </div>

        {/* Navbar */}
        <MiniNavbar concept={concept} />

        {/* Content */}
        <div className="bg-gradient-to-b from-blue-50/80 to-white dark:from-[#0d1a36]/80 dark:to-[#060d1e] p-2.5 flex-1" style={{ minHeight: 160 }}>
          {/* Heading */}
          <p className="text-[7px] font-bold text-slate-800 dark:text-white mb-1.5" style={{ fontFamily: "'Syne', sans-serif" }}>
            Мои планы
          </p>

          {/* Plan cards */}
          {['SaaS за 3 месяца', 'Python Junior'].map((t, i) => (
            <div key={t} className="mb-1.5 p-1.5 rounded-lg bg-white dark:bg-white/8 border border-slate-100 dark:border-white/8 shadow-sm">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: i === 0 ? '#1d4ed8' : '#10b981' }} />
                <span className="text-[6px] font-semibold text-slate-700 dark:text-white/70 truncate">{t}</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 dark:bg-white/8 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: i === 0 ? '65%' : '30%', background: concept.gradient }} />
              </div>
            </div>
          ))}

          {/* CTA button */}
          <div className="mt-2 py-1 rounded-lg text-center" style={{ background: concept.gradient }}>
            <span className="text-white text-[6px] font-bold flex items-center justify-center gap-0.5">
              <Sparkles className="w-2 h-2" /> Новый план
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <MiniTabBar concept={concept} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Landing hero preview
   ═══════════════════════════════════════════════════════════════════════════ */
function MiniHeroPreview({ concept }: { concept: BrandConcept }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg">
      {/* Hero section */}
      <div className="p-4 text-center" style={{ background: 'linear-gradient(160deg, #eef2ff, #f0f4ff, #e8f5ff)' }}>
        <div className="flex justify-center mb-2">
          {concept.renderLogo(36, true)}
        </div>
        <h3
          style={{ fontFamily: "'Syne', sans-serif", fontWeight: concept.fontWeight, letterSpacing: concept.letterSpacing }}
          className="text-slate-900 text-base mb-1"
        >
          {concept.name}
        </h3>
        <p className="text-[10px] text-slate-500 mb-3">{concept.tagline}</p>
        <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-[10px] font-bold" style={{ background: concept.gradient, boxShadow: `0 4px 16px ${concept.glow}` }}>
          <Sparkles className="w-2.5 h-2.5" />
          Создать план
          <ChevronRight className="w-2.5 h-2.5" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */
export function BrandingPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered]   = useState<string | null>(null);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen text-slate-900 dark:text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10" style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f0f4ff 35%, #e8f5ff 100%)' }}>
        <div className="hidden dark:block absolute inset-0" style={{ background: 'linear-gradient(160deg, #060d1e 0%, #070f1e 100%)' }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-[#1d4ed8]/10 backdrop-blur-2xl shadow-sm navbar-safe"
        style={{ background: 'rgba(255,255,255,0.92)' }}>
        <style>{`.dark nav { background: rgba(6,13,30,0.92) !important; }`}</style>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Назад</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }} className="text-sm">
              Брендинг
            </span>
          </div>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12" style={{ paddingBottom: 'max(6rem, calc(4rem + env(safe-area-inset-bottom)))' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1d4ed8]/8 border border-[#1d4ed8]/18 text-[#1d4ed8] text-xs font-semibold mb-4">
            <Star className="w-3 h-3" />
            Логотип + Название
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)', lineHeight: 1.1 }}>
            Три варианта бренда
          </h1>
          <p className="text-slate-500 dark:text-white/50 mt-3 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
            Текущий «Stride» + три альтернативы. Нажмите на карточку, чтобы выбрать.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-12">
          {CONCEPTS.map((c, i) => {
            const isSelected = selected === c.id;
            const isHovered  = hovered === c.id;
            const isCurrent  = c.id === 'stride';

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onHoverStart={() => setHovered(c.id)}
                onHoverEnd={() => setHovered(null)}
                onClick={() => setSelected(isSelected ? null : c.id)}
                className="relative cursor-pointer group"
              >
                {/* Selection ring */}
                <motion.div
                  className="absolute -inset-[3px] rounded-[28px] z-0"
                  animate={{
                    opacity: isSelected ? 1 : 0,
                    scale: isSelected ? 1 : 0.98,
                  }}
                  transition={{ duration: 0.2 }}
                  style={{ background: c.gradient, filter: 'blur(0px)' }}
                />

                <div
                  className="relative z-10 rounded-3xl overflow-hidden transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: isSelected ? '2px solid transparent' : '1.5px solid rgba(255,255,255,0.9)',
                    boxShadow: isHovered || isSelected
                      ? `0 20px 60px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.95)`
                      : '0 4px 24px rgba(29,78,216,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  }}
                >
                  {/* Badge */}
                  {isCurrent && (
                    <div className="absolute top-4 right-4 z-20 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#1d4ed8] bg-[#1d4ed8]/10 border border-[#1d4ed8]/20">
                      Текущий
                    </div>
                  )}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute top-4 right-4 z-20 w-7 h-7 rounded-full flex items-center justify-center text-white"
                      style={{ background: c.gradient, boxShadow: `0 4px 12px ${c.glow}` }}
                    >
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </motion.div>
                  )}

                  <div className="p-6 sm:p-7">
                    {/* Logo + name row */}
                    <div className="flex items-center gap-4 mb-5">
                      <motion.div
                        animate={{ scale: isHovered ? 1.08 : 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        {c.renderLogo(56, isHovered || isSelected)}
                      </motion.div>
                      <div>
                        <h2
                          style={{ fontFamily: "'Syne', sans-serif", fontWeight: c.fontWeight, letterSpacing: c.letterSpacing, fontSize: '1.6rem', lineHeight: 1.1 }}
                          className="text-slate-900 dark:text-white"
                        >
                          {c.name}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-white/50 mt-1 font-medium">{c.tagline}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed mb-4">
                      {c.description}
                    </p>

                    {/* Philosophy badge */}
                    <div className="px-3.5 py-2.5 rounded-xl mb-5"
                      style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}>
                      <p className="text-xs text-[#1d4ed8] font-semibold flex items-center gap-1.5">
                        <Target className="w-3 h-3 shrink-0" />
                        Философия
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/45 mt-1 italic leading-relaxed">
                        &laquo;{c.philosophy}&raquo;
                      </p>
                    </div>

                    {/* Previews */}
                    <div className="grid grid-cols-2 gap-3">
                      <MiniPhonePreview concept={c} />
                      <div className="space-y-3">
                        <MiniHeroPreview concept={c} />
                        {/* Logo sizes preview */}
                        <div className="flex items-end gap-2 justify-center py-2">
                          {[20, 28, 36, 44].map(sz => (
                            <motion.div
                              key={sz}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.3 + sz * 0.005 }}
                            >
                              {c.renderLogo(sz, false)}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selection summary */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="max-w-xl mx-auto text-center"
            >
              <div className="p-6 rounded-2xl" style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(29,78,216,0.15)',
                boxShadow: '0 8px 32px rgba(29,78,216,0.08)',
              }}>
                <div className="flex justify-center mb-3">
                  {CONCEPTS.find(c => c.id === selected)?.renderLogo(48, true)}
                </div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }} className="text-xl text-slate-900 dark:text-white mb-1">
                  {CONCEPTS.find(c => c.id === selected)?.name}
                </h3>
                <p className="text-slate-500 dark:text-white/50 text-sm mb-4">
                  Выбранный вариант. Скажите — и я применю его ко всему приложению.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', boxShadow: '0 4px 16px rgba(29,78,216,0.4)' }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Вернуться в приложение
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 overflow-x-auto"
        >
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }} className="text-lg text-slate-900 dark:text-white mb-4 text-center">
            Сравнительная таблица
          </h3>
          <table className="w-full text-sm rounded-2xl overflow-hidden" style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.9)',
          }}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Критерий</th>
                {CONCEPTS.map(c => (
                  <th key={c.id} className="text-center px-3 py-3">
                    <div className="flex flex-col items-center gap-1">
                      {c.renderLogo(24, false)}
                      <span className="text-xs font-bold text-slate-700 dark:text-white/70">{c.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                { label: 'Запоминаемость', values: ['4/5', '5/5', '4/5', '4/5'] },
                { label: 'Универсальность', values: ['5/5', '4/5', '5/5', '4/5'] },
                { label: 'Энергетика', values: ['3/5', '5/5', '5/5', '3/5'] },
                { label: 'Техничность', values: ['3/5', '3/5', '3/5', '5/5'] },
                { label: 'RU-аудитория', values: ['4/5', '4/5', '5/5', '4/5'] },
                { label: 'Уникальность', values: ['3/5', '4/5', '4/5', '5/5'] },
              ].map((row, ri) => (
                <tr key={row.label} className={ri % 2 === 0 ? 'bg-slate-50/50 dark:bg-white/3' : ''}>
                  <td className="px-4 py-2.5 font-medium text-slate-600 dark:text-white/60 whitespace-nowrap">{row.label}</td>
                  {row.values.map((v, vi) => (
                    <td key={vi} className="text-center px-3 py-2.5 font-semibold" style={{ color: v.startsWith('5') ? '#10b981' : v.startsWith('4') ? '#1d4ed8' : '#94a3b8' }}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
