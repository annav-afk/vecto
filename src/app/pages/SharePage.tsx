import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Zap, Eye, Target, Clock, Calendar, Flag, AlertCircle, BarChart2, Copy } from 'lucide-react';
import { Plan } from '../lib/types';
import { TimelineView } from '../components/TimelineView';
import { format, parseISO } from 'date-fns';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { savePlan } from '../lib/storage';
import { toast } from 'sonner';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#10b981',
};
const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий', medium: 'Средний', low: 'Низкий',
};

function getProgress(plan: Plan) {
  const all = plan.phases.flatMap(p => p.tasks);
  if (!all.length) return 0;
  return Math.round((all.filter(t => t.status === 'done').length / all.length) * 100);
}

export function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateCopied, setTemplateCopied] = useState(false);

  useEffect(() => {
    if (!shareId) return;
    setLoading(true);

    fetch(`${SERVER}/share/${shareId}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.plan) {
          setPlan(data.plan);
          setSharedAt(data.sharedAt);
          document.title = `Vecto — ${data.plan.goal.slice(0, 50)}`;
        } else {
          setError('Общий план не найден или ссылка устарела.');
        }
      })
      .catch(err => {
        console.error('Share fetch error:', err);
        setError('Не удалось загрузить план. Проверьте соединение.');
      })
      .finally(() => setLoading(false));
  }, [shareId]);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f3ff] dark:bg-[#0d0d1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center animate-pulse">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <p className="text-slate-500 dark:text-white/50 text-sm">Загружаем план...</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#f4f3ff] dark:bg-[#0d0d1a] flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-slate-900 dark:text-white text-lg" style={{ fontWeight: 700 }}>План не найден</h2>
        <p className="text-slate-500 dark:text-white/50 text-sm text-center max-w-xs">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm hover:opacity-90 transition-all"
          style={{ fontWeight: 600 }}
        >
          На главную
        </button>
      </div>
    );
  }

  const progress = getProgress(plan);
  const totalHours = plan.phases.flatMap(p => p.tasks).reduce((acc, t) => acc + t.duration_hours, 0);
  const doneCount = plan.phases.flatMap(p => p.tasks).filter(t => t.status === 'done').length;
  const totalCount = plan.phases.flatMap(p => p.tasks).length;

  const handleUseAsTemplate = () => {
    if (!plan) return;
    const newId = Math.random().toString(36).slice(2, 10);
    const copy: Plan = {
      ...plan,
      id: newId,
      goal: `${plan.goal} (копия)`,
      created_at: new Date().toISOString().slice(0, 10),
      phases: plan.phases.map(ph => ({
        ...ph,
        id: `phase-${Math.random().toString(36).slice(2, 8)}`,
        tasks: ph.tasks.map(t => ({
          ...t,
          id: Math.random().toString(36).slice(2, 10),
          status: 'todo' as const,
          timer_start: undefined,
          tracked_seconds: undefined,
          comments: [],
        })),
      })),
    };
    savePlan(copy);
    setTemplateCopied(true);
    toast.success('План скопирован как шаблон! Открываю...');
    setTimeout(() => navigate(`/plan/${newId}`), 1200);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-[#f4f3ff] dark:bg-[#0d0d1a] text-slate-900 dark:text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0d0d1a]/95 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }} className="text-slate-900 dark:text-white text-sm">Vecto</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/50 text-xs">
              <Eye className="w-3 h-3" />
              Режим просмотра
            </div>
            {/* Use as template */}
            <button
              onClick={handleUseAsTemplate}
              disabled={templateCopied}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1d4ed8]/30 text-[#1d4ed8] bg-[#1d4ed8]/5 hover:bg-[#1d4ed8]/10 text-xs transition-all disabled:opacity-60"
              style={{ fontWeight: 500 }}
            >
              <Copy className="w-3 h-3" />
              {templateCopied ? 'Скопировано!' : 'Использовать как шаблон'}
            </button>
            <button
              onClick={() => navigate('/new')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-xs hover:opacity-90 transition-all shadow-sm"
              style={{ fontWeight: 600 }}
            >
              Создать свой план
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Goal header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            {plan.phases.slice(0, 6).map(ph => (
              <div key={ph.id} className="w-2.5 h-2.5 rounded-full" style={{ background: ph.color }} />
            ))}
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.5rem' }} className="text-slate-900 dark:text-white mb-1">
            {plan.goal}
          </h1>
          {sharedAt && (
            <p className="text-xs text-slate-400 dark:text-white/30">
              Опубликован {format(parseISO(sharedAt), 'dd MMM yyyy')}
            </p>
          )}
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Прогресс',    value: `${progress}%`,             color: '#1d4ed8', icon: Target },
            { label: 'Выполнено',   value: `${doneCount}/${totalCount}`, color: '#10b981', icon: Flag },
            { label: 'Часов всего', value: `${totalHours}ч`,            color: '#f59e0b', icon: Clock },
            { label: 'Дедлайн',     value: format(parseISO(plan.deadline), 'dd MMM yyyy'), color: '#ef4444', icon: Calendar },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}15` }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <div>
                <div className="text-xs text-slate-400 dark:text-white/40">{stat.label}</div>
                <div className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 600 }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-white/40 mb-1.5">
            <span>Общий прогресс</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#1e40af]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-[#1d4ed8]" />
            <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>Таймл��йн</span>
          </div>
          <TimelineView plan={plan} onTaskClick={() => {}} />
        </div>

        {/* Phases & tasks list */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plan.phases.map((phase, pIdx) => (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pIdx * 0.06 }}
              className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color }} />
                <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>{phase.name}</span>
                <span className="ml-auto text-xs text-slate-400 dark:text-white/40">
                  {phase.tasks.filter(t => t.status === 'done').length}/{phase.tasks.length}
                </span>
              </div>
              <div className="h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${phase.tasks.length ? Math.round((phase.tasks.filter(t => t.status === 'done').length / phase.tasks.length) * 100) : 0}%`,
                    background: phase.color,
                  }}
                />
              </div>
              <div className="space-y-1.5">
                {phase.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2 py-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: PRIORITY_COLORS[task.priority] }}
                    />
                    <span className={`text-xs flex-1 leading-snug ${task.status === 'done' ? 'line-through text-slate-400 dark:text-white/25' : 'text-slate-700 dark:text-white/70'}`}>
                      {task.title}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-white/30 shrink-0">{task.duration_hours}ч</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 dark:text-white/50 mb-3">Хотите создать похожий план для своей цели?</p>
          <button
            onClick={() => navigate('/new')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm hover:opacity-90 transition-all shadow-md shadow-[#1d4ed8]/20"
            style={{ fontWeight: 600 }}
          >
            Создать свой план бесплатно
          </button>
        </div>
      </div>
    </div>
  );
}