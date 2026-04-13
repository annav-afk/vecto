import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, ArrowLeft, BarChart2, Columns3, Calendar, Download,
  Plus, Clock, Target, ChevronDown, ChevronUp, Flag, Pencil,
  Search, X, AlertTriangle, TrendingUp, Filter, Keyboard,
  Sparkles, RotateCcw, RotateCw, Brain, FileText, AlertOctagon, Command,
  List, ArrowRightLeft, GitBranch,
} from 'lucide-react';
import { Plan, Task, TaskStatus, Priority, Phase, Milestone } from '../lib/types';
import { getPlanById, savePlan, updateTask } from '../lib/storage';
import { TimelineView } from '../components/TimelineView';
import { KanbanView } from '../components/KanbanView';
import { CalendarView } from '../components/CalendarView';
import { PlanListView } from '../components/PlanListView';
import { TaskEditModal } from '../components/TaskEditModal';
import { ExportModal } from '../components/ExportModal';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { OnboardingTour } from '../components/OnboardingTour';
import { SkeletonPlan } from '../components/SkeletonPlan';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { AIExpandModal } from '../components/AIExpandModal';
import { FocusMode } from '../components/FocusMode';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { WeeklyDigest } from '../components/WeeklyDigest';
import { BulkActionBar } from '../components/BulkActionBar';
import { PanicModeModal } from '../components/PanicModeModal';
import { PhaseRetroModal } from '../components/PhaseRetroModal';
import { CommandPalette } from '../components/CommandPalette';
import { useUndoRedo } from '../lib/useUndoRedo';
import { recordActivity } from '../lib/activity';
import { markChecklistStep } from '../components/OnboardingChecklist';
import { computeStreakUpdate } from '../lib/risk';
import { recordTaskEvent } from '../lib/patternTracker';
import { TomiPreventiveCoach, RiskIndicator, shouldShowPreventiveCoach } from '../components/TomiPreventiveCoach';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { saveCloudPlan } from '../lib/api';
import { useTomi, type PlanAction } from '../components/TomiAssistant';
import { PlanFeedback } from '../components/PlanFeedback';
import { PlanStructureEditor } from '../components/PlanStructureEditor';
import { MilestoneTracker } from '../components/MilestoneTracker';
import { DependencyGraph } from '../components/DependencyGraph';

type View = 'list' | 'timeline' | 'kanban' | 'calendar';
const VIEWS: { id: View; label: string; icon: typeof BarChart2; key: string }[] = [
  { id: 'list',     label: 'Список',    icon: List,     key: 'L' },
  { id: 'timeline', label: 'Таймлайн', icon: BarChart2, key: 'T' },
  { id: 'kanban',   label: 'Kanban',   icon: Columns3,  key: 'K' },
  { id: 'calendar', label: 'Календарь',icon: Calendar,  key: 'C' },
];

const PRIORITY_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'К выполнению', in_progress: 'В процессе', done: 'Выполнено' };
const PRIORITY_LABELS: Record<Priority, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

function getProgress(plan: Plan) {
  const all = plan.phases.flatMap(p => p.tasks);
  if (!all.length) return 0;
  return Math.round((all.filter(t => t.status === 'done').length / all.length) * 100);
}

