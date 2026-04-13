import { useState, useMemo, useEffect } from 'react';
import { Task, Priority, TaskStatus, RecurrenceInterval, TaskComment, Subtask } from '../lib/types';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Clock, Flag, Calendar, Trash2, Save, Link2, RefreshCw,
  MessageSquare, Search, Play, Square, Plus, Send, Tag, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

interface TaskOption { id: string; title: string; phaseName: string; phaseColor: string }

interface Props {
  task: Task | null;
  phaseColor?: string;
  phaseName?: string;
  allTaskOptions?: TaskOption[];
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  onTimerToggle?: (taskId: string) => void; // called to toggle timer externally
}

const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 'high',   label: 'Высокий', color: '#ef4444' },
  { id: 'medium', label: 'Средний', color: '#f59e0b' },
  { id: 'low',    label: 'Низкий',  color: '#10b981' },
];
const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'todo',        label: 'К выполнению' },
  { id: 'in_progress', label: 'В процессе' },
  { id: 'done',        label: 'Выполнено' },
];
const RECURRENCE_OPTIONS: { id: RecurrenceInterval; label: string }[] = [
  { id: 'daily',    label: 'Каждый день' },
  { id: 'weekly',   label: 'Каждую неделю' },
  { id: 'biweekly', label: 'Раз в 2 недели' },
  { id: 'monthly',  label: 'Раз в месяц' },
];
const RECURRENCE_ICONS: Record<RecurrenceInterval, string> = {
  daily: '📅', weekly: '🗓', biweekly: '📆', monthly: '🗒',
};

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Очень лёгкая', 2: 'Лёгкая', 3: 'Средняя', 4: 'Сложная', 5: 'Очень сложная' };

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${sec}с`;
  return `${sec}с`;
}

export function TaskEditModal({ task, phaseColor, phaseName, allTaskOptions = [], onClose, onSave, onDelete, onTimerToggle }: Props) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [hours, setHours] = useState(task?.duration_hours || 1);
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo');
  const [startDate, setStartDate] = useState(task?.start_date || '');
  const [endDate, setEndDate] = useState(task?.end_date || '');
  const [dependsOn, setDependsOn] = useState<string[]>(task?.depends_on || []);
  const [recurring, setRecurring] = useState(task?.recurring ?? false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(task?.recurrence_interval || 'weekly');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'main' | 'subtasks' | 'deps' | 'recurrence' | 'comments' | 'custom'>('main');

  // Comments
  const [comments, setComments] = useState<TaskComment[]>(task?.comments || []);
  const [newComment, setNewComment] = useState('');

  // Custom fields
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [linkUrl, setLinkUrl] = useState(task?.link_url || '');
  const [difficulty, setDifficulty] = useState<1|2|3|4|5>((task?.difficulty as any) || 3);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [subtaskInput, setSubtaskInput] = useState('');

  // Timer display
  const [elapsedTick, setElapsedTick] = useState(0);
  const isTimerRunning = !!task?.timer_start;
  const trackedSeconds = (task?.tracked_seconds ?? 0) + (isTimerRunning ? elapsedTick : 0);

  useEffect(() => {
    if (!isTimerRunning) return;
    const start = new Date(task!.timer_start!).getTime();
    const update = () => setElapsedTick(Math.floor((Date.now() - start) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, task?.timer_start]);

  if (!task) return null;

  const filteredDeps = useMemo(() => {
    const q = depSearch.toLowerCase();
    return allTaskOptions.filter(t =>
      t.id !== task.id && (!q || t.title.toLowerCase().includes(q) || t.phaseName.toLowerCase().includes(q))
    );
  }, [allTaskOptions, depSearch, task.id]);

  const toggleDep = (id: string) => {
    setDependsOn(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const c: TaskComment = {
      id: Math.random().toString(36).slice(2),
      text: newComment.trim(),
      created_at: new Date().toISOString(),
    };
    setComments(prev => [...prev, c]);
    setNewComment('');
  };

  const removeComment = (id: string) => setComments(prev => prev.filter(c => c.id !== id));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const handleSave = () => {
    onSave(task.id, {
      title,
      description,
      duration_hours: hours,
      priority,
      status,
      start_date: startDate,
      end_date: endDate,
      depends_on: dependsOn,
      recurring,
      recurrence_interval: recurring ? recurrenceInterval : undefined,
      comments,
      tags,
      link_url: linkUrl || undefined,
      difficulty,
      subtasks,
    });
    onClose();
  };

  const inputCls = "w-full bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#1d4ed8]/50 focus:ring-2 focus:ring-[#1d4ed8]/10 transition-colors shadow-sm placeholder-slate-400 dark:placeholder-white/25";

  const addSubtask = () => {
    const t = subtaskInput.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: Math.random().toString(36).slice(2), title: t, done: false }]);
    setSubtaskInput('');
  };

  const toggleSubtask = (id: string) =>
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));

  const removeSubtask = (id: string) =>
    setSubtasks(prev => prev.filter(s => s.id !== id));

  const subtasksDone = subtasks.filter(s => s.done).length;

  const TABS = [
    { id: 'main' as const,       label: 'Основное',   icon: Flag,         badge: null },
    { id: 'subtasks' as const,   label: 'Чеклист',    icon: Plus,         badge: subtasks.length || null },
    { id: 'comments' as const,   label: 'Заметки',    icon: MessageSquare, badge: comments.length || null },
    { id: 'custom' as const,     label: 'Поля',       icon: Tag,           badge: null },
    { id: 'deps' as const,       label: 'Зависит',    icon: Link2,         badge: dependsOn.length || null },
    { id: 'recurrence' as const, label: 'Повтор',     icon: RefreshCw,     badge: null },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="relative w-full sm:max-w-lg bg-white dark:bg-[#13132b] border-0 sm:border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/60 dark:shadow-black/40 max-h-[92vh] sm:max-h-[90vh] flex flex-col"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden sheet-handle shrink-0" />

          {/* Header */}
          <div
            className="px-5 py-4 border-b border-slate-100 dark:border-white/8 flex items-center justify-between bg-slate-50 dark:bg-white/5"
            style={{ borderTop: `3px solid ${phaseColor || '#1d4ed8'}` }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: phaseColor || '#1d4ed8' }} />
                <span className="text-xs text-slate-400 dark:text-white/40">{phaseName}</span>
                {recurring && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/12 text-[#1d4ed8] border border-[#1d4ed8]/20 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" />{RECURRENCE_ICONS[recurrenceInterval]}
                  </span>
                )}
                {/* Timer badge */}
                {trackedSeconds > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#10b981]/12 text-[#10b981] border border-[#10b981]/20 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{formatSeconds(trackedSeconds)}
                  </span>
                )}
              </div>
              <h3 className="text-slate-900 dark:text-white text-sm truncate pr-4" style={{ fontWeight: 600 }}>
                {title || 'Редактировать задачу'}
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Timer toggle */}
              {onTimerToggle && (
                <button
                  onClick={() => onTimerToggle(task.id)}
                  title={isTimerRunning ? 'Остановить таймер' : 'Запустить таймер'}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                    isTimerRunning
                      ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25'
                      : 'bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/40 hover:bg-[#10b981]/10 hover:text-[#10b981]'
                  }`}
                >
                  {isTimerRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isTimerRunning ? 'Стоп' : 'Старт'}
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/3 px-5 gap-0.5 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 text-xs transition-all border-b-2 -mb-px shrink-0 ${
                  activeTab === tab.id
                    ? 'border-[#1d4ed8] text-[#1d4ed8]'
                    : 'border-transparent text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60'
                }`}
                style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
                {tab.badge ? (
                  <span className="w-4 h-4 rounded-full bg-[#1d4ed8] text-white flex items-center justify-center" style={{ fontSize: 9 }}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <AnimatePresence mode="wait">

              {/* ── MAIN ── */}
              {activeTab === 'main' && (
                <motion.div key="main" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>Название задачи</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>
                      <MessageSquare className="w-3.5 h-3.5" /> Описание
                    </label>
                    <textarea
                      value={description} onChange={e => setDescription(e.target.value)} rows={3}
                      placeholder="Контекст, ссылки, детали..."
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>
                        <Clock className="w-3.5 h-3.5" /> Часов (оценка)
                      </label>
                      <input type="number" value={hours} min={0.5} step={0.5} onChange={e => setHours(Number(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>
                        <Clock className="w-3.5 h-3.5" /> Факт. время
                      </label>
                      <div className={`${inputCls} flex items-center justify-between`}>
                        <span className={trackedSeconds > 0 ? 'text-[#10b981]' : 'text-slate-400 dark:text-white/25'}>
                          {trackedSeconds > 0 ? formatSeconds(trackedSeconds) : '—'}
                        </span>
                        {isTimerRunning && (
                          <span className="text-xs text-[#10b981] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                            идёт
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>
                        <Calendar className="w-3.5 h-3.5" /> Начало
                      </label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>
                        <Calendar className="w-3.5 h-3.5" /> Конец
                      </label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-2" style={{ fontWeight: 500 }}>
                      <Flag className="w-3.5 h-3.5" /> Приоритет
                    </label>
                    <div className="flex gap-2">
                      {PRIORITIES.map(p => (
                        <button key={p.id} onClick={() => setPriority(p.id)} className="flex-1 py-2 rounded-lg text-xs transition-all border"
                          style={{ background: priority === p.id ? `${p.color}12` : 'transparent', borderColor: priority === p.id ? p.color : 'rgba(148,163,184,0.35)', color: priority === p.id ? p.color : '#94a3b8', fontWeight: priority === p.id ? 600 : 400 }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-white/40 mb-2 block" style={{ fontWeight: 500 }}>Статус</label>
                    <div className="flex gap-2 flex-wrap">
                      {STATUSES.map(s => (
                        <button key={s.id} onClick={() => setStatus(s.id)} className="px-3 py-1.5 rounded-lg text-xs transition-all border"
                          style={{ background: status === s.id ? 'rgba(29,78,216,0.10)' : 'transparent', borderColor: status === s.id ? '#1d4ed8' : 'rgba(148,163,184,0.35)', color: status === s.id ? '#1d4ed8' : '#94a3b8', fontWeight: status === s.id ? 600 : 400 }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── SUBTASKS ── */}
              {activeTab === 'subtasks' && (
                <motion.div key="subtasks" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-3">
                  <p className="text-xs text-slate-400 dark:text-white/40">Разбейте задачу на небольшие шаги. Прогресс виден на Kanban-карточке.</p>

                  {/* Progress bar */}
                  {subtasks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-white/40 mb-1.5">
                        <span>Выполнено</span>
                        <span style={{ fontWeight: 600 }}>{subtasksDone}/{subtasks.length}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${subtasks.length > 0 ? Math.round((subtasksDone / subtasks.length) * 100) : 0}%`, background: subtasksDone === subtasks.length ? '#10b981' : '#1d4ed8' }} />
                      </div>
                    </div>
                  )}

                  {/* Subtask list */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {subtasks.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2.5 group/sub p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <button onClick={() => toggleSubtask(sub.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${sub.done ? 'bg-[#10b981] border-[#10b981]' : 'border-slate-300 dark:border-white/20'}`}>
                          {sub.done && (
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </button>
                        <span className={`text-sm flex-1 ${sub.done ? 'line-through text-slate-400 dark:text-white/30' : 'text-slate-700 dark:text-white/70'}`}>{sub.title}</span>
                        <button onClick={() => removeSubtask(sub.id)}
                          className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-slate-300 dark:text-white/20 hover:text-red-400 transition-all">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add subtask */}
                  <div className="flex gap-2">
                    <input
                      value={subtaskInput}
                      onChange={e => setSubtaskInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                      placeholder="Добавить шаг..."
                      className={inputCls}
                    />
                    <button onClick={addSubtask}
                      className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── COMMENTS ── */}
              {activeTab === 'comments' && (
                <motion.div key="comments" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-3">
                  <p className="text-xs text-slate-400 dark:text-white/40">Заметки, ссылки и детали по задаче. Сохраняются вместе с планом.</p>

                  {/* Comment list */}
                  {comments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-white/15" />
                      <p className="text-sm text-slate-400 dark:text-white/30">Нет заметок</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {comments.map(c => (
                        <div key={c.id} className="group flex gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1d4ed8]/20 to-[#2563eb]/20 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5 text-[#1d4ed8]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 dark:text-white/40 mb-0.5">
                              {format(new Date(c.created_at), 'dd MMM yyyy HH:mm')}
                            </p>
                            <p className="text-sm text-slate-800 dark:text-white/80 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                          </div>
                          <button
                            onClick={() => removeComment(c.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 dark:text-white/20 hover:text-red-500 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  <div className="flex gap-2 pt-1">
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                      placeholder="Добавить заметку... (Enter для отправки)"
                      rows={2}
                      className={`${inputCls} flex-1 resize-none`}
                    />
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      className="px-3 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors disabled:opacity-40 shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── CUSTOM FIELDS ── */}
              {activeTab === 'custom' && (
                <motion.div key="custom" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-4">
                  {/* Tags */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-2" style={{ fontWeight: 500 }}>
                      <Tag className="w-3.5 h-3.5" /> Теги
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map(t => (
                        <span key={t} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#1d4ed8]/10 text-[#1d4ed8] border border-[#1d4ed8]/20">
                          #{t}
                          <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-500 transition-colors">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTag()}
                        placeholder="Добавить тег..."
                        className={`${inputCls} flex-1`}
                      />
                      <button onClick={addTag} disabled={!tagInput.trim()} className="px-3 rounded-lg bg-[#1d4ed8] text-white text-xs hover:bg-[#1e40af] transition-colors disabled:opacity-40">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Link */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 mb-1.5" style={{ fontWeight: 500 }}>
                      <ExternalLink className="w-3.5 h-3.5" /> Ссылка
                    </label>
                    <div className="relative">
                      <input
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className={`${inputCls} pr-10`}
                      />
                      {linkUrl && (
                        <a href={linkUrl} target="_blank" rel="noreferrer"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1d4ed8] hover:text-[#1e40af] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="text-xs text-slate-500 dark:text-white/40 mb-2 block" style={{ fontWeight: 500 }}>
                      Сложность: <span className="text-slate-700 dark:text-white/70">{DIFFICULTY_LABELS[difficulty]}</span>
                    </label>
                    <div className="flex gap-1.5">
                      {([1, 2, 3, 4, 5] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className="flex-1 py-2 rounded-lg text-sm transition-all"
                          style={{
                            background: difficulty >= d ? '#1d4ed815' : 'transparent',
                            border: `1px solid ${difficulty >= d ? '#1d4ed8' : 'rgba(148,163,184,0.3)'}`,
                          }}
                        >
                          {'⬡'.repeat(0) /* just a placeholder */}
                          <span style={{ color: difficulty >= d ? '#1d4ed8' : '#94a3b8' }}>{'●'}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 dark:text-white/30 mt-1 px-1">
                      <span>Легко</span><span>Сложно</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── DEPS ── */}
              {activeTab === 'deps' && (
                <motion.div key="deps" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                  <p className="text-xs text-slate-500 dark:text-white/40 mb-3">
                    Эта задача не может начаться до завершения выбранных задач.
                  </p>
                  {dependsOn.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-lg bg-[#1d4ed8]/5 border border-[#1d4ed8]/15">
                      {dependsOn.map(depId => {
                        const opt = allTaskOptions.find(t => t.id === depId);
                        if (!opt) return null;
                        return (
                          <span key={depId} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white dark:bg-white/10 border border-[#1d4ed8]/25 text-[#1d4ed8]">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.phaseColor }} />
                            {opt.title.length > 28 ? opt.title.slice(0, 28) + '…' : opt.title}
                            <button onClick={() => toggleDep(depId)} className="ml-1 hover:text-red-500 transition-colors">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-white/30" />
                    <input value={depSearch} onChange={e => setDepSearch(e.target.value)} placeholder="Поиск задач..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#1d4ed8]/50 transition-colors placeholder-slate-400 dark:placeholder-white/25" />
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {filteredDeps.length === 0 && <p className="text-xs text-slate-400 dark:text-white/30 text-center py-6">Задачи не найдены</p>}
                    {filteredDeps.map(opt => {
                      const isSel = dependsOn.includes(opt.id);
                      return (
                        <button key={opt.id} onClick={() => toggleDep(opt.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left"
                          style={{ background: isSel ? 'rgba(99,102,241,0.06)' : 'transparent', borderColor: isSel ? 'rgba(99,102,241,0.3)' : 'rgba(148,163,184,0.25)' }}>
                          <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                            style={{ borderColor: isSel ? '#1d4ed8' : '#cbd5e1', background: isSel ? '#1d4ed8' : 'transparent' }}>
                            {isSel && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.phaseColor }} />
                            <span className="text-xs text-slate-500 dark:text-white/40 shrink-0">{opt.phaseName} ·</span>
                            <span className="text-xs text-slate-900 dark:text-white truncate">{opt.title}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ─ RECURRENCE ── */}
              {activeTab === 'recurrence' && (
                <motion.div key="recurrence" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                    <div>
                      <div className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 500 }}>Повторяющаяся задача</div>
                      <div className="text-xs text-slate-400 dark:text-white/40 mt-0.5">Задача будет выполняться регулярно</div>
                    </div>
                    <button onClick={() => setRecurring(r => !r)}
                      className={`relative w-11 h-6 rounded-full transition-all ${recurring ? 'bg-[#1d4ed8]' : 'bg-slate-300 dark:bg-white/15'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${recurring ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {recurring && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="space-y-2 pt-1">
                          <label className="text-xs text-slate-500 dark:text-white/40" style={{ fontWeight: 500 }}>Интервал</label>
                          {RECURRENCE_OPTIONS.map(opt => (
                            <button key={opt.id} onClick={() => setRecurrenceInterval(opt.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                              style={{ background: recurrenceInterval === opt.id ? 'rgba(99,102,241,0.08)' : 'transparent', borderColor: recurrenceInterval === opt.id ? 'rgba(99,102,241,0.4)' : 'rgba(148,163,184,0.25)' }}>
                              <span className="text-lg">{RECURRENCE_ICONS[opt.id]}</span>
                              <span className="text-sm text-slate-900 dark:text-white">{opt.label}</span>
                              {recurrenceInterval === opt.id && (
                                <div className="ml-auto w-4 h-4 rounded-full bg-[#1d4ed8] flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!recurring && (
                    <div className="text-center py-6 text-slate-400 dark:text-white/30">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Включите повтор, чтобы задача выполнялась регулярно</p>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/3 flex items-center justify-between gap-3 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-white/30 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Удалить
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500">Удалить задачу?</span>
                <button onClick={() => { onDelete(task.id); onClose(); }} className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-xs hover:bg-red-100 transition-colors">Да</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 text-xs hover:bg-slate-200 transition-colors">Нет</button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all">
                Отмена
              </button>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1d4ed8] text-white text-sm hover:bg-[#1e40af] transition-all shadow-sm" style={{ fontWeight: 500 }}>
                <Save className="w-3.5 h-3.5" />Сохранить
              </button>
            </div>
          </div>

          {/* Bottom safe area padding — mobile only */}
          <div className="sm:hidden shrink-0" style={{ height: 'env(safe-area-inset-bottom)', minHeight: 8 }} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}