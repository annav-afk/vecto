import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flag, CheckCircle2, Circle, Plus, Sparkles, X, ChevronDown, ChevronUp, Trophy, Trash2,
} from 'lucide-react';
import { Plan, Milestone, Phase } from '../lib/types';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';
import { TomiAvatar } from './TomiAssistant';
import { format, parseISO, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

interface Props {
  plan: Plan;
  onUpdateMilestones: (milestones: Milestone[]) => void;
}

export function MilestoneTracker({ plan, onUpdateMilestones }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  const milestones = plan.milestones ?? [];
  const reached = milestones.filter(m => m.reached).length;

  const generateMilestones = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${SERVER}/ai/generate-milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          goal: plan.goal,
          deadline: plan.deadline,
          phases: plan.phases.map(ph => ({ name: ph.name, start_date: ph.start_date, end_date: ph.end_date, tasks: ph.tasks })),
        }),
      });
      const data = await res.json();
      if (data.milestones?.length) {
        const newMs: Milestone[] = data.milestones.map((m: any) => ({
          id: Math.random().toString(36).slice(2, 10),
          title: m.title,
          description: m.description,
          target_date: m.target_date,
          phase_id: m.phase_id || null,
          criteria: m.criteria ?? [],
          reached: false,
        }));
        onUpdateMilestones([...milestones, ...newMs]);
        toast.success(`${newMs.length} вех добавлено`);
      }
    } catch (err) {
      console.error('Generate milestones error:', err);
      toast.error('Ошибка генерации вех');
    }
    setGenerating(false);
  };

  const toggleMilestone = (id: string) => {
    const updated = milestones.map(m =>
      m.id === id ? { ...m, reached: !m.reached, reached_date: !m.reached ? new Date().toISOString() : undefined } : m
    );
    onUpdateMilestones(updated);
    const ms = updated.find(m => m.id === id);
    if (ms?.reached) toast.success(`Веха достигнута: ${ms.title}!`);
  };

  const deleteMilestone = (id: string) => {
    onUpdateMilestones(milestones.filter(m => m.id !== id));
    toast.success('Веха удалена');
  };

  const addManual = () => {
    if (!newTitle.trim()) return;
    const ms: Milestone = {
      id: Math.random().toString(36).slice(2, 10),
      title: newTitle.trim(),
      target_date: newDate || plan.deadline,
      criteria: [],
      reached: false,
    };
    onUpdateMilestones([...milestones, ms]);
    setNewTitle('');
    setNewDate('');
    setAddingManual(false);
    toast.success('Веха добавлена');
  };

  const getPhaseName = (phaseId?: string) => {
    if (!phaseId) return null;
    return plan.phases.find(p => p.id === phaseId)?.name;
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(s => !s)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/3 transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-[#1d4ed8]/10 flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-[#1d4ed8]" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Вехи проекта
            {milestones.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400 dark:text-white/40">
                {reached}/{milestones.length}
              </span>
            )}
          </p>
          {milestones.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {milestones.map(m => (
                <div key={m.id}
                  className={`w-2 h-2 rounded-full transition-all ${m.reached ? 'bg-[#10b981]' : isPast(parseISO(m.target_date)) ? 'bg-red-400' : 'bg-slate-300 dark:bg-white/20'}`} />
              ))}
            </div>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-white/8 pt-3">
              {milestones.length === 0 && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-2">
                    <TomiAvatar size={40} mood="focused" />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-white/40 mb-3">
                    Добавьте ключевые вехи проекта для отслеживания прогресса
                  </p>
                </div>
              )}

              {/* Milestones list */}
              {milestones.map(m => {
                const isOverdue = !m.reached && isPast(parseISO(m.target_date));
                return (
                  <motion.div key={m.id} layout
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${
                      m.reached
                        ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5'
                        : isOverdue
                        ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/3'
                    }`}
                  >
                    <button onClick={() => toggleMilestone(m.id)} className="mt-0.5 shrink-0">
                      {m.reached ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 dark:text-white/20 hover:text-[#1d4ed8] transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${m.reached ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-slate-800 dark:text-white/90'}`}>
                        {m.title}
                      </p>
                      {m.description && <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">{m.description}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] ${isOverdue && !m.reached ? 'text-red-500' : 'text-slate-400 dark:text-white/30'}`}>
                          {format(parseISO(m.target_date), 'dd MMM yyyy', { locale: ru })}
                        </span>
                        {getPhaseName(m.phase_id) && (
                          <span className="text-[10px] text-[#1d4ed8] bg-[#1d4ed8]/8 px-1.5 py-0.5 rounded">
                            {getPhaseName(m.phase_id)}
                          </span>
                        )}
                        {m.reached && m.reached_date && (
                          <span className="text-[10px] text-emerald-500">
                            Достигнута {format(parseISO(m.reached_date), 'dd MMM', { locale: ru })}
                          </span>
                        )}
                      </div>
                      {m.criteria.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {m.criteria.map((c, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-white/40">
                              <div className={`w-1 h-1 rounded-full ${m.reached ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                              {c}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteMilestone(m.id)}
                      className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </motion.div>
                );
              })}

              {/* Add manual */}
              <AnimatePresence>
                {addingManual && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="flex gap-2">
                      <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название вехи..."
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none"
                        onKeyDown={e => { if (e.key === 'Enter') addManual(); }} autoFocus />
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                        className="text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none w-32" />
                      <button onClick={addManual} className="px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-semibold">+</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setAddingManual(s => !s)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-slate-500 dark:text-white/40 border border-dashed border-slate-200 dark:border-white/10 hover:border-[#1d4ed8]/30 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/5 transition-all">
                  <Plus className="w-3 h-3" /> Вручную
                </button>
                <button onClick={generateMilestones} disabled={generating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-[#1d4ed8] border border-[#1d4ed8]/25 bg-[#1d4ed8]/5 hover:bg-[#1d4ed8]/10 transition-all disabled:opacity-50 font-semibold">
                  {generating ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-3 h-3 border-2 border-[#1d4ed8]/30 border-t-[#1d4ed8] rounded-full" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {generating ? 'Генерация...' : 'AI вехи'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