function DeadlineAlerts({ plan }: { plan: Plan }) {
  const todayStart = startOfDay(new Date()); // только дата, без времени

  const allTasks = plan.phases.flatMap(p => p.tasks);

  // Просроченные: end_date строго раньше начала сегодняшнего дня
  const overdue = allTasks.filter(
    t => t.status !== 'done' && startOfDay(parseISO(t.end_date)) < todayStart
  );

  // Задачи со сроком сегодня или в ближайшие 3 дня — сгруппированные по дням
  type DueGroup = { days: number; label: string; tasks: Task[] };
  const dueSoonGroups: DueGroup[] = [];
  for (let d = 0; d <= 3; d++) {
    const tasks = allTasks.filter(t => {
      if (t.status === 'done') return false;
      return differenceInDays(startOfDay(parseISO(t.end_date)), todayStart) === d;
    });
    if (tasks.length === 0) continue;
    const label =
      d === 0 ? 'срок сегодня' :
      d === 1 ? 'срок завтра' :
      d < 5   ? `срок через ${d} дня` :
                `срок через ${d} дней`;
    dueSoonGroups.push({ days: d, label, tasks });
  }

  if (overdue.length === 0 && dueSoonGroups.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {overdue.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{overdue.length} {overdue.length === 1 ? 'задача просрочена' : 'задачи просрочены'}</strong>:{' '}
            {overdue.slice(0, 2).map(t => t.title).join(', ')}{overdue.length > 2 ? '…' : ''}
          </span>
        </motion.div>
      )}
      {dueSoonGroups.map(({ days, label, tasks }) => (
        <motion.div
          key={days}
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + days * 0.03 }}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400 text-sm"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            <strong>{label}</strong>:{' '}
            {tasks.slice(0, 2).map(t => t.title).join(', ')}
            {tasks.length > 2 ? ` (+${tasks.length - 2})` : ''}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function HotkeysOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 600 }}>Горячие клавиши</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2.5">
          {[
            { key: 'L', desc: 'Список задач' },
            { key: 'T', desc: 'Таймлайн' },
            { key: 'K', desc: 'Kanban' },
            { key: 'C', desc: 'Календарь' },
            { key: 'N', desc: 'Новый план' },
            { key: 'A', desc: 'Аналитика' },
            { key: 'F', desc: 'Режим фокуса' },
            { key: 'P', desc: '🚨 Режим паники' },
            { key: '⌘K', desc: 'Быстрое добавление' },
            { key: 'Ctrl+Z', desc: 'Отменить' },
            { key: 'Ctrl+Y', desc: 'Повторить' },
            { key: '?', desc: 'Эта подсказка' },
          ].map(h => (
            <div key={h.key} className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-white/60">{h.desc}</span>
              <kbd className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 text-xs border border-slate-200 dark:border-white/15" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {h.key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, setSyncStatus } = useAuth();

  const { present: plan, push: pushUndo, undo, redo, canUndo, canRedo, reset: resetHistory } = useUndoRedo<Plan | null>(null);

  const [view, setView] = useState<View>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [showWeeklyDigest, setShowWeeklyDigest] = useState(false);
  const [showPanicMode, setShowPanicMode] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [phaseRetro, setPhaseRetro] = useState<Phase | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [addTaskPhase, setAddTaskPhase] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [tourReady, setTourReady] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [expandPhase, setExpandPhase] = useState<Phase | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showPreventiveCoach, setShowPreventiveCoach] = useState(false);
  const [showStructureEditor, setShowStructureEditor] = useState(false);
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);

  // Auto-show preventive coach after delay if risk detected
  useEffect(() => {
    if (!plan) return;
    const t = setTimeout(() => {
      if (shouldShowPreventiveCoach()) setShowPreventiveCoach(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [plan]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterPhase, setFilterPhase] = useState<string | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const swipeStartX = useRef<number | null>(null);

  // ── Cloud sync helper ────────────────────────────────────────────────────
  const cloudSync = useCallback((p: Plan) => {
    if (!token) return;
    setSyncStatus('syncing');
    saveCloudPlan(p, token)
      .then(() => setSyncStatus('synced'))
      .catch(err => { console.warn('Cloud sync failed:', err); setSyncStatus('error'); });
  }, [token, setSyncStatus]);

  // Persist + cloud sync helper
  const applyPlan = useCallback((updated: Plan) => {
    pushUndo(updated);
    savePlan(updated);
    cloudSync(updated);
  }, [pushUndo, cloudSync]);

  // ── allTaskOptions (before early return) ────────────────────────────────
  const allTaskOptions = useMemo(() => {
    if (!plan) return [];
    return plan.phases.flatMap(phase =>
      phase.tasks.map(t => ({ id: t.id, title: t.title, phaseName: phase.name, phaseColor: phase.color }))
    );
  }, [plan]);

  useEffect(() => {
    if (!id) return;
    const p = getPlanById(id);
    if (p) {
      resetHistory(p);
      setExpandedPhases(new Set(p.phases.slice(0, 2).map(ph => ph.id)));
      setTimeout(() => setTourReady(true), 800);
    } else {
      navigate('/dashboard');
    }
  }, [id, navigate, resetHistory]);

  // Listen for timer stopped from Navbar — refresh plan state from localStorage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { planId: string } | undefined;
      if (!detail || detail.planId !== id) return;
      const refreshed = getPlanById(id);
      if (refreshed) resetHistory(refreshed);
    };
    window.addEventListener('stride:plan-refresh', handler);
    return () => window.removeEventListener('stride:plan-refresh', handler);
  }, [id, resetHistory]);

  useEffect(() => {
    if (!plan) { document.title = 'Vecto'; return; }
    const progress = getProgress(plan);
    const shortGoal = plan.goal.length > 40 ? plan.goal.slice(0, 40) + '…' : plan.goal;
    document.title = `Vecto (${progress}%) — ${shortGoal}`;
    return () => { document.title = 'Vecto'; };
  }, [plan]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(s => !s);
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey) return;

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        const prev = undo();
        if (prev) { savePlan(prev); cloudSync(prev); toast.success('Отменено ✓'); }
        else toast('Нечего отменять', { icon: '🚫' });
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        const next = redo();
        if (next) { savePlan(next); cloudSync(next); toast.success('Повторено ✓'); }
        return;
      }
      if (e.ctrlKey) return;

      switch (e.key.toLowerCase()) {
        case 'l': setView('list'); break;
        case 't': setView('timeline'); break;
        case 'k': setView('kanban'); markChecklistStep('open_kanban'); break;
        case 'c': setView('calendar'); break;
        case 'n': navigate('/new'); break;
        case 'a': setShowAnalytics(s => !s); break;
        case 'p': setShowPanicMode(true); break;
        case 'f':
          if (plan) {
            const ft = plan.phases.flatMap(p => p.tasks).find(t => t.status !== 'done');
            if (ft) { setFocusTask(ft); markChecklistStep('use_focus'); }
          }
          break;
        case '?': case '/': setShowHotkeys(s => !s); break;
        case 'escape':
          setShowHotkeys(false); setSelectedTask(null);
          setFocusTask(null); setSelectedTasks(new Set());
          setShowCommandPalette(false); setShowPanicMode(false);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, undo, redo, plan, cloudSync]);

  const handleSwipeStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX; };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 60) return;
    const order: View[] = ['list', 'timeline', 'kanban', 'calendar'];
    const idx = order.indexOf(view);
    if (dx < 0 && idx < order.length - 1) setView(order[idx + 1]);
    if (dx > 0 && idx > 0) setView(order[idx - 1]);
  };

  // ── Tomi Integration (must be before any early return — Rules of Hooks) ──────
  const { setContext, setPlanActionHandler } = useTomi();

  // Pass rich context with task IDs + plan stats so Tomi can reference them and coach proactively
  useEffect(() => {
    if (!plan) { setContext(''); return; }
    const progress = getProgress(plan);
    const allTasks = plan.phases.flatMap(p => p.tasks);
    const overdueCount = allTasks.filter(t => t.status !== 'done' && startOfDay(parseISO(t.end_date)) < startOfDay(new Date())).length;
    const daysLeft = differenceInDays(parseISO(plan.deadline), new Date());

    // Estimate days since last completed task (rough heuristic via localStorage activity)
    let lastActivityDays = 0;
    try {
      const activity: Record<string, number> = JSON.parse(localStorage.getItem('stride_activity') || '{}');
      const today = new Date().toISOString().slice(0, 10);
      for (let d = 0; d < 30; d++) {
        const dateKey = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        if (activity[dateKey] && activity[dateKey] > 0) { lastActivityDays = d; break; }
        if (d === 29) lastActivityDays = 30;
      }
    } catch {}

    const taskList = plan.phases.flatMap(ph =>
      ph.tasks.map(t =>
        `[${t.id}] "${t.title}" | этап: "${ph.name}" (id:${ph.id}) | статус: ${t.status} | приоритет: ${t.priority}`
      )
    ).join('\n');

    const ctx =
      `Цель: ${plan.goal}\nДедлайн: ${plan.deadline}\nПрогресс: ${progress}%\n` +
      `Выполнено: ${allTasks.filter(t=>t.status==='done').length}/${allTasks.length} | Просрочено: ${overdueCount} | Дней до дедлайна: ${daysLeft}\n\n` +
      `Список задач:\n${taskList}`;

    setContext(ctx, { progress, overdueCount, daysLeft, lastActivityDays });
    return () => setContext('');
  }, [plan, setContext]);

  // Register command handler
  useEffect(() => {
    const handler = (action: PlanAction) => {
      const cur = getPlanById(id!);
      if (!cur) return;
      switch (action.type) {
        case 'delete_task': {
          if (!action.taskId) return;
          const updated: Plan = { ...cur, phases: cur.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => t.id !== action.taskId) })) };
          applyPlan(updated); toast.success(`🗑️ «${action.taskTitle ?? 'Задача'}» удалена`); break;
        }
        case 'delete_tasks': {
          if (!action.taskIds?.length) return;
          const ids = new Set(action.taskIds);
          const updated: Plan = { ...cur, phases: cur.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => !ids.has(t.id)) })) };
          applyPlan(updated); toast.success(`🗑️ ${action.taskIds.length} задач удалено`); break;
        }
        case 'change_status': {
          if (!action.taskId || !action.newStatus) return;
          const r = updateTask(cur.id, action.taskId, { status: action.newStatus });
          if (r) { applyPlan(r); toast.success(`✅ Статус задачи изменён`); } break;
        }
        case 'mark_done': {
          if (!action.taskIds?.length) return;
          let updated = cur;
          action.taskIds.forEach(tid => { const r = updateTask(updated.id, tid, { status: 'done' }); if (r) { updated = r; recordActivity(); } });
          applyPlan(updated); toast.success(`✅ ${action.taskIds.length} задач выполнено`); setConfetti(true); break;
        }
        case 'change_priority': {
          if (!action.taskId || !action.newPriority) return;
          const r = updateTask(cur.id, action.taskId, { priority: action.newPriority });
          if (r) { applyPlan(r); toast.success(`🎯 Приоритет обновлён`); } break;
        }
        case 'rename_task': {
          if (!action.taskId || !action.newTitle) return;
          const r = updateTask(cur.id, action.taskId, { title: action.newTitle });
          if (r) { applyPlan(r); toast.success(`✏️ Задача переименована`); } break;
        }
        case 'add_task': {
          if (!action.phaseId || !action.newTaskTitle) return;
          const phase = cur.phases.find(ph => ph.id === action.phaseId);
          if (!phase) return;
          const newTask: Task = {
            id: Math.random().toString(36).slice(2, 10), phase_id: action.phaseId,
            title: action.newTaskTitle, description: '', duration_hours: 2,
            priority: action.newTaskPriority ?? 'medium', depends_on: [],
            status: 'todo', start_date: phase.start_date, end_date: phase.end_date, tags: [],
          };
          const updated: Plan = { ...cur, phases: cur.phases.map(ph => ph.id === action.phaseId ? { ...ph, tasks: [...ph.tasks, newTask] } : ph) };
          applyPlan(updated); toast.success(`➕ Задача добавлена`); break;
        }
        default: break;
      }
    };
    setPlanActionHandler(handler);
    return () => setPlanActionHandler(null);
  }, [id, applyPlan, setPlanActionHandler]);

  if (!plan) return <SkeletonPlan />;

  const progress = getProgress(plan);
  const totalHours = plan.phases.flatMap(p => p.tasks).reduce((acc, t) => acc + t.duration_hours, 0);
  const doneCount = plan.phases.flatMap(p => p.tasks).filter(t => t.status === 'done').length;
  const totalCount = plan.phases.flatMap(p => p.tasks).length;

  // Completion forecast
  const velocityPerDay = (() => {
    const done = plan.phases.flatMap(p => p.tasks).filter(t => {
      if (t.status !== 'done') return false;
      const d = differenceInDays(new Date(), parseISO(t.end_date));
      return d >= 0 && d <= 7;
    }).length;
    return done / 7;
  })();
  const remaining = totalCount - doneCount;
  const forecastDate = velocityPerDay > 0 ? new Date(Date.now() + (remaining / velocityPerDay) * 86400000) : null;

  const filteredPlan: Plan = {
    ...plan,
    phases: plan.phases
      .filter(ph => filterPhase === 'all' || ph.id === filterPhase)
      .map(ph => ({
        ...ph,
        tasks: ph.tasks.filter(t => {
          const matchSearch   = !search || t.title.toLowerCase().includes(search.toLowerCase());
          const matchStatus   = filterStatus === 'all' || t.status === filterStatus;
          const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
          return matchSearch && matchStatus && matchPriority;
        }),
      })),
  };

  const activeFilters = (search ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0) + (filterPriority !== 'all' ? 1 : 0) + (filterPhase !== 'all' ? 1 : 0);

  // ── Task handlers ────────────────────────────────────────────────────────
  const handleTaskSave = (taskId: string, updates: Partial<Task>) => {
    const task = plan!.phases.flatMap(p => p.tasks).find(t => t.id === taskId);
    const wasNotDone = task?.status !== 'done';
    const becomingDone = updates.status === 'done';

    // Streak update for recurring tasks
    let streakUpdates: Partial<Task> = {};
    if (task?.recurring && becomingDone && wasNotDone) {
      streakUpdates = computeStreakUpdate(task);
    }

    const updated = updateTask(plan!.id, taskId, { ...updates, ...streakUpdates });
    if (updated) {
      pushUndo(updated);
      toast.success('Задача обновлена');
      if (wasNotDone && becomingDone) {
        setConfetti(true);
        recordActivity();
        markChecklistStep('complete_task');
        // Check if entire phase is done → trigger retro
        const phase = updated.phases.find(ph => ph.tasks.some(t => t.id === taskId));
        if (phase && phase.tasks.every(t => t.status === 'done')) {
          setTimeout(() => setPhaseRetro(phase), 600);
        }
      }
      cloudSync(updated);
    }
  };

  const handleTaskDelete = (taskId: string) => {
    const updated: Plan = { ...plan, phases: plan.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => t.id !== taskId) })) };
    applyPlan(updated);
    toast.success('Задача удалена');
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    const task = plan!.phases.flatMap(p => p.tasks).find(t => t.id === taskId);
    const wasNotDone = task?.status !== 'done';

    let streakUpdates: Partial<Task> = {};
    if (task?.recurring && status === 'done' && wasNotDone) {
      streakUpdates = computeStreakUpdate(task);
    }

    const updated = updateTask(plan!.id, taskId, { status, ...streakUpdates });
    if (updated) {
      pushUndo(updated);
      // Pattern tracking for Tomi-clone
      if (task) {
        const action = status === 'done' ? 'completed' : status === 'in_progress' ? 'started' : 'postponed';
        recordTaskEvent(task.id, task.title, action, task.priority, task.difficulty, task.tags);
      }
      if (wasNotDone && status === 'done') {
        setConfetti(true);
        recordActivity();
        markChecklistStep('complete_task');
        // Check phase completion
        const phase = updated.phases.find(ph => ph.tasks.some(t => t.id === taskId));
        if (phase && phase.tasks.every(t => t.status === 'done')) {
          setTimeout(() => setPhaseRetro(phase), 600);
        }
      }
      cloudSync(updated);
    }
  };

  const handleTaskRename = (taskId: string, title: string) => {
    const updated = updateTask(plan.id, taskId, { title });
    if (updated) { pushUndo(updated); cloudSync(updated); }
  };

  const handleTimerToggle = (taskId: string) => {
    const task = plan.phases.flatMap(p => p.tasks).find(t => t.id === taskId);
    if (!task) return;
    if (task.timer_start) {
      const elapsed = Math.floor((Date.now() - new Date(task.timer_start).getTime()) / 1000);
      const updated = updateTask(plan.id, taskId, { timer_start: undefined, tracked_seconds: (task.tracked_seconds ?? 0) + elapsed, status: task.status === 'todo' ? 'in_progress' : task.status });
      if (updated) { pushUndo(updated); cloudSync(updated); toast('Таймер остановлен', { icon: '⏹' }); }
    } else {
      const updated = updateTask(plan.id, taskId, { timer_start: new Date().toISOString(), status: task.status === 'todo' ? 'in_progress' : task.status });
      if (updated) { pushUndo(updated); cloudSync(updated); toast('Таймер запущен', { icon: '▶' }); }
    }
  };

  const handleAddTask = (phaseId: string, extraFields?: Partial<Task>) => {
    const titleToUse = extraFields?.title ?? newTaskTitle.trim();
    if (!titleToUse) return;
    const phase = plan!.phases.find(p => p.id === phaseId);
    if (!phase) return;
    const newTask: Task = {
      id: Math.random().toString(36).slice(2, 10),
      phase_id: phaseId,
      title: titleToUse,
      duration_hours: extraFields?.duration_hours ?? 2,
      priority: extraFields?.priority ?? 'medium',
      depends_on: [],
      status: 'todo',
      start_date: extraFields?.start_date ?? phase.start_date,
      end_date: extraFields?.end_date ?? phase.end_date,
      tags: extraFields?.tags ?? [],
    };
    const updated: Plan = { ...plan!, phases: plan!.phases.map(p => p.id === phaseId ? { ...p, tasks: [...p.tasks, newTask] } : p) };
    applyPlan(updated);
    setNewTaskTitle('');
    setAddTaskPhase(null);
    toast.success('Задача добавлена');
  };

  const handleStructureApply = (updated: Plan) => {
    applyPlan(updated);
    toast.success('Структура плана обновлена');
  };

  const handleUpdateMilestones = (milestones: Milestone[]) => {
    const updated = { ...plan, milestones };
    applyPlan(updated);
  };

  const handleAIExpand = (phaseId: string, newTasks: Task[]) => {
    const updated: Plan = { ...plan, phases: plan.phases.map(ph => ph.id === phaseId ? { ...ph, tasks: [...ph.tasks, ...newTasks] } : ph) };
    applyPlan(updated);
    toast.success(`${newTasks.length} задач добавлено через AI ✨`);
  };

  const handleMoveTask = (taskId: string, fromPhaseId: string, toPhaseId: string) => {
    const fromPhase = plan.phases.find(p => p.id === fromPhaseId);
    const task = fromPhase?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated: Plan = {
      ...plan,
      phases: plan.phases.map(ph => {
        if (ph.id === fromPhaseId) return { ...ph, tasks: ph.tasks.filter(t => t.id !== taskId) };
        if (ph.id === toPhaseId) return { ...ph, tasks: [...ph.tasks, { ...task, phase_id: toPhaseId }] };
        return ph;
      }),
    };
    applyPlan(updated);
    toast.success('Задача перенесена');
  };

  const handleApplyPanicPlan = (criticalTaskIds: Set<string>) => {
    if (!plan) return;
    const updated: Plan = {
      ...plan,
      phases: plan.phases.map(ph => ({
        ...ph,
        tasks: ph.tasks.filter(t => t.status === 'done' || criticalTaskIds.has(t.id)),
      })),
    };
    applyPlan(updated);
    toast.success(`🚨 Паник-план применён: оставлено ${criticalTaskIds.size} ключевых задач`);
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const handleBulkDone = () => {
    let updated = plan;
    selectedTasks.forEach(tid => { const r = updateTask(updated.id, tid, { status: 'done' }); if (r) { updated = r; recordActivity(); } });
    applyPlan(updated); setSelectedTasks(new Set()); setConfetti(true); toast.success(`${selectedTasks.size} задач выполнено`);
  };
  const handleBulkInProgress = () => {
    let updated = plan;
    selectedTasks.forEach(tid => { const r = updateTask(updated.id, tid, { status: 'in_progress' }); if (r) updated = r; });
    applyPlan(updated); setSelectedTasks(new Set()); toast.success(`${selectedTasks.size} задач в работу`);
  };
  const handleBulkPriority = (priority: Priority) => {
    let updated = plan;
    selectedTasks.forEach(tid => { const r = updateTask(updated.id, tid, { priority }); if (r) updated = r; });
    applyPlan(updated); setSelectedTasks(new Set()); toast.success('Приоритет обновлён');
  };
  const handleBulkDelete = () => {
    const updated: Plan = { ...plan, phases: plan.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => !selectedTasks.has(t.id)) })) };
    applyPlan(updated); setSelectedTasks(new Set()); toast.success(`${selectedTasks.size} задач удалено`);
  };

  const getTaskPhaseInfo = (task: Task) => {
    const phase = plan.phases.find(p => p.id === task.phase_id || p.tasks.some(t => t.id === task.id));
    return phase ? { color: phase.color, name: phase.name } : { color: '#1d4ed8', name: '' };
  };

  const togglePhase = (phaseId: string) => {
    const next = new Set(expandedPhases);
    if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
    setExpandedPhases(next);
  };

  /* ── duplicate Tomi block removed ── */
  /* COMMENT_WRAP_A
  useEffect(() => {
    if (!plan) { setContext(''); return; }
    const progress = getProgress(plan);
    const taskList = plan.phases.flatMap(ph =>
      ph.tasks.map(t =>
        `[${t.id}] "${t.title}" | этап: "${ph.name}" (id:${ph.id}) | статус: ${t.status} | приоритет: ${t.priority}`
      )
    ).join('\n');
    setContext(
      `Цель: ${plan.goal}\nДедлайн: ${plan.deadline}\nПрогресс: ${progress}%\n` +
      `Выполнено: ${plan.phases.flatMap(p=>p.tasks).filter(t=>t.status==='done').length}/${plan.phases.flatMap(p=>p.tasks).length}\n\n` +
      `Список задач:\n${taskList}`
    );
    return () => setContext('');
  }, [plan, setContext]);

  // Register command handler
  useEffect(() => {
    const handler = (action: PlanAction) => {
      const cur = getPlanById(id!);
      if (!cur) return;
      switch (action.type) {
        case 'delete_task': {
          if (!action.taskId) return;
          const updated: Plan = { ...cur, phases: cur.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => t.id !== action.taskId) })) };
          applyPlan(updated); toast.success(`🗑️ «${action.taskTitle ?? 'Задача'}» удалена`); break;
        }
        case 'delete_tasks': {
          if (!action.taskIds?.length) return;
          const ids = new Set(action.taskIds);
          const updated: Plan = { ...cur, phases: cur.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => !ids.has(t.id)) })) };
          applyPlan(updated); toast.success(`🗑️ ${action.taskIds.length} задач удалено`); break;
        }
        case 'change_status': {
          if (!action.taskId || !action.newStatus) return;
          const r = updateTask(cur.id, action.taskId, { status: action.newStatus });
          if (r) { applyPlan(r); toast.success(`✅ Статус задачи изменён`); } break;
        }
        case 'mark_done': {
          if (!action.taskIds?.length) return;
          let updated = cur;
          action.taskIds.forEach(tid => { const r = updateTask(updated.id, tid, { status: 'done' }); if (r) { updated = r; recordActivity(); } });
          applyPlan(updated); toast.success(`✅ ${action.taskIds.length} задач выполнено`); setConfetti(true); break;
        }
        case 'change_priority': {
          if (!action.taskId || !action.newPriority) return;
          const r = updateTask(cur.id, action.taskId, { priority: action.newPriority });
          if (r) { applyPlan(r); toast.success(`🎯 Приоритет обновлён`); } break;
        }
        case 'rename_task': {
          if (!action.taskId || !action.newTitle) return;
          const r = updateTask(cur.id, action.taskId, { title: action.newTitle });
          if (r) { applyPlan(r); toast.success(`✏️ Задача переименована`); } break;
        }
        case 'add_task': {
          if (!action.phaseId || !action.newTaskTitle) return;
          const phase = cur.phases.find(ph => ph.id === action.phaseId);
          if (!phase) return;
          const newTask: Task = {
            id: Math.random().toString(36).slice(2, 10), phase_id: action.phaseId,
            title: action.newTaskTitle, description: '', duration_hours: 2,
            priority: action.newTaskPriority ?? 'medium', depends_on: [],
            status: 'todo', start_date: phase.start_date, end_date: phase.end_date, tags: [],
          };
          const updated: Plan = { ...cur, phases: cur.phases.map(ph => ph.id === action.phaseId ? { ...ph, tasks: [...ph.tasks, newTask] } : ph) };
          applyPlan(updated); toast.success(`➕ Задача добавлена`); break;
        }
        default: break;
      }
    };
    setPlanActionHandler(handler);
    return () => setPlanActionHandler(null);
  }, [id, applyPlan, setPlanActionHandler]);
  COMMENT_WRAP_B */

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-[#f0f4ff] dark:bg-[#060d1e] text-slate-900 dark:text-white"
      onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
      <OnboardingTour isReady={tourReady} />
      <ConfettiBurst active={confetti} onComplete={() => setConfetti(false)} />

      {/* Focus Mode */}
      <AnimatePresence>
        {focusTask && (
          <FocusMode
            task={focusTask}
            phaseColor={getTaskPhaseInfo(focusTask).color}
            phaseName={getTaskPhaseInfo(focusTask).name}
            onClose={() => setFocusTask(null)}
            onStatusChange={handleStatusChange}
            onNotesChange={(taskId, notes) => handleTaskSave(taskId, { description: notes })}
          />
        )}
      </AnimatePresence>

      {/* Panic Mode Modal */}
      <AnimatePresence>
        {showPanicMode && plan && (
          <PanicModeModal plan={plan} onClose={() => setShowPanicMode(false)} onApplyPanicPlan={handleApplyPanicPlan} />
        )}
      </AnimatePresence>

      {/* Preventive Coach Modal */}
      <AnimatePresence>
        {showPreventiveCoach && plan && (
          <TomiPreventiveCoach
            plan={plan}
            onClose={() => setShowPreventiveCoach(false)}
            onSimplifyTasks={(updates) => {
              updates.forEach(u => {
                if (u.remove) {
                  // Don't actually remove — just mark as low priority
                  handleTaskSave(u.taskId, { priority: 'low' as Priority });
                } else {
                  const fields: Partial<Task> = {};
                  if (u.newTitle) fields.title = u.newTitle;
                  if (u.newPriority) fields.priority = u.newPriority as Priority;
                  handleTaskSave(u.taskId, fields);
                }
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* Phase Retro Modal */}
      <AnimatePresence>
        {phaseRetro && plan && (
          <PhaseRetroModal phase={phaseRetro} plan={plan} onClose={() => setPhaseRetro(null)} />
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {showCommandPalette && plan && (
          <CommandPalette
            plan={plan}
            onClose={() => setShowCommandPalette(false)}
            onAddTask={(phaseId, fields) => handleAddTask(phaseId, fields)}
          />
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-[#1d4ed8]/12 dark:border-white/10 bg-white/92 dark:bg-[#060d1e]/95 backdrop-blur-xl shadow-sm navbar-safe">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors text-sm shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Мои планы</span>
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/10 shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center shrink-0">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <h1 className="text-slate-900 dark:text-white text-xs sm:text-sm truncate" style={{ fontWeight: 600 }}>
              {plan.goal.length > 28 ? plan.goal.slice(0, 28) + '…' : plan.goal}
            </h1>
          </div>

          {/* Right: essential actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button onClick={() => { const p = undo(); if (p) { savePlan(p); cloudSync(p); toast.success('Отменено'); } }}
              disabled={!canUndo} title="Отменить (Ctrl+Z)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { const p = redo(); if (p) { savePlan(p); cloudSync(p); toast.success('Повторено'); } }}
              disabled={!canRedo} title="Повторить (Ctrl+Y)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5 hidden sm:block" />

            {/* Risk indicator */}
            <div className="hidden sm:block">
              <RiskIndicator onClick={() => setShowPreventiveCoach(true)} />
            </div>

            {/* Desktop-only buttons */}
            <button onClick={() => setShowStructureEditor(true)} title="Структура плана"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:text-[#1d4ed8] bg-white dark:bg-white/5 text-xs transition-all">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Структура</span>
            </button>
            <button onClick={() => setShowDependencyGraph(true)} title="Граф зависимостей"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:text-[#1d4ed8] bg-white dark:bg-white/5 text-xs transition-all">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Связи</span>
            </button>
            <button onClick={() => setShowPanicMode(true)} title="Режим паники (P)"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 bg-white dark:bg-white/5 text-xs transition-all">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Паника</span>
            </button>
            <button onClick={() => setShowCommandPalette(true)} title="⌘K"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:text-[#1d4ed8] bg-white dark:bg-white/5 text-xs transition-all">
              <Command className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">⌘K</span>
            </button>

            {/* Analytics — icon-only on mobile */}
            <button data-tour="analytics-btn" onClick={() => setShowAnalytics(s => !s)} title="Аналитика (A)"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs transition-all ${showAnalytics ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]' : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-white/5'}`}>
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Аналитика</span>
            </button>

            {/* Export — icon-only on mobile */}
            <button onClick={() => setShowExport(true)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-white/5 text-xs transition-all">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Экспорт</span>
            </button>

            <button onClick={() => setShowHotkeys(true)} title="Горячие клавиши (?)"
              className="hidden sm:flex w-7 h-7 rounded-lg items-center justify-center border border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white bg-white dark:bg-white/5 transition-all">
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 sm:pb-8"
        style={{ paddingBottom: 'max(8rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
        {/* Stats */}
        <div data-tour="stats" className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {[
            { label: 'Прогресс', value: `${progress}%`, color: '#1d4ed8', icon: Target },
            { label: 'Выполнено', value: `${doneCount}/${totalCount}`, color: '#10b981', icon: Flag },
            { label: 'Часов всего', value: `${totalHours}ч`, color: '#f59e0b', icon: Clock },
            { label: 'Дедлайн', value: format(parseISO(plan.deadline), 'dd MMM', { locale: ru }), color: '#ef4444', icon: Calendar },
          ].map(stat => (
            <div key={stat.label} className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}15` }}>
                <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-400 dark:text-white/40 truncate">{stat.label}</div>
                <div className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 600 }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Plan Info */}
        {plan.hours_per_week && plan.total_days && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-xl border border-[#1d4ed8]/20 bg-gradient-to-r from-[#1d4ed8]/5 to-[#1d4ed8]/8 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-[#1d4ed8]/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#1d4ed8]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#1d4ed8]">План сгенерирован AI</span>
                <div className="h-4 w-px bg-[#1d4ed8]/20" />
                <span className="text-xs text-slate-500 dark:text-white/50">
                  {plan.hours_per_week}ч/нед. · {plan.total_days} дней · {Math.round(plan.total_days * (plan.hours_per_week / 7))}ч доступно
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/50 leading-relaxed">
                Vecto AI учёл ваше доступное время и создал реалистичный план с конкретными задачами
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress bar + forecast */}
        <div className="mb-4 sm:mb-5">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-white/40 mb-1.5">
            <span>Общий прогресс</span>
            <div className="flex items-center gap-2 sm:gap-3">
              {forecastDate && (
                <span className="text-[#1d4ed8] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span className="hidden sm:inline">Прогноз: </span>{format(forecastDate, 'dd MMM', { locale: ru })}
                </span>
              )}
              <span>{progress}%</span>
            </div>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#1e40af]"
              initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
          </div>
        </div>

        <DeadlineAlerts plan={plan} />

        {/* Plan Feedback — виден только после 24 ч с момента создания плана */}
        {(() => {
          const ageHours = (Date.now() - new Date(plan.created_at).getTime()) / 3_600_000;
          return ageHours >= 24 ? (
            <div className="mb-4 sm:mb-5">
              <PlanFeedback planId={plan.id} planGoal={plan.goal} />
            </div>
          ) : null;
        })()}

        {/* Milestone Tracker */}
        <div className="mb-4 sm:mb-5">
          <MilestoneTracker plan={plan} onUpdateMilestones={handleUpdateMilestones} />
        </div>

        {/* ── View Switcher ── */}
        <div data-tour="view-toggle" className="flex items-center gap-1 mb-3 sm:mb-4 p-1 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm w-full sm:w-fit">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => { setView(v.id); if (v.id === 'kanban') markChecklistStep('open_kanban'); }}
              title={`${v.label} (${v.key})`}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm transition-all ${
                view === v.id
                  ? 'bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white shadow-md shadow-[#1d4ed8]/25'
                  : 'text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8'
              }`}
              style={{ fontWeight: view === v.id ? 600 : 400 }}
            >
              <v.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">{v.label}</span>
              <kbd className={`hidden sm:inline text-[9px] px-1 py-0.5 rounded font-mono leading-none ${
                view === v.id ? 'bg-white/20 text-white/70' : 'bg-slate-100 dark:bg-white/8 text-slate-400 dark:text-white/25'
              }`}>{v.key}</kbd>
            </button>
          ))}
          <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-white/10">
            <button onClick={() => {
              const ft = plan.phases.flatMap(p => p.tasks).find(t => t.status !== 'done');
              if (ft) { setFocusTask(ft); markChecklistStep('use_focus'); } else toast('Все задачи выполнены! 🎉');
            }} title="Режим фокуса (F)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 dark:text-white/40 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/8 text-xs transition-all">
              <Brain className="w-3.5 h-3.5" />
              Фокус
            </button>
            <button onClick={() => setShowWeeklyDigest(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 text-xs transition-all">
              <FileText className="w-3.5 h-3.5" />
              Дайджест
            </button>
          </div>
        </div>

        {/* Mobile quick-action row */}
        <div className="sm:hidden flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => setShowMobileSidebar(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border whitespace-nowrap transition-all shrink-0 ${
              showMobileSidebar
                ? 'bg-[#1d4ed8]/10 border-[#1d4ed8]/40 text-[#1d4ed8]'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50'
            }`}>
            <Plus className="w-3.5 h-3.5" />
            Этапы ({plan.phases.length})
          </button>
          <button onClick={() => {
            const ft = plan.phases.flatMap(p => p.tasks).find(t => t.status !== 'done');
            if (ft) { setFocusTask(ft); markChecklistStep('use_focus'); } else toast('Все задачи выполнены! 🎉');
          }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border whitespace-nowrap shrink-0 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 transition-all">
            <Brain className="w-3.5 h-3.5" />Фокус
          </button>
          <button onClick={() => setShowPanicMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border whitespace-nowrap shrink-0 border-red-200 dark:border-red-500/20 bg-white dark:bg-white/5 text-red-500 transition-all">
            <AlertOctagon className="w-3.5 h-3.5" />Паника
          </button>
          <button onClick={() => setShowCommandPalette(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border whitespace-nowrap shrink-0 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 transition-all ml-auto">
            <Command className="w-3.5 h-3.5" />⌘K
          </button>
        </div>

        {/* Analytics + Heatmap */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden mb-4 sm:mb-5">
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm space-y-6">
                <AnalyticsPanel plan={plan} />
                <div>
                  <h4 className="text-sm text-slate-700 dark:text-white/70 mb-4" style={{ fontWeight: 600 }}>Активность задач</h4>
                  <ActivityHeatmap />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="sm:hidden text-center text-xs text-slate-400 dark:text-white/25 mb-3">← Свайп для смены вида →</p>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск задач..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/25 text-xs focus:outline-none focus:border-[#1d4ed8]/40 focus:ring-1 focus:ring-[#1d4ed8]/15 transition-all shadow-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all shadow-sm whitespace-nowrap ${showFilters || activeFilters > 0 ? 'bg-[#1d4ed8]/10 border-[#1d4ed8]/40 text-[#1d4ed8]' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50'}`}>
            <Filter className="w-3.5 h-3.5" />Фильтры
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#1d4ed8] text-white flex items-center justify-center" style={{ fontSize: '10px' }}>{activeFilters}</span>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4 sm:mb-5">
              <div className="flex flex-wrap gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/8 text-slate-700 dark:text-white/70 focus:outline-none cursor-pointer flex-1 min-w-[120px]">
                  <option value="all">Все статусы</option>
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/8 text-slate-700 dark:text-white/70 focus:outline-none cursor-pointer flex-1 min-w-[120px]">
                  <option value="all">Все приоритеты</option>
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </select>
                <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/8 text-slate-700 dark:text-white/70 focus:outline-none cursor-pointer flex-1 min-w-[120px]">
                  <option value="all">Все этапы</option>
                  {plan.phases.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                </select>
                {activeFilters > 0 && (
                  <button onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterPhase('all'); setSearch(''); }}
                    className="text-xs px-3 py-2 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-red-200 dark:border-red-500/25">
                    Сбросить
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${view !== 'list' ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
          {/* Left sidebar — collapsible on mobile, hidden in list view (which shows phases inline) */}
          <div data-tour="phases" className={`space-y-2 ${view === 'list' ? 'hidden' : showMobileSidebar ? '' : 'hidden lg:block'}`}>
            <div className="text-xs text-slate-400 dark:text-white/30 px-1 mb-3" style={{ fontWeight: 500 }}>
              ЭТАПЫ ({plan.phases.length})
            </div>
            {plan.phases.map((phase, pIdx) => {
              const isExpanded = expandedPhases.has(phase.id);
              const phaseDone = phase.tasks.filter(t => t.status === 'done').length;
              const phaseProgress = phase.tasks.length > 0 ? Math.round((phaseDone / phase.tasks.length) * 100) : 0;
              return (
                <motion.div key={phase.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: pIdx * 0.07 }}>
                  <button onClick={() => togglePhase(phase.id)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/8 hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: phase.color }} />
                      <span className="text-sm text-slate-900 dark:text-white flex-1 leading-snug" style={{ fontWeight: 500 }}>{phase.name}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-white/30 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-white/30 shrink-0" />}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full transition-all" animate={{ width: `${phaseProgress}%` }} transition={{ duration: 0.6 }}
                          style={{ background: phase.color }} />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-white/30 shrink-0">{phaseDone}/{phase.tasks.length}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-1 ml-2 space-y-1">
                      {phase.tasks.map(task => (
                        <button key={task.id} onClick={() => setSelectedTask(task)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/8 hover:border-slate-300 dark:hover:border-white/20 transition-all flex items-start gap-2 group shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} />
                          <span className={`text-xs flex-1 leading-snug ${task.status === 'done' ? 'line-through text-slate-400 dark:text-white/25' : 'text-slate-600 dark:text-white/60'}`}>
                            {task.title}
                          </span>
                          {task.timer_start && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse mt-1.5 shrink-0" title="Таймер запущен" />}
                          <Pencil className="w-3 h-3 text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/50 transition-colors shrink-0 mt-0.5" />
                        </button>
                      ))}

                      {addTaskPhase === phase.id ? (
                        <div className="flex gap-1.5 mt-1">
                          <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddTask(phase.id); if (e.key === 'Escape') { setAddTaskPhase(null); setNewTaskTitle(''); } }}
                            placeholder="Название задачи..." autoFocus
                            className="flex-1 bg-white dark:bg-white/8 border border-[#1d4ed8]/35 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#1d4ed8]/60 placeholder-slate-400 dark:placeholder-white/25 shadow-sm" />
                          <button onClick={() => handleAddTask(phase.id)} className="px-2.5 py-1.5 rounded-lg bg-[#1d4ed8] text-white text-xs hover:bg-[#1e40af] transition-colors shadow-sm">+</button>
                        </div>
                      ) : (
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => { setAddTaskPhase(phase.id); setNewTaskTitle(''); }}
                            className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 dark:text-white/30 hover:text-[#1d4ed8] transition-colors border border-dashed border-slate-200 dark:border-white/10 hover:border-[#1d4ed8]/35 hover:bg-[#1d4ed8]/5">
                            <Plus className="w-3 h-3" />Задача
                          </button>
                          {/* AI Expand button */}
                          <button onClick={() => setExpandPhase(phase)} title="AI-расширение фазы ✨"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 dark:text-white/30 hover:text-[#1d4ed8] transition-colors border border-dashed border-slate-200 dark:border-white/10 hover:border-[#1d4ed8]/35 hover:bg-[#1d4ed8]/5">
                            <Sparkles className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Main view */}
          <div data-tour="main-view" className="min-w-0">
            <AnimatePresence mode="wait">
              {view === 'list' && (
                <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <PlanListView
                    plan={filteredPlan}
                    onTaskClick={task => setSelectedTask(task)}
                    onStatusChange={handleStatusChange}
                    onTimerToggle={handleTimerToggle}
                    onMoveTask={handleMoveTask}
                    onAddTask={(phaseId, title) => handleAddTask(phaseId, { title })}
                    onSubtaskToggle={(taskId, subtaskId, done) => {
                      const cur = getPlanById(plan.id);
                      if (!cur) return;
                      const updated: Plan = {
                        ...cur,
                        phases: cur.phases.map(ph => ({
                          ...ph,
                          tasks: ph.tasks.map(t => t.id !== taskId ? t : {
                            ...t,
                            subtasks: (t.subtasks ?? []).map(st => st.id !== subtaskId ? st : { ...st, done }),
                          }),
                        })),
                      };
                      applyPlan(updated);
                    }}
                  />
                </motion.div>
              )}
              {view === 'timeline' && (
                <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <TimelineView plan={filteredPlan} onTaskClick={task => setSelectedTask(task)} onStatusChange={handleStatusChange} />
                </motion.div>
              )}
              {view === 'kanban' && (
                <motion.div key="kanban" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <KanbanView
                    plan={filteredPlan}
                    onTaskClick={task => setSelectedTask(task)}
                    onStatusChange={handleStatusChange}
                    onTaskRename={handleTaskRename}
                    onTimerToggle={handleTimerToggle}
                    selectedTasks={selectedTasks}
                    allTasksForRisk={plan.phases.flatMap(p => p.tasks)}
                    onTaskSelect={(taskId, sel) => {
                      const next = new Set(selectedTasks);
                      if (sel) next.add(taskId); else next.delete(taskId);
                      setSelectedTasks(next);
                    }}
                  />
                </motion.div>
              )}
              {view === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <CalendarView plan={filteredPlan} onTaskClick={task => setSelectedTask(task)} onStatusChange={handleStatusChange} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedTasks.size}
        onMarkDone={handleBulkDone}
        onMarkInProgress={handleBulkInProgress}
        onChangePriority={handleBulkPriority}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedTasks(new Set())}
      />

      {/* Modals */}
      <AnimatePresence>
        {selectedTask && (
          <TaskEditModal
            task={selectedTask}
            phaseColor={getTaskPhaseInfo(selectedTask).color}
            phaseName={getTaskPhaseInfo(selectedTask).name}
            allTaskOptions={allTaskOptions}
            onClose={() => setSelectedTask(null)}
            onSave={(taskId, updates) => { handleTaskSave(taskId, updates); setSelectedTask(null); }}
            onDelete={taskId => { handleTaskDelete(taskId); setSelectedTask(null); }}
            onTimerToggle={handleTimerToggle}
          />
        )}
        {showExport && <ExportModal plan={plan} onClose={() => setShowExport(false)} />}
        {showWeeklyDigest && <WeeklyDigest plan={plan} onClose={() => setShowWeeklyDigest(false)} />}
        {expandPhase && (
          <AIExpandModal phase={expandPhase} plan={plan} onClose={() => setExpandPhase(null)} onApply={handleAIExpand} />
        )}
        {showHotkeys && <HotkeysOverlay onClose={() => setShowHotkeys(false)} />}
        {showStructureEditor && (
          <PlanStructureEditor plan={plan} onApply={handleStructureApply} onClose={() => setShowStructureEditor(false)} />
        )}
        {showDependencyGraph && (
          <DependencyGraph plan={plan} onTaskClick={task => { setShowDependencyGraph(false); setSelectedTask(task); }} onClose={() => setShowDependencyGraph(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}