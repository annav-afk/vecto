import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, GripVertical, ChevronUp, ChevronDown, Merge, Scissors,
  Trash2, Plus, Sparkles, RotateCcw, ArrowRightLeft, Pencil,
} from 'lucide-react';
import { Plan, Phase, Task } from '../lib/types';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';
import { TomiAvatar } from './TomiAssistant';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

interface Props {
  plan: Plan;
  onApply: (updated: Plan) => void;
  onClose: () => void;
}

export function PlanStructureEditor({ plan, onApply, onClose }: Props) {
  const [phases, setPhases] = useState<Phase[]>(() => JSON.parse(JSON.stringify(plan.phases)));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [regenPhaseIdx, setRegenPhaseIdx] = useState<number | null>(null);
  const [regenFeedback, setRegenFeedback] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [tomiComment, setTomiComment] = useState('');
  const [editingName, setEditingName] = useState<number | null>(null);
  const [taskDrag, setTaskDrag] = useState<{ phaseIdx: number; taskIdx: number } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const movePhase = (from: number, to: number) => {
    const next = [...phases];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPhases(next);
  };

  const mergePhases = (idx: number) => {
    if (idx >= phases.length - 1) return;
    const next = [...phases];
    const merged: Phase = {
      ...next[idx],
      name: `${next[idx].name} + ${next[idx + 1].name}`,
      end_date: next[idx + 1].end_date,
      duration_days: next[idx].duration_days + next[idx + 1].duration_days,
      tasks: [...next[idx].tasks, ...next[idx + 1].tasks.map(t => ({ ...t, phase_id: next[idx].id }))],
    };
    next.splice(idx, 2, merged);
    setPhases(next);
    toast.success('Фазы объединены');
  };

  const splitPhase = (idx: number) => {
    const phase = phases[idx];
    if (phase.tasks.length < 2) { toast.error('Нужно хотя бы 2 задачи'); return; }
    const mid = Math.ceil(phase.tasks.length / 2);
    const id1 = phase.id;
    const id2 = Math.random().toString(36).slice(2, 10);
    const p1: Phase = { ...phase, id: id1, name: phase.name + ' (ч.1)', tasks: phase.tasks.slice(0, mid) };
    const p2: Phase = {
      ...phase, id: id2, name: phase.name + ' (ч.2)',
      tasks: phase.tasks.slice(mid).map(t => ({ ...t, phase_id: id2 })),
    };
    const next = [...phases];
    next.splice(idx, 1, p1, p2);
    setPhases(next);
    toast.success('Фаза разделена');
  };

  const deletePhase = (idx: number) => {
    if (phases.length <= 1) { toast.error('Нельзя удалить единственную фазу'); return; }
    setPhases(prev => prev.filter((_, i) => i !== idx));
    toast.success('Фаза удалена');
  };

  const addPhase = () => {
    const id = Math.random().toString(36).slice(2, 10);
    const lastPhase = phases[phases.length - 1];
    const newPhase: Phase = {
      id,
      name: 'Новый этап',
      duration_days: 14,
      color: ['#1d4ed8', '#2563eb', '#1e40af', '#10b981', '#f59e0b'][phases.length % 5],
      start_date: lastPhase?.end_date || new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      tasks: [],
    };
    setPhases(prev => [...prev, newPhase]);
    setEditingName(phases.length);
  };

  const renamePhase = (idx: number, name: string) => {
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, name } : p));
  };

  const moveTaskBetweenPhases = (fromPhaseIdx: number, taskIdx: number, toPhaseIdx: number) => {
    const next = [...phases];
    const [task] = next[fromPhaseIdx].tasks.splice(taskIdx, 1);
    task.phase_id = next[toPhaseIdx].id;
    next[toPhaseIdx].tasks.push(task);
    setPhases(next);
    toast.success('Задача перенесена');
  };

  const regeneratePhase = async (idx: number) => {
    setRegenLoading(true);
    setTomiComment('');
    try {
      const phase = phases[idx];
      const res = await fetch(`${SERVER}/ai/regenerate-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          goal: plan.goal,
          deadline: plan.deadline,
          hoursPerWeek: plan.hours_per_week,
          phaseName: phase.name,
          phaseIndex: idx,
          totalPhases: phases.length,
          feedback: regenFeedback,
          existingTasks: phase.tasks.map(t => ({ title: t.title, priority: t.priority })),
        }),
      });
      const data = await res.json();
      if (data.tasks?.length) {
        const newTasks: Task[] = data.tasks.map((t: any) => ({
          id: Math.random().toString(36).slice(2, 10),
          phase_id: phase.id,
          title: t.title,
          description: t.description || '',
          duration_hours: t.duration_hours || 2,
          priority: t.priority || 'medium',
          depends_on: [],
          status: 'todo' as const,
          start_date: phase.start_date,
          end_date: phase.end_date,
          tags: [],
          subtasks: (t.subtasks || []).map((s: any) => ({
            id: Math.random().toString(36).slice(2, 10),
            title: s.title,
            done: false,
          })),
        }));
        setPhases(prev => prev.map((p, i) => i === idx ? { ...p, tasks: newTasks } : p));
        setTomiComment(data.tomiComment || 'Фаза перегенерирована!');
        toast.success(`Фаза обновлена: ${newTasks.length} задач`);
      } else {
        toast.error('AI не вернул задачи');
      }
    } catch (err) {
      console.error('Regenerate phase error:', err);
      toast.error('Ошибка перегенерации');
    }
    setRegenLoading(false);
  };

  const handleApply = () => {
    onApply({ ...plan, phases });
    onClose();
  };

  const hasChanges = JSON.stringify(plan.phases) !== JSON.stringify(phases);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-2xl bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1d4ed8]/10 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-[#1d4ed8]" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white text-sm font-bold">Структура плана</h2>
              <p className="text-slate-400 dark:text-white/40 text-xs">Перестроить фазы, задачи и зависимости</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Phases list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {phases.map((phase, idx) => (
            <motion.div
              key={phase.id}
              layout
              className={`rounded-xl border transition-all ${
                overIdx === idx ? 'border-[#1d4ed8] bg-[#1d4ed8]/5' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'
              }`}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setOverIdx(idx); }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== idx) movePhase(dragIdx, idx);
                setDragIdx(null); setOverIdx(null);
              }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            >
              {/* Phase header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <GripVertical className="w-4 h-4 text-slate-300 dark:text-white/20 cursor-grab shrink-0" />
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color }} />

                {editingName === idx ? (
                  <input
                    ref={nameInputRef}
                    value={phase.name}
                    onChange={e => renamePhase(idx, e.target.value)}
                    onBlur={() => setEditingName(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingName(null); }}
                    autoFocus
                    className="flex-1 text-sm font-semibold text-slate-900 dark:text-white bg-transparent border-b border-[#1d4ed8] focus:outline-none"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-semibold text-slate-800 dark:text-white/90 cursor-pointer hover:text-[#1d4ed8] transition-colors"
                    onClick={() => setEditingName(idx)}
                  >
                    {phase.name}
                  </span>
                )}

                <span className="text-xs text-slate-400 dark:text-white/30 shrink-0">
                  {phase.tasks.length} задач
                </span>

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => setEditingName(idx)} className="p-1 rounded text-slate-400 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/10 transition-all" title="Переименовать">
                    <Pencil className="w-3 h-3" />
                  </button>
                  {idx > 0 && (
                    <button onClick={() => movePhase(idx, idx - 1)} className="p-1 rounded text-slate-400 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/10 transition-all" title="Вверх">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {idx < phases.length - 1 && (
                    <button onClick={() => movePhase(idx, idx + 1)} className="p-1 rounded text-slate-400 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/10 transition-all" title="Вниз">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {idx < phases.length - 1 && (
                    <button onClick={() => mergePhases(idx)} className="p-1 rounded text-slate-400 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/10 transition-all" title="Объединить со следующей">
                      <Merge className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {phase.tasks.length >= 2 && (
                    <button onClick={() => splitPhase(idx)} className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all" title="Разделить">
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setRegenPhaseIdx(regenPhaseIdx === idx ? null : idx)} className="p-1 rounded text-slate-400 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/10 transition-all" title="AI перегенерация">
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deletePhase(idx)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all" title="Удалить">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Tasks (compact list with drag-to-move) */}
              <div className="px-3 pb-2">
                {phase.tasks.map((task, tIdx) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs text-slate-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/5 cursor-grab transition-all group"
                    draggable
                    onDragStart={e => {
                      e.stopPropagation();
                      setTaskDrag({ phaseIdx: idx, taskIdx: tIdx });
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.stopPropagation();
                      if (taskDrag && taskDrag.phaseIdx !== idx) {
                        moveTaskBetweenPhases(taskDrag.phaseIdx, taskDrag.taskIdx, idx);
                      }
                      setTaskDrag(null);
                    }}
                  >
                    <GripVertical className="w-3 h-3 text-slate-300 dark:text-white/15 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                      background: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981',
                    }} />
                    <span className={`flex-1 truncate ${task.status === 'done' ? 'line-through text-slate-400 dark:text-white/25' : ''}`}>
                      {task.title}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-white/25">{task.duration_hours}ч</span>
                  </div>
                ))}
                {phase.tasks.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-white/25 italic py-2 text-center">Перетащите задачи сюда</p>
                )}
              </div>

              {/* Regenerate panel */}
              <AnimatePresence>
                {regenPhaseIdx === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100 dark:border-white/8"
                  >
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <TomiAvatar size={28} mood="focused" />
                        <p className="text-xs text-slate-500 dark:text-white/50">
                          {tomiComment || 'Опишите, что хотите изменить, и Томи перегенерирует задачи'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={regenFeedback}
                          onChange={e => setRegenFeedback(e.target.value)}
                          placeholder="Сделай задачи более конкретными..."
                          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-[#1d4ed8]/40"
                          onKeyDown={e => { if (e.key === 'Enter') regeneratePhase(idx); }}
                        />
                        <button
                          onClick={() => regeneratePhase(idx)}
                          disabled={regenLoading}
                          className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-semibold hover:bg-[#1e40af] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {regenLoading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          {regenLoading ? 'AI...' : 'Перегенерировать'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {/* Add phase */}
          <button onClick={addPhase}
            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/30 hover:border-[#1d4ed8]/40 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/5 transition-all flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Добавить фазу
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-white/8 shrink-0">
          <p className="text-xs text-slate-400 dark:text-white/30">
            {phases.length} фаз · {phases.reduce((s, p) => s + p.tasks.length, 0)} задач
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-white/50 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              Отмена
            </button>
            <button onClick={handleApply} disabled={!hasChanges}
              className="px-5 py-2 rounded-xl text-sm text-white bg-[#1d4ed8] hover:bg-[#1e40af] transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#1d4ed8]/25">
              Применить
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
