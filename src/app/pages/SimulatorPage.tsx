import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, CheckCircle2, Circle, Sparkles, Target, Trophy,
  Brain, RefreshCw, Clock, AlertCircle, RotateCcw, Send,
  ChevronDown, ChevronUp, ListChecks, CheckSquare, Square,
  LayoutList, X, AlertTriangle, MessageCircle,
  Pencil, Plus, Trash2, Check, GripVertical,
  Calendar, ChevronRight,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useTomi, type PlanAction } from '../components/TomiAssistant';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChecklistItem { id: string; text: string; done: boolean; }
interface AdvisorTask {
  id: string; title: string; description?: string;
  duration?: string;
  priority?: 'high' | 'medium' | 'low';
  done: boolean; deferred?: boolean;
  checklist: ChecklistItem[]; checklistOpen: boolean;
}
interface AdvisorPhase {
  id: string; name: string; color: string;
  tasks: AdvisorTask[]; expanded: boolean;
}
interface GoalWarning { warning: string; suggestedTimeline: string | null; }

type SimState = 'idle' | 'loading' | 'active' | 'complete';
type ViewMode = 'tasks' | 'checklist';

// Edit state shapes
interface TaskEdit  { id: string; phaseId: string; field: 'title' | 'duration' | 'description'; val: string; }
interface PhaseEdit { id: string; val: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

const PIPEDREAM_URL = 'https://eo2t0lm7jxwsy5.m.pipedream.net';
const SERVER_URL    = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;
const PHASE_COLORS  = ['#1d4ed8','#2563eb','#1e40af','#10b981','#f59e0b','#ef4444'];

const PRIORITY_CYCLE: AdvisorTask['priority'][] = ['high', 'medium', 'low'];
const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high:   { label: '↑ Высокий', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  medium: { label: '— Средний', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  low:    { label: '↓ Низкий',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
};

function parseChecklist(raw: unknown[]): ChecklistItem[] {
  return raw.map(item => {
    if (typeof item === 'string') return { id: uid(), text: item, done: false };
    const r = item as Record<string, unknown>;
    return { id: (r.id as string) || uid(), text: (r.text as string) || (r.title as string) || '', done: Boolean(r.done) };
  }).filter(c => c.text.trim());
}

function normaliseToPlan(raw: unknown, fallbackGoal: string): AdvisorPhase[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const inner = (obj.plan && typeof obj.plan === 'object' ? obj.plan : obj) as Record<string, unknown>;
  const phasesSrc =
    Array.isArray(inner.phases) ? inner.phases :
    Array.isArray(inner.steps)  ? inner.steps  :
    Array.isArray(inner.stages) ? inner.stages  : null;

  if (phasesSrc?.length) {
    return (phasesSrc as Record<string, unknown>[]).map((p, pi) => {
      const rawTasks: Record<string, unknown>[] =
        Array.isArray(p.tasks) ? p.tasks as Record<string, unknown>[] :
        Array.isArray(p.steps) ? p.steps as Record<string, unknown>[] : [];
      const tasks: AdvisorTask[] = rawTasks.length > 0
        ? rawTasks.map(t => ({
            id: uid(), title: (t.title as string) || 'Задача',
            description: (t.description as string) || undefined,
            duration: t.duration_hours ? `${t.duration_hours}ч` : (t.duration as string) || undefined,
            priority: (['high','medium','low'].includes(t.priority as string) ? t.priority : 'medium') as AdvisorTask['priority'],
            done: false, deferred: false,
            checklist: Array.isArray(t.checklist) ? parseChecklist(t.checklist) : [],
            checklistOpen: false,
          }))
        : [{ id: uid(), title: (p.name as string) || `Шаг ${pi+1}`, done: false, deferred: false, checklist: [], checklistOpen: false, priority: 'medium' as const }];
      return { id: uid(), name: (p.name as string) || `Этап ${pi+1}`, color: (p.color as string) || PHASE_COLORS[pi % PHASE_COLORS.length], tasks, expanded: pi === 0 };
    });
  }

  if (Array.isArray(raw) || Array.isArray(inner.steps) || Array.isArray(inner.tasks)) {
    const items = (Array.isArray(raw) ? raw : Array.isArray(inner.steps) ? inner.steps : inner.tasks) as Record<string, unknown>[];
    const tasks: AdvisorTask[] = items.map(t => ({
      id: uid(), title: (t.title as string) || 'Задача',
      description: (t.description as string) || undefined,
      duration: t.duration_hours ? `${t.duration_hours}ч` : undefined,
      priority: 'medium' as const, done: false, deferred: false,
      checklist: Array.isArray(t.checklist) ? parseChecklist(t.checklist) : [],
      checklistOpen: false,
    }));
    return [{ id: uid(), name: fallbackGoal, color: PHASE_COLORS[0], tasks, expanded: true }];
  }
  return [];
}

async function fetchPlan(goal: string): Promise<AdvisorPhase[]> {
  try {
    const res = await fetch(PIPEDREAM_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ goal }) });
    const text = await res.text();
    if (res.ok && !text.trim().startsWith('<')) {
      const phases = normaliseToPlan(JSON.parse(text), goal);
      if (phases.length > 0) return phases;
    }
  } catch {}
  const res2 = await fetch(`${SERVER_URL}/generate-plan`, {
    method:'POST',
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${publicAnonKey}`},
    body: JSON.stringify({ goal, deadline: new Date(Date.now()+90*86_400_000).toISOString().slice(0,10), hours_per_week:10 }),
  });
  if (!res2.ok) throw new Error(`Server error ${res2.status}`);
  const phases = normaliseToPlan(await res2.json(), goal);
  if (phases.length === 0) throw new Error('Empty plan');
  return phases;
}

async function checkGoalRealism(goal: string): Promise<GoalWarning | null> {
  try {
    const res = await fetch(`${SERVER_URL}/ai/check-goal`, {
      method:'POST',
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${publicAnonKey}`},
      body: JSON.stringify({ goal }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.realistic && data.warning) return { warning: data.warning, suggestedTimeline: data.suggestedTimeline ?? null };
  } catch {}
  return null;
}

