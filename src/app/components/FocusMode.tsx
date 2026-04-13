import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, RotateCcw, CheckCircle, Clock, Flag, Brain, Settings } from 'lucide-react';
import { Task, TaskStatus } from '../lib/types';

interface Props {
  task: Task;
  phaseColor: string;
  phaseName: string;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onNotesChange: (taskId: string, notes: string) => void;
}

const WORK_PRESETS = [
  { label: '15 мин', seconds: 15 * 60 },
  { label: '25 мин', seconds: 25 * 60 },
  { label: '45 мин', seconds: 45 * 60 },
  { label: '60 мин', seconds: 60 * 60 },
];
const BREAK_PRESETS = [
  { label: '3 мин', seconds: 3 * 60 },
  { label: '5 мин', seconds: 5 * 60 },
  { label: '10 мин', seconds: 10 * 60 },
  { label: '15 мин', seconds: 15 * 60 },
];

type TimerMode = 'work' | 'break';

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const PRIORITY_LABELS = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

function pad(n: number) { return String(n).padStart(2, '0'); }

function CircleProgress({ progress }: { progress: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress);

  return (
    <svg width="140" height="140" className="absolute inset-0">
      <circle cx="70" cy="70" r={r} fill="none" strokeWidth="4" stroke="rgba(29,78,216,0.12)" />
      <circle
        cx="70" cy="70" r={r} fill="none" strokeWidth="4"
        stroke="#1d4ed8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dash}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

export function FocusMode({ task, phaseColor, phaseName, onClose, onStatusChange, onNotesChange }: Props) {
  const [mode, setMode] = useState<TimerMode>('work');
  const [workSeconds, setWorkSeconds] = useState(25 * 60);
  const [breakSeconds, setBreakSeconds] = useState(5 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [pomodorosCompleted, setPomodorosCompleted] = useState(0);
  const [notes, setNotes] = useState(task.description ?? '');
  const [done, setDone] = useState(task.status === 'done');
  const [showSettings, setShowSettings] = useState(false);

  const totalSeconds = mode === 'work' ? workSeconds : breakSeconds;
  const progress = (totalSeconds - secondsLeft) / totalSeconds;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          setRunning(false);
          if (mode === 'work') {
            setPomodorosCompleted(p => p + 1);
            setMode('break');
            setSecondsLeft(breakSeconds);
          } else {
            setMode('work');
            setSecondsLeft(workSeconds);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode, workSeconds, breakSeconds]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(mode === 'work' ? workSeconds : breakSeconds);
  };

  const handleMarkDone = () => {
    setDone(true);
    onStatusChange(task.id, 'done');
    if (notes !== task.description) onNotesChange(task.id, notes);
    setTimeout(onClose, 800);
  };

  const handleClose = () => {
    if (notes !== task.description) onNotesChange(task.id, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#07071a]"
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Topbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/40">Режим фокуса</p>
              <p className="text-sm text-white" style={{ fontWeight: 500 }}>Vecto</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Timer */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 gap-8">
            {/* Mode tabs */}
            <div className="flex items-center gap-2 bg-white/8 rounded-xl p-1">
              {(['work', 'break'] as TimerMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setRunning(false); setMode(m); setSecondsLeft(m === 'work' ? workSeconds : breakSeconds); }}
                  className={`px-4 py-1.5 rounded-lg text-sm transition-all ${m === mode ? 'bg-[#1d4ed8] text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                  style={{ fontWeight: m === mode ? 600 : 400 }}
                >
                  {m === 'work' ? '🎯 Работа' : '☕ Перерыв'}
                </button>
              ))}
            </div>

            {/* Timer circle */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <CircleProgress progress={progress} />
              <div className="text-center">
                <p className="text-4xl text-white tabular-nums" style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                  {pad(mins)}:{pad(secs)}
                </p>
                <p className="text-xs text-white/40 mt-1">{mode === 'work' ? 'до перерыва' : 'до работы'}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="w-11 h-11 rounded-full bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-all flex items-center justify-center"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRunning(s => !s)}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] text-white hover:opacity-90 transition-all flex items-center justify-center shadow-lg shadow-[#1d4ed8]/40"
              >
                {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <div className="w-11 h-11 rounded-full bg-white/8 flex items-center justify-center">
                <span className="text-sm text-white/60" style={{ fontWeight: 600 }}>{pomodorosCompleted}🍅</span>
              </div>
            </div>

            {/* Timer duration settings */}
            <div className="w-full max-w-sm">
              <button
                onClick={() => setShowSettings(s => !s)}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mx-auto mb-2"
              >
                <Settings className="w-3 h-3" />
                {showSettings ? 'Скрыть настройки' : 'Настроить длительность'}
              </button>
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div>
                        <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider" style={{ fontWeight: 600 }}>Работа</p>
                        <div className="flex gap-1.5">
                          {WORK_PRESETS.map(p => (
                            <button
                              key={p.seconds}
                              onClick={() => { setWorkSeconds(p.seconds); if (mode === 'work' && !running) setSecondsLeft(p.seconds); }}
                              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                                workSeconds === p.seconds
                                  ? 'bg-[#1d4ed8] text-white'
                                  : 'bg-white/8 text-white/50 hover:text-white hover:bg-white/12'
                              }`}
                              style={{ fontWeight: workSeconds === p.seconds ? 600 : 400 }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider" style={{ fontWeight: 600 }}>Перерыв</p>
                        <div className="flex gap-1.5">
                          {BREAK_PRESETS.map(p => (
                            <button
                              key={p.seconds}
                              onClick={() => { setBreakSeconds(p.seconds); if (mode === 'break' && !running) setSecondsLeft(p.seconds); }}
                              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                                breakSeconds === p.seconds
                                  ? 'bg-[#1d4ed8] text-white'
                                  : 'bg-white/8 text-white/50 hover:text-white hover:bg-white/12'
                              }`}
                              style={{ fontWeight: breakSeconds === p.seconds ? 600 : 400 }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Task info */}
            <div className="w-full max-w-sm p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: phaseColor }} />
                <span className="text-xs text-white/40">{phaseName}</span>
                <span className="ml-auto text-xs flex items-center gap-1" style={{ color: PRIORITY_COLORS[task.priority] }}>
                  <Flag className="w-3 h-3" />{PRIORITY_LABELS[task.priority]}
                </span>
              </div>
              <p className="text-white text-sm leading-snug mb-2" style={{ fontWeight: 500 }}>{task.title}</p>
              <div className="flex items-center gap-3 text-xs text-white/40">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.duration_hours}ч оценка</span>
                {task.tracked_seconds && task.tracked_seconds > 0 && (
                  <span className="flex items-center gap-1 text-[#10b981]">
                    ✓ {Math.round(task.tracked_seconds / 60)}мин отслежено
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Notes */}
          <div className="lg:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-white/8 px-6 py-6 gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>Заметки к задаче</h3>
              {pomodorosCompleted > 0 && (
                <span className="text-xs text-white/40">{pomodorosCompleted} 🍅 сегодня</span>
              )}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Добавьте заметки, идеи, блокеры..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1d4ed8]/50 focus:ring-1 focus:ring-[#1d4ed8]/20 transition-all resize-none leading-relaxed"
            />

            <AnimatePresence>
              {done ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981]"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm" style={{ fontWeight: 500 }}>Задача выполнена! 🎉</span>
                </motion.div>
              ) : (
                <motion.button
                  onClick={handleMarkDone}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full py-3 rounded-xl bg-[#10b981] text-white text-sm hover:bg-[#0d9e73] transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#10b981]/30"
                  style={{ fontWeight: 600 }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Отметить выполненной
                </motion.button>
              )}
            </AnimatePresence>

            <p className="text-xs text-white/25 text-center">
              Нажмите <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/40">Esc</kbd> для выхода
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}