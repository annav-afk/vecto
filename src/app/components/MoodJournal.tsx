/**
 * MoodJournal — Quick mood recording widget + mood→productivity correlation.
 * Uses patternTracker.recordMood() to store mood entries with optional notes.
 * Displays a mini mood picker + historical correlation chart + note timeline.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Smile, Meh, Frown, CloudRain, Sun, TrendingUp,
  X, Check, ChevronDown, MessageSquare, PenLine,
} from 'lucide-react';
import { recordMood, computeLocalInsights, getRawPatterns } from '../lib/patternTracker';
import { playClick, playComplete } from '../lib/sounds';
import { format } from 'date-fns';

// ── Mood levels ──────────────────────────────────────────────────────────────
const MOODS = [
  { value: 1, emoji: '😩', label: 'Ужасно',    icon: CloudRain, color: '#ef4444', bg: 'bg-red-500/12',     border: 'border-red-500/25' },
  { value: 2, emoji: '😔', label: 'Плохо',     icon: Frown,     color: '#f97316', bg: 'bg-orange-500/12',  border: 'border-orange-500/25' },
  { value: 3, emoji: '😐', label: 'Нормально', icon: Meh,       color: '#eab308', bg: 'bg-yellow-500/12',  border: 'border-yellow-500/25' },
  { value: 4, emoji: '😊', label: 'Хорошо',    icon: Smile,     color: '#22c55e', bg: 'bg-emerald-500/12', border: 'border-emerald-500/25' },
  { value: 5, emoji: '🤩', label: 'Отлично!',  icon: Sun,       color: '#1d4ed8', bg: 'bg-[#1d4ed8]/12',   border: 'border-[#1d4ed8]/25' },
];

const MOOD_CHECK_KEY = 'stride_mood_last_check';
const MOOD_DISMISS_KEY = 'stride_mood_dismissed_today';

// Quick note suggestions depending on mood
const NOTE_SUGGESTIONS: Record<number, string[]> = {
  1: ['Мало спал', 'Стресс на работе', 'Проблемы со здоровьем', 'Перегорание'],
  2: ['Усталость', 'Слишком много задач', 'Не хватает мотивации', 'Рутина достала'],
  3: ['Обычный день', 'Работаю по инерции', 'Нет вдохновения', 'Стабильно'],
  4: ['Хороший сон', 'Интересные задачи', 'Прогулялся', 'Кофе помог'],
  5: ['Всё получается', 'Супер продуктивный', 'Вдохновлён', 'Завершил важное'],
};

// ── Should show mood check (once every 4 hours) ─────────────────────────────
export function shouldShowMoodCheck(): boolean {
  try {
    const dismissed = localStorage.getItem(MOOD_DISMISS_KEY);
    if (dismissed === format(new Date(), 'yyyy-MM-dd')) return false;

    const last = localStorage.getItem(MOOD_CHECK_KEY);
    if (!last) return true;
    return Date.now() - Number(last) > 4 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markMoodChecked() {
  try { localStorage.setItem(MOOD_CHECK_KEY, String(Date.now())); } catch {}
}

function dismissMoodToday() {
  try { localStorage.setItem(MOOD_DISMISS_KEY, format(new Date(), 'yyyy-MM-dd')); } catch {}
}

// ── Compact mood picker (floating) ──────────────────────────────────────────
export function MoodPickerFloat({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showNote && noteRef.current) {
      setTimeout(() => noteRef.current?.focus(), 120);
    }
  }, [showNote]);

  const handleSelect = (mood: number) => {
    playClick();
    setSelected(mood);
    setNote('');
    setShowNote(false);
  };

  const handleSave = () => {
    if (selected === null) return;
    const trimmed = note.trim() || undefined;
    recordMood(selected, trimmed);
    markMoodChecked();
    playComplete();
    setSaved(true);
    setTimeout(onClose, 1200);
  };

  const handleDismiss = () => {
    dismissMoodToday();
    playClick();
    onClose();
  };

  const handleSuggestionClick = (text: string) => {
    playClick();
    setNote(prev => (prev ? `${prev}, ${text.toLowerCase()}` : text));
  };

  const suggestions = selected ? (NOTE_SUGGESTIONS[selected] ?? []) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-[340px] z-50 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(10,15,30,0.95)',
        border: '1px solid rgba(29,78,216,0.2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(29,78,216,0.15)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center"
            >
              <Check className="w-7 h-7 text-emerald-400" />
            </motion.div>
            <p className="text-sm font-semibold text-white">Записано!</p>
            <p className="text-xs text-white/40 mt-1">
              {note.trim() ? 'Заметка сохранена — Томи учтёт контекст' : 'Томи учтёт это в анализе'}
            </p>
          </motion.div>
        ) : (
          <motion.div key="picker" exit={{ opacity: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-400" />
                <span className="text-sm font-semibold text-white">Как настроение?</span>
              </div>
              <button
                onClick={handleDismiss}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="px-4 text-xs text-white/35 mb-3">
              Томи отслеживает корреляцию настроения и продуктивности
            </p>

            {/* Mood buttons */}
            <div className="px-4 pb-2 flex gap-2">
              {MOODS.map((m) => (
                <motion.button
                  key={m.value}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSelect(m.value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ${
                    selected === m.value
                      ? `${m.bg} ${m.border} ring-1`
                      : 'border-white/6 bg-white/3 hover:bg-white/6'
                  }`}
                  style={selected === m.value ? { ringColor: m.color } : {}}
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <span className={`text-[9px] ${selected === m.value ? 'text-white/80' : 'text-white/35'}`}>
                    {m.label}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Note section — appears after mood is selected */}
            <AnimatePresence>
              {selected !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pt-2 pb-1">
                    {!showNote ? (
                      <button
                        onClick={() => { playClick(); setShowNote(true); }}
                        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
                      >
                        <PenLine className="w-3 h-3" />
                        Добавить заметку — что повлияло?
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="w-3 h-3 text-white/40" />
                          <span className="text-[11px] text-white/40 font-medium">Что повлияло на настроение?</span>
                        </div>
                        <textarea
                          ref={noteRef}
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Мало спал, стресс, интересный проект..."
                          rows={2}
                          maxLength={200}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-[#1d4ed8]/40 transition-colors"
                        />
                        {/* Quick suggestion chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.map(s => (
                            <button
                              key={s}
                              onClick={() => handleSuggestionClick(s)}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-[10px] text-white/40 hover:text-white/60 hover:bg-white/8 transition-all active:scale-95"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-white/15">{note.length}/200</span>
                          <button
                            onClick={() => { setShowNote(false); setNote(''); }}
                            className="text-[10px] text-white/25 hover:text-white/40 transition-colors"
                          >
                            Убрать заметку
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save */}
            <div className="px-4 pt-2 pb-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={selected === null}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  selected !== null
                    ? 'bg-[#1d4ed8] text-white hover:bg-[#1e40af] shadow-lg shadow-[#1d4ed8]/30'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {note.trim() ? 'Записать с заметкой' : 'Записать настроение'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Mood history widget (for dashboard/insights) ────────────────────────────
export function MoodHistoryWidget() {
  const patterns = getRawPatterns();
  const insights = computeLocalInsights();
  const [expanded, setExpanded] = useState(false);

  if (patterns.moodEntries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4 text-pink-400" />
          <h3 className="text-sm font-semibold text-white/90">Журнал настроения</h3>
        </div>
        <p className="text-xs text-white/35">
          Ещё нет записей. Томи будет спрашивать о настроении — данные появятся здесь.
        </p>
      </div>
    );
  }

  // Last 7 entries
  const recent = patterns.moodEntries.slice(-7);
  const avgMood = recent.reduce((s, e) => s + e.mood, 0) / recent.length;
  const notedEntries = patterns.moodEntries.filter(e => e.note).slice(-10).reverse();

  // Mood → Productivity correlation data
  const moodProd = insights.moodVsProductivity;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400" />
          <h3 className="text-sm font-semibold text-white/90">Журнал настроения</h3>
          {notedEntries.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-400 font-medium">
              {notedEntries.length} заметок
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1"
        >
          {expanded ? 'Свернуть' : 'Подробнее'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Recent mood timeline */}
      <div className="flex items-end gap-1.5 mb-3">
        {recent.map((entry, i) => {
          const m = MOODS[entry.mood - 1];
          return (
            <motion.div
              key={entry.ts}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              <span className="text-base leading-none">{m?.emoji ?? '?'}</span>
              {/* Note indicator dot */}
              {entry.note && (
                <div className="absolute -top-1 -right-0.5 w-2 h-2 rounded-full bg-pink-400/80" />
              )}
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${(entry.mood / 5) * 32 + 4}px`,
                  backgroundColor: m?.color ?? '#666',
                  opacity: 0.5 + (i / recent.length) * 0.5,
                }}
              />
              <span className="text-[8px] text-white/20">
                {format(new Date(entry.ts), 'dd.MM')}
              </span>
              {/* Tooltip for note */}
              {entry.note && (
                <div className="absolute bottom-full mb-8 left-1/2 -translate-x-1/2 w-32 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  <div className="bg-black/90 rounded-lg p-2 text-[9px] text-white/70 leading-relaxed shadow-xl border border-white/10">
                    "{entry.note}"
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Average */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-white/40">Среднее:</span>
        <span className="text-sm font-semibold text-white">
          {MOODS[Math.round(avgMood) - 1]?.emoji} {avgMood.toFixed(1)}/5
        </span>
      </div>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Note timeline */}
            {notedEntries.length > 0 && (
              <div className="pt-3 border-t border-white/6 mt-2 mb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                  <span className="text-xs font-semibold text-white/70">Заметки о настроении</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {notedEntries.map(entry => {
                    const m = MOODS[entry.mood - 1];
                    return (
                      <motion.div
                        key={entry.ts}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2.5 group"
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center pt-1 shrink-0">
                          <span className="text-sm leading-none">{m?.emoji}</span>
                          <div className="w-px h-full bg-white/6 mt-1" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] text-white/30">
                              {format(new Date(entry.ts), 'dd.MM · HH:mm')}
                            </span>
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: m?.color }}
                            />
                          </div>
                          <p className="text-xs text-white/55 leading-relaxed">
                            {entry.note}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mood → Productivity correlation */}
            {moodProd.length > 0 && (
              <div className={`${notedEntries.length > 0 ? '' : 'pt-3 border-t border-white/6 mt-2'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-white/70">Настроение и продуктивность</span>
                </div>
                <div className="space-y-1.5">
                  {moodProd.map(mp => {
                    const m = MOODS[mp.mood - 1];
                    const maxComp = Math.max(...moodProd.map(x => x.avgCompletions), 1);
                    const pct = (mp.avgCompletions / maxComp) * 100;
                    return (
                      <div key={mp.mood} className="flex items-center gap-2">
                        <span className="text-sm w-6 text-center">{m?.emoji}</span>
                        <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: m?.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 5)}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        <span className="text-[10px] text-white/40 w-12 text-right">
                          {mp.avgCompletions} задач
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-white/25 mt-2">
                  Среднее число завершённых задач в дни с данным настроением
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