// ── XP pop ─────────────────────────────────────────────────────────────────────
function XpPop({ show, label }: { show: boolean; label: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span key="xp" initial={{ opacity:1, y:0, scale:1 }} animate={{ opacity:0, y:-32, scale:1.15 }}
          transition={{ duration:0.9, ease:'easeOut' }}
          className="absolute right-3 -top-1 text-xs font-bold text-emerald-400 pointer-events-none z-20 select-none">
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ── Inline text field ─────────────────────────────────────────────────────────
function InlineEdit({
  value, onSave, onCancel, placeholder = '', multiline = false,
  className = '', inputClassName = '',
}: {
  value: string; onSave: (v: string) => void; onCancel: () => void;
  placeholder?: string; multiline?: boolean; className?: string; inputClassName?: string;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); onSave(val.trim() || value); }
    if (e.key === 'Escape') onCancel();
  };

  const common = {
    ref, value: val, placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(e.target.value),
    onKeyDown: handleKey,
    onBlur: () => onSave(val.trim() || value),
    className: `bg-[#1d4ed8]/10 border border-[#1d4ed8]/40 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/40 w-full ${inputClassName}`,
    style: { fontSize: 'inherit' },
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {multiline
        ? <textarea {...common} rows={2} style={{ ...common.style, resize:'none' }} />
        : <input {...common} type="text" />
      }
      <div className="flex flex-col gap-1 shrink-0">
        <button onMouseDown={e => { e.preventDefault(); onSave(val.trim() || value); }}
          className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/35 transition-colors touch-manipulation">
          <Check className="w-3 h-3 text-emerald-400" />
        </button>
        <button onMouseDown={e => { e.preventDefault(); onCancel(); }}
          className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors touch-manipulation">
          <X className="w-3 h-3 text-white/40" />
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function SimulatorPage() {
  const navigate  = useNavigate();
  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { setContext, openTomi, setPlanActionHandler } = useTomi();

  const [goal,         setGoal]         = useState('');
  const [simState,     setSimState]     = useState<SimState>('idle');
  const [phases,       setPhases]       = useState<AdvisorPhase[]>([]);
  const [error,        setError]        = useState('');
  const [xp,           setXp]           = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [viewMode,     setViewMode]     = useState<ViewMode>('tasks');
  const [warning,      setWarning]      = useState<GoalWarning | null>(null);
  const [actionBanner, setActionBanner] = useState<{ text:string; type:string } | null>(null);
  const [popTask,      setPopTask]      = useState<string | null>(null);
  const [popCheck,     setPopCheck]     = useState<string | null>(null);
  const [timeline,     setTimeline]     = useState('3 месяца');

  // Edit state
  const [editTask,     setEditTask]     = useState<TaskEdit | null>(null);
  const [editPhase,    setEditPhase]    = useState<PhaseEdit | null>(null);
  const [editGoal,     setEditGoal]     = useState(false);
  const [editGoalVal,  setEditGoalVal]  = useState('');
  const [editTimeline, setEditTimeline] = useState(false);
  const [editTimeVal,  setEditTimeVal]  = useState('');

  // ── Derived ──────────────────────────────────────────────────────────────────
  const allTasks     = phases.flatMap(p => p.tasks);
  const visibleTasks = allTasks.filter(t => !t.deferred);
  const totalTasks   = visibleTasks.length;
  const doneTasks    = visibleTasks.filter(t => t.done).length;
  const allItems     = allTasks.flatMap(t => t.checklist);
  const totalItems   = allItems.length;
  const doneItems    = allItems.filter(c => c.done).length;
  const taskProgress  = totalTasks > 0 ? Math.round((doneTasks / totalTasks)  * 100) : 0;
  const checkProgress = totalItems > 0 ? Math.round((doneItems  / totalItems) * 100) : 0;
  const isComplete    = totalTasks > 0 && doneTasks === totalTasks;

  // ── Tomi context ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (goal && simState === 'active') {
      setContext(`Цель: ${goal}\nСрок: ${timeline}\nПрогресс: ${doneTasks}/${totalTasks} задач (${taskProgress}%), ${doneItems}/${totalItems} пунктов (${checkProgress}%)\nXP: ${xp}`);
    } else if (simState === 'idle') { setContext(''); }
  }, [goal, timeline, simState, doneTasks, totalTasks, doneItems, totalItems, taskProgress, checkProgress, xp, setContext]);

  // ── Plan action handler ───────────────────────────────────────────────────────
  const handlePlanAction = useCallback((action: PlanAction) => {
    setPhases(prev => {
      const updated = prev.map(ph => ({ ...ph, tasks: [...ph.tasks] }));
      if (action.type === 'reduce_load') {
        let n = 0;
        for (const ph of updated)
          ph.tasks = ph.tasks.map(t => (!t.done && t.priority === 'low' && !t.deferred && n < 3) ? (n++, { ...t, deferred: true }) : t);
        setActionBanner({ text: `Отложено ${n} задач с низким приоритетом`, type: 'reduce' });
      } else if (action.type === 'focus_top3') {
        let n = 0;
        for (const ph of updated) for (const t of ph.tasks) if (!t.done && t.priority === 'high' && n < 3) n++;
        setActionBanner({ text: `Томи выделил ${n} ключевых задачи для фокуса`, type: 'focus' });
      } else if (action.type === 'reschedule') {
        for (const ph of updated) ph.expanded = true;
        setActionBanner({ text: 'План раскрыт — выбери задачи для переноса', type: 'reschedule' });
      }
      return updated;
    });
  }, []);

  useEffect(() => { setPlanActionHandler(handlePlanAction); return () => setPlanActionHandler(null); }, [handlePlanAction, setPlanActionHandler]);
  useEffect(() => { if (isComplete && simState === 'active') setSimState('complete'); }, [isComplete, simState]);
  useEffect(() => { if (simState === 'active') setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth', block:'end' }), 250); }, [simState]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!goal.trim()) { inputRef.current?.focus(); return; }
    setError(''); setWarning(null); setActionBanner(null); setSimState('loading');
    try {
      const [result, goalCheck] = await Promise.all([fetchPlan(goal.trim()), checkGoalRealism(goal.trim())]);
      setPhases(result); setXp(0); setStreak(0); setTimeline('3 месяца');
      setSimState('active');
      if (goalCheck) setWarning(goalCheck);
    } catch (err) {
      console.error('[Simulator]', err);
      setError('Не удалось получить план. Попробуйте ещё раз.');
      setSimState('idle');
    }
  };
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); };
  const reset = () => {
    setGoal(''); setPhases([]); setXp(0); setStreak(0);
    setError(''); setWarning(null); setActionBanner(null);
    setEditTask(null); setEditPhase(null); setEditGoal(false);
    setSimState('idle');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Phase/task toggles ───────────────────────────────────────────────────────
  const togglePhase = (id: string) =>
    setPhases(p => p.map(ph => ph.id === id ? { ...ph, expanded: !ph.expanded } : ph));

  const openChecklist = (phaseId: string, taskId: string) =>
    setPhases(p => p.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.map(t => t.id !== taskId ? t : { ...t, checklistOpen: !t.checklistOpen }),
    }));

  const toggleTask = (phaseId: string, taskId: string) => {
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.map(t => {
        if (t.id !== taskId) return t;
        const nowDone = !t.done;
        if (nowDone) { setXp(x => x+10); setStreak(s => s+1); setPopTask(taskId); setTimeout(() => setPopTask(null), 1100); }
        else { setXp(x => Math.max(0, x-10)); setStreak(0); }
        return { ...t, done: nowDone, checklist: t.checklist.map(c => ({ ...c, done: nowDone })) };
      }),
    }));
  };

  const toggleCheckItem = (phaseId: string, taskId: string, itemId: string) => {
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.map(t => {
        if (t.id !== taskId) return t;
        const newCl = t.checklist.map(c => {
          if (c.id !== itemId) return c;
          const nowDone = !c.done;
          if (nowDone) { setXp(x => x+5); setStreak(s => s+1); setPopCheck(itemId); setTimeout(() => setPopCheck(null), 1100); }
          else { setXp(x => Math.max(0, x-5)); setStreak(0); }
          return { ...c, done: nowDone };
        });
        const allDone = newCl.length > 0 && newCl.every(c => c.done);
        if (allDone && !t.done) { setXp(x => x+10); setPopTask(taskId); setTimeout(() => setPopTask(null), 1100); }
        return { ...t, checklist: newCl, done: allDone ? true : t.done };
      }),
    }));
  };

  // ── Edit helpers ──────────────────────────────────────────────────────────────
  const saveTaskEdit = (val: string) => {
    if (!editTask) return;
    const { id, phaseId, field } = editTask;
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.map(t => t.id !== id ? t : {
        ...t,
        ...(field === 'title' ? { title: val || t.title } : {}),
        ...(field === 'duration' ? { duration: val || undefined } : {}),
        ...(field === 'description' ? { description: val || undefined } : {}),
      }),
    }));
    setEditTask(null);
  };

  const savePhaseEdit = (val: string) => {
    if (!editPhase) return;
    setPhases(prev => prev.map(ph => ph.id !== editPhase.id ? ph : { ...ph, name: val || ph.name }));
    setEditPhase(null);
  };

  const cyclePriority = (phaseId: string, taskId: string) =>
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.map(t => {
        if (t.id !== taskId) return t;
        const idx = PRIORITY_CYCLE.indexOf(t.priority ?? 'medium');
        return { ...t, priority: PRIORITY_CYCLE[(idx + 1) % 3] };
      }),
    }));

  const addTask = (phaseId: string) => {
    const newTask: AdvisorTask = {
      id: uid(), title: 'Новая задача', done: false, deferred: false,
      checklist: [], checklistOpen: false, priority: 'medium',
    };
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: [...ph.tasks, newTask], expanded: true,
    }));
    setTimeout(() => setEditTask({ id: newTask.id, phaseId, field: 'title', val: '' }), 60);
  };

  const deleteTask = (phaseId: string, taskId: string) => {
    if (editTask?.id === taskId) setEditTask(null);
    setPhases(prev => prev.map(ph => ph.id !== phaseId ? ph : {
      ...ph, tasks: ph.tasks.filter(t => t.id !== taskId),
    }));
  };

  const addPhase = () => {
    const newPhase: AdvisorPhase = {
      id: uid(), name: 'Новый этап', color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
      tasks: [], expanded: true,
    };
    setPhases(prev => [...prev, newPhase]);
    setTimeout(() => setEditPhase({ id: newPhase.id, val: '' }), 60);
  };

  const deletePhase = (phaseId: string) => {
    if (editPhase?.id === phaseId) setEditPhase(null);
    setPhases(prev => prev.filter(ph => ph.id !== phaseId));
  };

  // ── Checklist view data ───────────────────────────────────────────────────────
  const allCheckItems = phases.flatMap(ph =>
    ph.tasks.flatMap(t =>
      t.checklist.map(c => ({ ...c, taskTitle: t.title, phaseId: ph.id, taskId: t.id, phaseName: ph.name, phaseColor: ph.color }))
    )
  );

  // ─────────────────────────────── RENDER ──────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Inter', sans-serif" }} className="min-h-screen bg-[#060d1e] text-white flex flex-col">

      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/8 bg-[#060d1e]/95 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontFamily:"'Syne', sans-serif", fontWeight:700 }} className="text-white text-sm">Vecto</span>
            <span className="text-white/25 text-xs ml-1 hidden sm:flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Симулятор</span>
          </button>
          <div className="flex items-center gap-2">
            {(simState === 'active' || simState === 'complete') && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 text-sm font-semibold text-[#93bbfd]">
                  <Sparkles className="w-3.5 h-3.5" /> {xp} XP
                </div>
                {streak >= 3 && (
                  <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-xs font-semibold text-amber-300">
                    🔥 {streak}
                  </div>
                )}
                <button onClick={reset} className="text-white/40 hover:text-white/80 transition-colors touch-manipulation">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 pb-28">

        {/* ── IDLE / LOADING ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {(simState === 'idle' || simState === 'loading') && (
            <motion.div key="hero" initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
              className="flex flex-col items-center text-center pt-8 pb-12">
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center shadow-xl shadow-[#1d4ed8]/30">
                  <Brain className="w-9 h-9 text-white" />
                </div>
                <motion.div animate={{ scale:[1,1.2,1], opacity:[0.25,0.08,0.25] }} transition={{ duration:2.5, repeat:Infinity }}
                  className="absolute -inset-4 rounded-3xl border border-[#1d4ed8]/30" />
              </div>
              <h1 style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:'clamp(1.6rem,5vw,2.4rem)', lineHeight:1.15 }} className="text-white mb-3">
                AI-советник
              </h1>
              <p className="text-white/45 text-sm max-w-sm mb-10 leading-relaxed">
                Введите цель — AI создаст план <strong className="text-white/70">с задачами и чек-листами</strong>. Редактируйте сроки, задачи и этапы прямо в плане.
              </p>

              <div className="w-full max-w-xl">
                <div className="relative">
                  <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1d4ed8]" />
                  <input ref={inputRef} type="text" value={goal}
                    onChange={e => { setGoal(e.target.value); setError(''); }}
                    onKeyDown={handleKey}
                    placeholder="Например: Запустить MVP за 2 месяца..."
                    disabled={simState === 'loading'} autoFocus
                    className="w-full pl-12 pr-14 py-4 bg-white/5 border border-white/12 rounded-2xl text-white placeholder-white/25 focus:outline-none focus:border-[#1d4ed8]/60 focus:ring-2 focus:ring-[#1d4ed8]/15 transition-all text-sm disabled:opacity-50"
                    style={{ fontSize:16 }}
                  />
                  <button onClick={handleSubmit} disabled={simState==='loading' || !goal.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-[#1d4ed8]/30 touch-manipulation">
                    {simState==='loading'
                      ? <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      : <Send className="w-4 h-4 text-white" />}
                  </button>
                </div>

                {error && (
                  <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} className="flex items-center gap-2 mt-3 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                  </motion.div>
                )}

                {simState === 'idle' && (
                  <div className="flex flex-wrap justify-center gap-2 mt-5">
                    {['Выучить Python за 3 месяца','Запустить YouTube-канал','Найти работу разработчика','Похудеть на 8 кг'].map(ex => (
                      <button key={ex} onClick={() => setGoal(ex)}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/45 hover:text-white/80 hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/10 transition-all touch-manipulation">
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {simState === 'loading' && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="mt-10 flex flex-col items-center gap-4">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <motion.div key={i} animate={{ y:[0,-8,0], opacity:[0.4,1,0.4] }}
                        transition={{ duration:0.9, repeat:Infinity, delay:i*0.18 }}
                        className="w-2 h-2 rounded-full bg-[#1d4ed8]" />
                    ))}
                  </div>
                  <p className="text-white/35 text-xs">AI генерирует план и проверяет реалистичность...</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ACTIVE / COMPLETE ──────────────────────────────────────────── */}
        <AnimatePresence>
          {(simState === 'active' || simState === 'complete') && (
            <motion.div key="active" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="space-y-4">

              {/* Goal card */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1d4ed8]/20 to-[#1e40af]/8 border border-[#1d4ed8]/25 p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-[#93bbfd] shrink-0" />
                      <span className="text-[#93bbfd] text-xs font-medium uppercase tracking-wide">Ваша цель</span>
                    </div>

                    {/* Editable goal */}
                    {editGoal
                      ? <InlineEdit value={editGoalVal} placeholder="Введите цель..."
                          onSave={v => { if (v) setGoal(v); setEditGoal(false); }}
                          onCancel={() => setEditGoal(false)}
                          inputClassName="text-base font-semibold"
                        />
                      : <div className="flex items-start gap-2 group">
                          <h2 style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1.05rem' }}
                            className="text-white leading-snug flex-1 cursor-pointer hover:text-white/80 transition-colors"
                            onClick={() => { setEditGoalVal(goal); setEditGoal(true); }}>
                            {goal}
                          </h2>
                          <button onClick={() => { setEditGoalVal(goal); setEditGoal(true); }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#1d4ed8]/20 transition-all touch-manipulation sm:flex hidden">
                            <Pencil className="w-3 h-3 text-white/50" />
                          </button>
                          <button onClick={() => { setEditGoalVal(goal); setEditGoal(true); }}
                            className="shrink-0 w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#1d4ed8]/20 transition-all touch-manipulation sm:hidden">
                            <Pencil className="w-3 h-3 text-white/50" />
                          </button>
                        </div>
                    }

                    {/* Editable timeline */}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      {editTimeline
                        ? <InlineEdit value={editTimeVal} placeholder="Напр.: 2 месяца"
                            onSave={v => { if (v) setTimeline(v); setEditTimeline(false); }}
                            onCancel={() => setEditTimeline(false)}
                            inputClassName="text-xs py-0.5 px-2"
                            className="flex-1 min-w-0"
                          />
                        : <button
                            onClick={() => { setEditTimeVal(timeline); setEditTimeline(true); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/10 transition-all group touch-manipulation">
                            <span className="text-white/55 text-xs">{timeline}</span>
                            <Pencil className="w-2.5 h-2.5 text-white/25 group-hover:text-white/60 transition-colors" />
                          </button>
                      }
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openTomi()} title="Спросить Томи"
                      className="w-8 h-8 rounded-xl bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 flex items-center justify-center hover:bg-[#1d4ed8]/35 transition-colors touch-manipulation">
                      <MessageCircle className="w-3.5 h-3.5 text-[#93bbfd]" />
                    </button>
                    <button onClick={reset}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors touch-manipulation">
                      <RefreshCw className="w-3.5 h-3.5 text-white/50" />
                    </button>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5 text-white/45"><LayoutList className="w-3 h-3" /> Задачи</span>
                      <span className="text-white/60 font-medium">{doneTasks}/{totalTasks} · {taskProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#2563eb]" animate={{ width:`${taskProgress}%` }} transition={{ duration:0.5 }} />
                    </div>
                  </div>
                  {totalItems > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-1.5 text-white/45"><ListChecks className="w-3 h-3" /> Чек-лист</span>
                        <span className="text-white/60 font-medium">{doneItems}/{totalItems} · {checkProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#10b981]" animate={{ width:`${checkProgress}%` }} transition={{ duration:0.5 }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Goal realism warning */}
              <AnimatePresence>
                {warning && (
                  <motion.div initial={{ opacity:0, y:-8, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8 }}
                    className="relative rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4">
                    <button onClick={() => setWarning(null)} className="absolute top-3 right-3 w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors touch-manipulation">
                      <X className="w-3.5 h-3.5 text-white/40" />
                    </button>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-amber-300 text-xs font-semibold mb-1">Томи замечает:</p>
                        <p className="text-white/70 text-sm leading-relaxed">{warning.warning}</p>
                        {warning.suggestedTimeline && (
                          <p className="text-amber-400/80 text-xs mt-2 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Реалистичный срок: <strong>{warning.suggestedTimeline}</strong>
                          </p>
                        )}
                        <button onClick={() => { setWarning(null); openTomi(); }}
                          className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition-colors touch-manipulation">
                          Обсудить с Томи →
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action banner */}
              <AnimatePresence>
                {actionBanner && (
                  <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                    className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-emerald-300 text-sm flex-1">✅ {actionBanner.text}</p>
                    <button onClick={() => setActionBanner(null)} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors touch-manipulation">
                      <X className="w-3.5 h-3.5 text-white/40" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Completion banner */}
              <AnimatePresence>
                {simState === 'complete' && (
                  <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
                    className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/25 p-6 text-center">
                    <motion.div animate={{ rotate:[0,10,-10,10,0], scale:[1,1.2,1] }} transition={{ duration:0.7 }} className="text-5xl mb-3">🏆</motion.div>
                    <h3 style={{ fontFamily:"'Syne', sans-serif", fontWeight:700 }} className="text-white text-lg mb-1">Цель достигнута!</h3>
                    <p className="text-white/45 text-sm mb-4">Все задачи выполнены · {xp} XP заработано</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button onClick={reset} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 border border-white/12 hover:bg-white/12 transition-colors text-sm text-white/80 touch-manipulation">
                        <RotateCcw className="w-4 h-4" /> Новая цель
                      </button>
                      <button onClick={() => navigate('/new')} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#1d4ed8]/25 touch-manipulation">
                        <Zap className="w-4 h-4" /> Создать полный план
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* View toggle */}
              {totalItems > 0 && (
                <div className="flex rounded-xl bg-white/5 border border-white/8 p-1 gap-1">
                  {([
                    { id:'tasks',     icon:LayoutList, label:'Задачи' },
                    { id:'checklist', icon:ListChecks, label:'Чек-листы' },
                  ] as { id:ViewMode; icon:typeof LayoutList; label:string }[]).map(({ id, icon:Icon, label }) => (
                    <button key={id} onClick={() => setViewMode(id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                        viewMode === id ? 'bg-[#1d4ed8] text-white shadow-lg shadow-[#1d4ed8]/25' : 'text-white/45 hover:text-white/70'
                      }`}>
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
              )}

              {/* ═══════════════════ TASKS VIEW ═══════════════════ */}
              {viewMode === 'tasks' && (
                <div className="space-y-3">
                  {phases.map((phase, pi) => {
                    const phaseDone  = phase.tasks.filter(t => t.done && !t.deferred).length;
                    const phaseTotal = phase.tasks.filter(t => !t.deferred).length;
                    return (
                      <motion.div key={phase.id} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:pi*0.06 }}
                        className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">

                        {/* Phase header */}
                        <div className="flex items-center gap-0">
                          <button onClick={() => togglePhase(phase.id)}
                            className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-white/4 transition-colors text-left touch-manipulation min-w-0">
                            <div className="w-1 h-8 rounded-full shrink-0" style={{ background:phase.color }} />
                            <div className="flex-1 min-w-0">
                              {editPhase?.id === phase.id
                                ? <InlineEdit value={editPhase.val || phase.name} placeholder="Название этапа"
                                    onSave={savePhaseEdit} onCancel={() => setEditPhase(null)}
                                    inputClassName="text-sm font-semibold"
                                  />
                                : <div className="flex items-center gap-1.5 group/ph">
                                    <span style={{ fontWeight:600, fontSize:'0.9rem' }}
                                      className={`truncate ${phaseDone === phaseTotal && phaseTotal > 0 ? 'line-through text-white/35' : 'text-white'}`}>
                                      {phase.name}
                                    </span>
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditPhase({ id:phase.id, val:phase.name }); }}
                                      className="shrink-0 opacity-0 group-hover/ph:opacity-100 sm:flex hidden w-5 h-5 rounded-md hover:bg-white/10 items-center justify-center transition-all touch-manipulation">
                                      <Pencil className="w-2.5 h-2.5 text-white/40" />
                                    </button>
                                  </div>
                              }
                              <span className="text-white/35 text-xs">{phaseDone}/{phaseTotal} задач</span>
                            </div>
                          </button>

                          {/* Phase actions */}
                          <div className="flex items-center gap-1 pr-3 shrink-0">
                            <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden hidden sm:block">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width:`${phaseTotal>0?(phaseDone/phaseTotal)*100:0}%`, background:phase.color }} />
                            </div>
                            <button onClick={e => { e.stopPropagation(); addTask(phase.id); }}
                              title="Добавить задачу"
                              className="w-7 h-7 rounded-lg hover:bg-[#1d4ed8]/20 border border-transparent hover:border-[#1d4ed8]/30 flex items-center justify-center transition-all touch-manipulation ml-1">
                              <Plus className="w-3.5 h-3.5 text-white/40 hover:text-[#93bbfd]" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deletePhase(phase.id); }}
                              title="Удалить этап"
                              className="w-7 h-7 rounded-lg hover:bg-red-500/15 border border-transparent hover:border-red-500/25 flex items-center justify-center transition-all touch-manipulation">
                              <Trash2 className="w-3.5 h-3.5 text-white/25 hover:text-red-400" />
                            </button>
                            <button onClick={() => togglePhase(phase.id)} className="w-7 h-7 flex items-center justify-center">
                              {phase.expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                            </button>
                          </div>
                        </div>

                        {/* Tasks */}
                        <AnimatePresence>
                          {phase.expanded && (
                            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.22 }} className="overflow-hidden">
                              <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/6">
                                {phase.tasks.length === 0 && (
                                  <p className="text-center text-white/20 text-xs py-4">Нет задач — добавьте первую ↑</p>
                                )}

                                {phase.tasks.map((task, ti) => {
                                  if (task.deferred) return (
                                    <div key={task.id} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/5 bg-white/2 opacity-40">
                                      <span className="text-white/30 text-xs line-through flex-1">{task.title}</span>
                                      <button onClick={() => setPhases(prev => prev.map(ph => ph.id!==phase.id?ph:{...ph,tasks:ph.tasks.map(t=>t.id!==task.id?t:{...t,deferred:false})}))}
                                        className="text-[10px] text-white/30 hover:text-white/60 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors touch-manipulation">
                                        восстановить
                                      </button>
                                    </div>
                                  );

                                  const pmeta = task.priority ? PRIORITY_META[task.priority] : null;
                                  const clDone  = task.checklist.filter(c => c.done).length;
                                  const clTotal = task.checklist.length;
                                  const clPct   = clTotal > 0 ? Math.round((clDone/clTotal)*100) : 0;
                                  const isPopping = popTask === task.id;

                                  return (
                                    <motion.div key={task.id} layout initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:ti*0.04 }}
                                      className={`relative rounded-xl border overflow-hidden transition-all group/task ${task.done ? 'border-emerald-500/15 bg-emerald-500/5 opacity-60' : 'border-white/8 bg-white/4'}`}>
                                      <XpPop show={isPopping} label="+10 XP" />

                                      {/* Task row */}
                                      <div className="flex items-start gap-3 px-4 py-3.5 pr-3">
                                        {/* Drag handle (visual only) */}
                                        <GripVertical className="w-3.5 h-3.5 text-white/10 shrink-0 mt-1 hidden sm:block cursor-grab" />

                                        {/* Done toggle */}
                                        <button onClick={() => toggleTask(phase.id, task.id)} className="mt-0.5 shrink-0 touch-manipulation">
                                          <AnimatePresence mode="wait">
                                            {task.done
                                              ? <motion.div key="d" initial={{ scale:0 }} animate={{ scale:1 }}><CheckCircle2 className="w-5 h-5 text-emerald-400" /></motion.div>
                                              : <motion.div key="u" initial={{ scale:0 }} animate={{ scale:1 }}><Circle className="w-5 h-5 text-white/20 hover:text-[#1d4ed8]/70 transition-colors" /></motion.div>
                                            }
                                          </AnimatePresence>
                                        </button>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                          {/* Title */}
                                          {editTask?.id === task.id && editTask.field === 'title'
                                            ? <InlineEdit value={editTask.val || task.title} placeholder="Название задачи"
                                                onSave={saveTaskEdit} onCancel={() => setEditTask(null)}
                                                inputClassName="text-sm font-medium"
                                              />
                                            : <p style={{ fontWeight:500, fontSize:'0.875rem' }}
                                                className={`leading-snug cursor-pointer hover:text-white/70 transition-colors ${task.done ? 'line-through text-white/30' : 'text-white/90'}`}
                                                onClick={() => !task.done && setEditTask({ id:task.id, phaseId:phase.id, field:'title', val:task.title })}>
                                                {task.title}
                                              </p>
                                          }

                                          {/* Description */}
                                          {editTask?.id === task.id && editTask.field === 'description'
                                            ? <InlineEdit value={editTask.val || task.description || ''} placeholder="Описание..."
                                                multiline onSave={saveTaskEdit} onCancel={() => setEditTask(null)}
                                                inputClassName="text-xs" className="mt-1.5"
                                              />
                                            : task.description && !task.done && (
                                                <p className="text-white/35 text-xs mt-1 leading-relaxed cursor-pointer hover:text-white/55 transition-colors"
                                                  onClick={() => setEditTask({ id:task.id, phaseId:phase.id, field:'description', val:task.description||'' })}>
                                                  {task.description}
                                                </p>
                                              )
                                          }

                                          {/* Meta row */}
                                          <div className="flex flex-wrap items-center gap-2 mt-2">
                                            {/* Duration — editable */}
                                            {editTask?.id === task.id && editTask.field === 'duration'
                                              ? <InlineEdit value={editTask.val || task.duration || ''} placeholder="напр. 2ч"
                                                  onSave={saveTaskEdit} onCancel={() => setEditTask(null)}
                                                  inputClassName="text-xs py-0.5 px-2 w-24"
                                                />
                                              : task.duration
                                                ? <button onClick={() => setEditTask({ id:task.id, phaseId:phase.id, field:'duration', val:task.duration||'' })}
                                                    className="flex items-center gap-1 text-white/30 text-xs hover:text-white/60 hover:bg-white/5 px-1.5 py-0.5 rounded-md transition-all touch-manipulation group/dur">
                                                    <Clock className="w-3 h-3" />{task.duration}
                                                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/dur:opacity-100 transition-opacity" />
                                                  </button>
                                                : <button onClick={() => setEditTask({ id:task.id, phaseId:phase.id, field:'duration', val:'' })}
                                                    className="flex items-center gap-1 text-white/15 text-xs hover:text-white/40 px-1.5 py-0.5 rounded-md hover:bg-white/5 transition-all touch-manipulation">
                                                    <Plus className="w-3 h-3" /> срок
                                                  </button>
                                            }

                                            {/* Priority — clickable to cycle */}
                                            {pmeta && !task.done && (
                                              <button onClick={() => cyclePriority(phase.id, task.id)}
                                                title="Нажмите чтобы сменить приоритет"
                                                className={`text-xs px-1.5 py-0.5 rounded-md border cursor-pointer hover:opacity-80 transition-opacity touch-manipulation ${pmeta.cls}`}>
                                                {pmeta.label}
                                              </button>
                                            )}

                                            {/* Checklist toggle */}
                                            {clTotal > 0 && (
                                              <button onClick={() => openChecklist(phase.id, task.id)}
                                                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-all touch-manipulation ${
                                                  clDone===clTotal&&clTotal>0
                                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                    : 'text-[#93bbfd] bg-[#1d4ed8]/10 border-[#1d4ed8]/20 hover:bg-[#1d4ed8]/20'
                                                }`}>
                                                <ListChecks className="w-3 h-3" /> {clDone}/{clTotal}
                                                {task.checklistOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Task actions */}
                                        <div className="flex flex-col gap-1 shrink-0 items-center opacity-0 group-hover/task:opacity-100 sm:flex hidden transition-opacity">
                                          <button onClick={() => setEditTask({ id:task.id, phaseId:phase.id, field:'title', val:task.title })}
                                            className="w-6 h-6 rounded-md hover:bg-[#1d4ed8]/20 flex items-center justify-center transition-colors touch-manipulation">
                                            <Pencil className="w-3 h-3 text-white/30 hover:text-[#93bbfd]" />
                                          </button>
                                          <button onClick={() => deleteTask(phase.id, task.id)}
                                            className="w-6 h-6 rounded-md hover:bg-red-500/15 flex items-center justify-center transition-colors touch-manipulation">
                                            <Trash2 className="w-3 h-3 text-white/20 hover:text-red-400" />
                                          </button>
                                        </div>
                                        {/* Mobile: always visible delete */}
                                        <button onClick={() => deleteTask(phase.id, task.id)}
                                          className="shrink-0 w-7 h-7 rounded-md hover:bg-red-500/15 flex items-center justify-center transition-colors touch-manipulation sm:hidden">
                                          <Trash2 className="w-3.5 h-3.5 text-white/20 hover:text-red-400" />
                                        </button>
                                      </div>

                                      {/* Checklist mini-bar */}
                                      {clTotal > 0 && !task.done && (
                                        <div className="mx-4 mb-2">
                                          <div className="w-full h-0.5 rounded-full bg-white/8 overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#10b981] transition-all duration-500" style={{ width:`${clPct}%` }} />
                                          </div>
                                        </div>
                                      )}

                                      {/* Inline checklist */}
                                      <AnimatePresence>
                                        {task.checklistOpen && clTotal > 0 && (
                                          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }} className="overflow-hidden">
                                            <div className="border-t border-white/6 px-4 py-3 space-y-1.5 bg-white/2">
                                              <p className="text-xs text-white/28 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <ListChecks className="w-3 h-3" /> Чек-лист
                                              </p>
                                              {task.checklist.map(item => {
                                                const itemPopping = popCheck === item.id;
                                                return (
                                                  <div key={item.id} className="relative">
                                                    <XpPop show={itemPopping} label="+5 XP" />
                                                    <button onClick={() => toggleCheckItem(phase.id, task.id, item.id)}
                                                      className="w-full flex items-start gap-2.5 text-left py-1.5 px-2 rounded-lg hover:bg-white/5 group touch-manipulation">
                                                      <AnimatePresence mode="wait">
                                                        {item.done
                                                          ? <motion.div key="cd" initial={{ scale:0 }} animate={{ scale:1 }} className="shrink-0 mt-0.5"><CheckSquare className="w-4 h-4 text-emerald-400" /></motion.div>
                                                          : <motion.div key="cu" initial={{ scale:0 }} animate={{ scale:1 }} className="shrink-0 mt-0.5"><Square className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" /></motion.div>
                                                        }
                                                      </AnimatePresence>
                                                      <span className={`text-xs leading-relaxed ${item.done ? 'line-through text-white/25' : 'text-white/65'}`}>{item.text}</span>
                                                    </button>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  );
                                })}

                                {/* Add task button */}
                                <button onClick={() => addTask(phase.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/5 transition-all text-sm touch-manipulation">
                                  <Plus className="w-4 h-4" /> Добавить задачу
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}

                  {/* Add phase */}
                  <button onClick={addPhase}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/5 transition-all text-sm touch-manipulation">
                    <Plus className="w-4 h-4" /> Добавить этап
                  </button>
                </div>
              )}

              {/* ═══════════════════ CHECKLIST VIEW ═══════════════════ */}
              {viewMode === 'checklist' && (
                <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="space-y-2">
                  {allCheckItems.length === 0
                    ? <div className="text-center py-16 text-white/30 text-sm">Чек-листы не сгенерированы</div>
                    : allCheckItems.map((item, idx) => {
                        const itemPopping = popCheck === item.id;
                        return (
                          <motion.div key={item.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:idx*0.02 }} className="relative">
                            <XpPop show={itemPopping} label="+5 XP" />
                            <button onClick={() => toggleCheckItem(item.phaseId, item.taskId, item.id)}
                              className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all text-left group touch-manipulation ${
                                item.done ? 'bg-emerald-500/5 border-emerald-500/15 opacity-60' : 'bg-white/4 border-white/8 hover:border-[#1d4ed8]/35 hover:bg-[#1d4ed8]/5'
                              }`}>
                              <div className="shrink-0 mt-0.5">
                                <AnimatePresence mode="wait">
                                  {item.done
                                    ? <motion.div key="d" initial={{ scale:0 }} animate={{ scale:1 }}><CheckSquare className="w-5 h-5 text-emerald-400" /></motion.div>
                                    : <motion.div key="u" initial={{ scale:0 }} animate={{ scale:1 }}><Square className="w-5 h-5 text-white/20 group-hover:text-[#1d4ed8]/70 transition-colors" /></motion.div>
                                  }
                                </AnimatePresence>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize:'0.875rem', fontWeight:500 }}
                                  className={`leading-snug ${item.done ? 'line-through text-white/25' : 'text-white/90'}`}>
                                  {item.text}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:item.phaseColor }} />
                                  <span className="text-white/30 text-xs truncate">{item.phaseName} · {item.taskTitle}</span>
                                </div>
                              </div>
                            </button>
                          </motion.div>
                        );
                      })
                  }
                </motion.div>
              )}

              {/* Stats strip */}
              {simState === 'active' && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }} className="grid grid-cols-4 gap-2">
                  {[
                    { icon:Trophy,       label:'XP',       value:xp,           unit:'' },
                    { icon:CheckCircle2, label:'Задач',    value:doneTasks,    unit:`/${totalTasks}` },
                    { icon:ListChecks,   label:'Пунктов',  value:doneItems,    unit:`/${totalItems}` },
                    { icon:Sparkles,     label:'Прогресс', value:taskProgress, unit:'%' },
                  ].map(({ icon:Icon, label, value, unit }) => (
                    <div key={label} className="rounded-2xl bg-white/3 border border-white/8 px-3 py-3 text-center">
                      <Icon className="w-4 h-4 text-[#93bbfd] mx-auto mb-1.5" />
                      <div className="text-white font-bold text-base leading-none">{value}{unit}</div>
                      <div className="text-white/30 text-xs mt-1">{label}</div>
                    </div>
                  ))}
                </motion.div>
              )}

              <div ref={bottomRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
