import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

interface Props {
  goal: string;
  deadline: string;
  hoursPerWeek: number;
  onSuggestedDeadline?: (d: string) => void;
  onSuggestedHours?: (h: number) => void;
}

interface Validation {
  realistic: boolean;
  confidence: string;
  verdict: string;
  suggestedDeadline: string | null;
  suggestedHoursPerWeek: number | null;
  risks: string[];
  tips: string[];
}

export function DeadlineValidator({ goal, deadline, hoursPerWeek, onSuggestedDeadline, onSuggestedHours }: Props) {
  const [result, setResult] = useState<Validation | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!goal || goal.length < 10 || !deadline) { setResult(null); return; }
    const key = `${goal}|${deadline}|${hoursPerWeek}`;
    if (key === lastKeyRef.current) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastKeyRef.current = key;
      setLoading(true);
      try {
        const res = await fetch(`${SERVER}/ai/validate-deadline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ goal, deadline, hoursPerWeek }),
        });
        const data = await res.json();
        if (data.realistic !== undefined) setResult(data);
      } catch (err) {
        console.warn('Validate deadline error:', err);
      }
      setLoading(false);
    }, 1500);

    return () => clearTimeout(debounceRef.current);
  }, [goal, deadline, hoursPerWeek]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-400 dark:text-white/40">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-3.5 h-3.5 border-2 border-slate-300 dark:border-white/20 border-t-[#1d4ed8] rounded-full shrink-0" />
        AI оценивает реалистичность сроков...
      </motion.div>
    );
  }

  if (!result) return null;

  const isGood = result.realistic;
  const borderColor = isGood ? 'border-emerald-200 dark:border-emerald-500/20' : 'border-amber-200 dark:border-amber-500/20';
  const bgColor = isGood ? 'bg-emerald-50/60 dark:bg-emerald-500/5' : 'bg-amber-50/60 dark:bg-amber-500/5';
  const textColor = isGood ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400';
  const Icon = isGood ? CheckCircle2 : AlertTriangle;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}
      >
        <button onClick={() => setExpanded(s => !s)}
          className={`w-full flex items-start gap-2.5 p-3 text-left ${textColor}`}>
          <Icon className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{isGood ? 'Сроки реалистичны' : 'Сроки под вопросом'}</p>
            <p className="text-xs opacity-80 mt-0.5">{result.verdict}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-xs opacity-60">
            <span className="px-1.5 py-0.5 rounded bg-white/50 dark:bg-white/10 text-[10px] font-medium">
              {result.confidence === 'high' ? 'Высокая' : result.confidence === 'medium' ? 'Средняя' : 'Низкая'} уверенность
            </span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-2">
                {result.risks.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${textColor} opacity-60`}>Риски</p>
                    <ul className="space-y-0.5">
                      {result.risks.map((r, i) => (
                        <li key={i} className={`text-xs ${textColor} opacity-80 flex items-start gap-1.5`}>
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.tips.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${textColor} opacity-60`}>Советы</p>
                    <ul className="space-y-0.5">
                      {result.tips.map((t, i) => (
                        <li key={i} className={`text-xs ${textColor} opacity-80 flex items-start gap-1.5`}>
                          <Sparkles className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {result.suggestedDeadline && onSuggestedDeadline && (
                    <button
                      onClick={() => onSuggestedDeadline(result.suggestedDeadline!)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1d4ed8]/10 text-[#1d4ed8] border border-[#1d4ed8]/25 hover:bg-[#1d4ed8]/20 transition-all"
                    >
                      <Clock className="w-3 h-3" />
                      Принять дедлайн: {result.suggestedDeadline}
                    </button>
                  )}
                  {result.suggestedHoursPerWeek && onSuggestedHours && (
                    <button
                      onClick={() => onSuggestedHours(result.suggestedHoursPerWeek!)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1d4ed8]/10 text-[#1d4ed8] border border-[#1d4ed8]/25 hover:bg-[#1d4ed8]/20 transition-all"
                    >
                      <Clock className="w-3 h-3" />
                      Принять: {result.suggestedHoursPerWeek}ч/нед
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
