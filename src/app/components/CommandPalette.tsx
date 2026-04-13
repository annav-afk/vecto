import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Sparkles, Plus, ChevronRight, Tag, Clock, Flag, X, AlertCircle, RotateCcw, Brain, CheckCircle2, Calendar } from 'lucide-react';
import { Plan, Task, Priority } from '../lib/types';
import { aiParseTask } from '../lib/api';
import { playClick, playComplete, playError } from '../lib/sounds';
import { toast } from 'sonner';

interface ParsedTask {
  title: string;
  priority: Priority;
  duration_hours: number;
  phase_name: string | null;
  end_date: string | null;
  tags: string[];
}

interface Props {
  plan: Plan;
  onClose: () => void;
  onAddTask: (phaseId: string, task: Partial<Task>) => void;
}

const PRIORITY_COLORS: Record<Priority, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const PRIORITY_LABELS: Record<Priority, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

const EXAMPLES = [
  'Написать питч-дек к пятнице, высокий приоритет',
  'Настроить CI/CD в фазе разработки, 4 часа',
  'Собрать обратную связь от 5 пользователей, средний',
  'Дизайн лендинга, 8 часов, высокий приоритет',
  'Провести код-ревью завтра, 2 часа',
  'Подготовить презентацию для инвесторов, срочно',
];

// ── Loading skeleton ──────────────────────────────────────────────────────────
function ParseSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-3 py-2"
    >
      {/* AI thinking badge */}
      <div className="flex items-center gap-2.5 px-1">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="shrink-0"
        >
          <Brain className="w-4 h-4 text-[#1d4ed8]" />
        </motion.div>
        <span className="text-xs text-[#1d4ed8]" style={{ fontWeight: 600 }}>
          Томи анализирует задачу…
        </span>
        <motion.div
          className="flex gap-1 ml-auto"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.6 }}
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8]"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      </div>

      {/* Skeleton card */}
      <div className="p-4 rounded-xl border border-[#1d4ed8]/15 bg-[#1d4ed8]/3">
        <div className="h-4 bg-[#1d4ed8]/10 rounded-lg w-3/4 mb-3 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-6 bg-[#1d4ed8]/8 rounded-lg w-20 animate-pulse" />
          <div className="h-6 bg-[#1d4ed8]/8 rounded-lg w-16 animate-pulse" />
          <div className="h-6 bg-[#1d4ed8]/8 rounded-lg w-24 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

