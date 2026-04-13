import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, Trash2, Flag, CheckCircle2, X } from 'lucide-react';
import { Priority, TaskStatus } from '../lib/types';

interface Props {
  count: number;
  onMarkDone: () => void;
  onMarkInProgress: () => void;
  onChangePriority: (p: Priority) => void;
  onDelete: () => void;
  onClear: () => void;
}

const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 'high',   label: 'Высокий', color: '#ef4444' },
  { id: 'medium', label: 'Средний', color: '#f59e0b' },
  { id: 'low',    label: 'Низкий',  color: '#10b981' },
];

export function BulkActionBar({ count, onMarkDone, onMarkInProgress, onChangePriority, onDelete, onClear }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl shadow-slate-300/40 dark:shadow-black/50"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Count badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1d4ed8]/10 text-[#1d4ed8] text-xs" style={{ fontWeight: 600 }}>
            <CheckSquare className="w-3.5 h-3.5" />
            {count}
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

          {/* Mark done */}
          <button
            onClick={onMarkDone}
            title="Отметить выполненными"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-white/60 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/8 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Выполнено</span>
          </button>

          {/* Mark in progress */}
          <button
            onClick={onMarkInProgress}
            title="В работу"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-white/60 hover:text-[#1d4ed8] hover:bg-[#1d4ed8]/8 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
            </svg>
            <span className="hidden sm:inline">В работу</span>
          </button>

          {/* Priority dropdown */}
          <div className="relative group">
            <button
              title="Изменить приоритет"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-white/60 hover:text-[#f59e0b] hover:bg-[#f59e0b]/8 transition-all"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Приоритет</span>
            </button>
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col gap-0.5 p-1 bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 min-w-28">
              {PRIORITIES.map(p => (
                <button
                  key={p.id}
                  onClick={() => onChangePriority(p.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-white/8 transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="text-slate-700 dark:text-white/70">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

          {/* Delete */}
          <button
            onClick={onDelete}
            title="Удалить выбранные"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 dark:text-white/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Удалить</span>
          </button>

          {/* Clear selection */}
          <button
            onClick={onClear}
            title="Снять выделение"
            className="p-1.5 rounded-lg text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}