export function CommandPalette({ plan, onClose, onAddTask }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(plan.phases[0]?.id ?? '');
  const [added, setAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleParse = useCallback(async (text?: string) => {
    const val = (text ?? input).trim();
    if (!val) return;
    setLoading(true);
    setError('');
    setErrorCode('');
    setParsed(null);
    setAdded(false);
    try {
      const res = await aiParseTask({
        input: val,
        phases: plan.phases.map(p => ({ name: p.name })),
        planDeadline: plan.deadline,
      });
      setParsed(res);
      playClick();
      // Auto-select phase if matched
      if (res.phase_name) {
        const matched = plan.phases.find(p =>
          p.name.toLowerCase().includes(res.phase_name!.toLowerCase()) ||
          res.phase_name!.toLowerCase().includes(p.name.toLowerCase())
        );
        if (matched) setSelectedPhaseId(matched.id);
      }
    } catch (err: any) {
      const code = err?.code ?? '';
      setErrorCode(code);
      if (code === 'quota_exceeded') {
        setError('Лимит AI исчерпан. Пополните баланс на platform.openai.com');
      } else if (code === 'rate_limited') {
        setError('AI временно перегружен. Попробуйте через минуту');
      } else if (code === 'not_configured') {
        setError('AI не настроен на сервере');
      } else {
        setError(err.message ?? 'Ошибка парсинга');
      }
      playError();
    } finally {
      setLoading(false);
    }
  }, [input, plan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (parsed) handleAdd();
      else handleParse();
    }
  };

  const handleExampleClick = (ex: string) => {
    setInput(ex);
    setParsed(null);
    setError('');
    // Auto-parse after setting input
    setTimeout(() => handleParse(ex), 50);
  };

  const handleAdd = () => {
    if (!parsed || !selectedPhaseId) return;
    const phase = plan.phases.find(p => p.id === selectedPhaseId);
    if (!phase) return;

    onAddTask(selectedPhaseId, {
      title: parsed.title,
      priority: parsed.priority,
      duration_hours: parsed.duration_hours || 2,
      end_date: parsed.end_date || phase.end_date,
      start_date: phase.start_date,
      tags: parsed.tags || [],
    });

    setAdded(true);
    playComplete();
    toast.success(`Задача «${parsed.title}» добавлена �� «${phase.name}»`);

    // Close after brief celebration
    setTimeout(onClose, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh] px-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(29,78,216,0.08)' }}
      >
        {/* AI-powered header badge */}
        <div className="px-4 pt-3 pb-0 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1d4ed8]/8 border border-[#1d4ed8]/15">
            <Sparkles className="w-3 h-3 text-[#1d4ed8]" />
            <span className="text-[10px] text-[#1d4ed8] uppercase tracking-wider" style={{ fontWeight: 700 }}>
              AI-парсинг от Томи
            </span>
          </div>
          <span className="text-[10px] text-slate-300 dark:text-white/20 ml-auto">
            Опиши задачу своими словами
          </span>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-white/8">
          {loading
            ? <Loader2 className="w-5 h-5 text-[#1d4ed8] animate-spin shrink-0" />
            : parsed
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <Search className="w-5 h-5 text-slate-400 dark:text-white/30 shrink-0" />
          }
          <input
            ref={inputRef}
            value={input}
            onChange={e => {
              const v = e.target.value;
              setInput(v); setParsed(null); setError(''); setAdded(false);
              // Debounce: auto-parse after 1.2s pause (min 5 chars)
              if (debounceRef.current) clearTimeout(debounceRef.current);
              if (v.trim().length >= 5) {
                debounceRef.current = setTimeout(() => handleParse(v), 1200);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Напиши задачу: что, когда, приоритет…"
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 text-sm focus:outline-none"
            style={{ fontFamily: "'Inter', sans-serif" }}
            disabled={added}
          />
          {input && !loading && !added && (
            <button onClick={() => { setInput(''); setParsed(null); setError(''); }}
              className="p-1 rounded-md text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-xs text-slate-300 dark:text-white/25 bg-slate-100 dark:bg-white/8 px-2 py-1 rounded-md border border-slate-200 dark:border-white/10" style={{ fontFamily: 'monospace' }}>
            ↵
          </kbd>
        </div>

        {/* Content */}
        <div className="p-3 max-h-[50vh] overflow-y-auto">

          {/* Success state */}
          <AnimatePresence>
            {added && parsed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </motion.div>
                <p className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>
                  Задача добавлена!
                </p>
                <p className="text-xs text-slate-400 dark:text-white/40">«{parsed.title}»</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Examples (empty state) */}
          {!input && !parsed && !added && (
            <div>
              <p className="text-xs text-slate-400 dark:text-white/30 mb-2 px-1" style={{ fontWeight: 500 }}>
                ПРИМЕРЫ — нажми чтобы AI разобрал
              </p>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => handleExampleClick(ex)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm text-slate-600 dark:text-white/55 hover:bg-[#1d4ed8]/5 dark:hover:bg-[#1d4ed8]/8 hover:text-[#1d4ed8] transition-colors group">
                  <Sparkles className="w-3.5 h-3.5 text-slate-300 dark:text-white/20 group-hover:text-[#1d4ed8] transition-colors shrink-0" />
                  <span className="flex-1">{ex}</span>
                  <ChevronRight className="w-3 h-3 text-slate-200 dark:text-white/10 group-hover:text-[#1d4ed8]/40 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          <AnimatePresence>
            {loading && <ParseSkeleton />}
          </AnimatePresence>

          {/* Parse button (when text entered but not yet parsed) */}
          {input && !parsed && !loading && !error && !added && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleParse()}
              className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-[#1d4ed8]/10 to-[#2563eb]/10 border border-[#1d4ed8]/20 text-[#1d4ed8] hover:from-[#1d4ed8]/15 hover:to-[#2563eb]/15 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#1d4ed8]/12 flex items-center justify-center shrink-0 group-hover:bg-[#1d4ed8]/18 transition-colors">
                <Brain className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm" style={{ fontWeight: 600 }}>Разобрать задачу с AI</p>
                <p className="text-xs text-[#1d4ed8]/60 mt-0.5">
                  «{input.length > 50 ? input.slice(0, 50) + '…' : input}»
                </p>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </motion.button>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-600 dark:text-red-400" style={{ fontWeight: 600 }}>{error}</p>
                    {errorCode === 'rate_limited' && (
                      <p className="text-xs text-red-400 dark:text-red-400/60 mt-1">Повторите попытку через 30–60 секунд</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setError(''); handleParse(); }}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 dark:bg-red-500/15 text-red-500 text-xs hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Повторить
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Parsed result */}
          <AnimatePresence>
            {parsed && !added && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {/* Task preview card */}
                <div className="p-4 rounded-xl border border-[#1d4ed8]/20 bg-gradient-to-br from-[#1d4ed8]/5 to-[#2563eb]/3 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-[#1d4ed8]/12 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-[#1d4ed8]" />
                    </div>
                    <span className="text-[10px] text-[#1d4ed8] uppercase tracking-wider" style={{ fontWeight: 700 }}>
                      AI-результат
                    </span>
                    <button onClick={() => { setParsed(null); inputRef.current?.focus(); }}
                      className="ml-auto p-1 rounded-md text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-900 dark:text-white mb-3" style={{ fontWeight: 600 }}>
                    {parsed.title}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: `${PRIORITY_COLORS[parsed.priority]}12`, color: PRIORITY_COLORS[parsed.priority], border: `1px solid ${PRIORITY_COLORS[parsed.priority]}25` }}>
                      <Flag className="w-3 h-3" />
                      {PRIORITY_LABELS[parsed.priority]}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/50 border border-slate-200 dark:border-white/10">
                      <Clock className="w-3 h-3" />
                      {parsed.duration_hours}ч
                    </span>
                    {parsed.end_date && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/50 border border-slate-200 dark:border-white/10">
                        <Calendar className="w-3 h-3" />
                        {parsed.end_date}
                      </span>
                    )}
                    {parsed.tags?.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#2563eb]/8 text-[#2563eb] border border-[#2563eb]/15">
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                    {parsed.phase_name && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        {parsed.phase_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Phase selector */}
                <div className="mb-3">
                  <p className="text-xs text-slate-400 dark:text-white/40 mb-2 px-1" style={{ fontWeight: 500 }}>
                    ДОБАВИТЬ В ФАЗУ
                    {parsed.phase_name && (
                      <span className="text-[#1d4ed8] ml-1">
                        (AI рекомендует: {parsed.phase_name})
                      </span>
                    )}
                  </p>
                  <div className="space-y-1 max-h-[140px] overflow-y-auto">
                    {plan.phases.map(phase => {
                      const isRecommended = parsed.phase_name && (
                        phase.name.toLowerCase().includes(parsed.phase_name.toLowerCase()) ||
                        parsed.phase_name.toLowerCase().includes(phase.name.toLowerCase())
                      );
                      return (
                        <button key={phase.id} onClick={() => { playClick(); setSelectedPhaseId(phase.id); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                            selectedPhaseId === phase.id
                              ? 'bg-[#1d4ed8]/8 border border-[#1d4ed8]/20'
                              : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color }} />
                          <span className={`text-sm flex-1 ${selectedPhaseId === phase.id ? 'text-[#1d4ed8]' : 'text-slate-700 dark:text-white/70'}`}
                            style={{ fontWeight: selectedPhaseId === phase.id ? 600 : 400 }}>
                            {phase.name}
                          </span>
                          {isRecommended && selectedPhaseId !== phase.id && (
                            <span className="text-[10px] text-[#1d4ed8]/60 px-1.5 py-0.5 rounded bg-[#1d4ed8]/5">AI</span>
                          )}
                          {selectedPhaseId === phase.id && (
                            <div className="ml-auto w-5 h-5 rounded-full bg-[#1d4ed8] flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add button */}
                <motion.button
                  onClick={handleAdd}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm hover:opacity-90 transition-all shadow-lg shadow-[#1d4ed8]/25 flex items-center justify-center gap-2"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-4 h-4" />
                  Добавить задачу
                  <kbd className="hidden sm:inline text-xs text-white/50 bg-white/15 px-1.5 py-0.5 rounded ml-1" style={{ fontFamily: 'monospace' }}>↵</kbd>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 dark:text-white/20">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/8 rounded text-[10px] mr-1" style={{ fontFamily: 'monospace' }}>⌘K</kbd>
              закрыть
            </span>
            <span className="text-xs text-slate-300 dark:text-white/20">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/8 rounded text-[10px] mr-1" style={{ fontFamily: 'monospace' }}>↵</kbd>
              {parsed ? 'добавить' : 'разобрать'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-slate-300 dark:text-white/20">AI онлайн</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}