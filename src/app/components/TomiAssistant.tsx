import {
  useState, useRef, useEffect, createContext, useContext,
  useCallback, type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Send, Trash2, Sparkles, ChevronDown, Loader2,
  RotateCcw, Zap, Swords, Heart, BarChart2, Flame,
  CheckCheck, ArrowDownUp, Target, Check, Pencil, Plus,
  Flag, ArrowRight, Mic, MicOff, Radio, Volume2, VolumeX,
  Wind, Shield, Laugh, SlidersHorizontal,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useAuth } from '../lib/auth';
import { getPlans, savePlan, updateTask } from '../lib/storage';
import type { Plan, Task } from '../lib/types';
import { TomiNotificationBubble } from './TomiNotificationBubble';

// ── Decode username ───────────────────────────────────────────────────────────
function decodeUsername(email: string | null | undefined): string {
  if (!email) return '';
  const local = email.split('@')[0];
  if (!email.endsWith('@stride.app')) return local;
  try {
    const padded = local.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    return decodeURIComponent(escape(atob(pad ? padded + '='.repeat(4 - pad) : padded)));
  } catch { return local; }
}
function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) {
    try {
      const demo = localStorage.getItem('stride_demo_name');
      if (demo) return demo;
    } catch { /* ignore */ }
    return '';
  }
  const meta = user.user_metadata;
  if (meta?.name && typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim();
  return decodeUsername(user.email);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type PersonalityMode = 'soft' | 'strict' | 'business' | 'motivational' | 'zen' | 'spartan' | 'joker';

export interface PlanAction {
  // Traditional actions
  type: 'reduce_load' | 'focus_top3' | 'reschedule'
      | 'delete_task' | 'delete_tasks'
      | 'change_status' | 'change_priority'
      | 'rename_task'  | 'add_task' | 'mark_done';
  message: string;

  // delete_task
  taskId?:          string;
  taskTitle?:       string;

  // delete_tasks / mark_done
  taskIds?:         string[];

  // change_status
  newStatus?:       'todo' | 'in_progress' | 'done';

  // change_priority
  newPriority?:     'high' | 'medium' | 'low';

  // rename_task
  newTitle?:        string;

  // add_task
  phaseId?:         string;
  phaseName?:       string;
  newTaskTitle?:    string;
  newTaskPriority?: 'high' | 'medium' | 'low';
}

interface ChatMessage {
  id:          string;
  role:        'user' | 'assistant';
  content:     string;
  tokens?:     number;
  planAction?: PlanAction | null;
  ts:          number;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface PlanStats {
  progress?: number;
  overdueCount?: number;
  daysLeft?: number;
  lastActivityDays?: number;
}

interface TomiContextValue {
  setContext:           (ctx: string, stats?: PlanStats) => void;
  openTomi:             () => void;
  onPlanAction?:        (action: PlanAction) => void;
  setPlanActionHandler: (fn: ((a: PlanAction) => void) | null) => void;
  /** Открывает чат и вставляет готовое сообщение от Томи */
  openTomiWithSeed:     (msg: string) => void;
}
const TomiCtx = createContext<TomiContextValue>({
  setContext: () => {}, openTomi: () => {},
  setPlanActionHandler: () => {},
  openTomiWithSeed: () => {},
});
export function useTomi() { return useContext(TomiCtx); }

// ── Personality config ────────────────────────────────────────────────────────
const PERSONALITIES: {
  id: PersonalityMode; label: string; emoji: string;
  icon: typeof Heart; color: string; desc: string;
}[] = [
  { id: 'soft',         label: 'Мягкий',    emoji: '🤗', icon: Heart,    color: '#10b981', desc: 'Поддерживающий, тёплый' },
  { id: 'strict',       label: 'Строгий',   emoji: '⚔️', icon: Swords,   color: '#ef4444', desc: 'Требовательный, конкретный' },
  { id: 'business',     label: 'Деловой',   emoji: '📊', icon: BarChart2, color: '#f59e0b', desc: 'Цифры, KPI, метрики' },
  { id: 'motivational', label: 'Мотиватор', emoji: '🔥', icon: Flame,    color: '#1d4ed8', desc: 'Драйв и энергия' },
  { id: 'zen',          label: 'Дзен',      emoji: '🧘', icon: Wind,     color: '#60a5fa', desc: 'Спокойный и балансный' },
  { id: 'spartan',      label: 'Спартанец', emoji: '🛡️', icon: Shield,   color: '#dc2626', desc: 'Жёстко, без оправданий' },
  { id: 'joker',        label: 'Весельчак', emoji: '😄', icon: Laugh,    color: '#16a34a', desc: 'Юмор + результат' },
];

// Map personality → avatar mood
function personalityMood(p: PersonalityMode): 'happy' | 'focused' | 'excited' | 'cool' {
  if (p === 'soft')         return 'happy';
  if (p === 'strict')       return 'focused';
  if (p === 'business')     return 'cool';
  if (p === 'motivational') return 'excited';
  if (p === 'zen')          return 'happy';
  if (p === 'spartan')      return 'focused';
  if (p === 'joker')        return 'excited';
  return 'happy';
}

// ── Action metadata ───────────────────────────────────────────────────────────
const STATUS_RU: Record<string, string> = { todo: 'К выполнению', in_progress: 'В процессе', done: 'Выполнено' };
const PRIORITY_RU: Record<string, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

const ACTION_META: Record<PlanAction['type'], {
  icon: typeof Target; label: string; color: string; bg: string; danger?: boolean;
}> = {
  reduce_load:     { icon: ArrowDownUp, label: 'Снизить нагрузку',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25' },
  focus_top3:      { icon: Target,      label: 'Фокус: топ-3',        color: 'text-[#93bbfd]',   bg: 'bg-[#1d4ed8]/15 border-[#1d4ed8]/30' },
  reschedule:      { icon: CheckCheck,  label: 'Перераспределить',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  delete_task:     { icon: Trash2,      label: 'Удалить задачу',      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',     danger: true },
  delete_tasks:    { icon: Trash2,      label: 'Удалить задачи',      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',     danger: true },
  change_status:   { icon: ArrowRight,  label: 'Изменить статус',     color: 'text-[#93bbfd]',   bg: 'bg-[#1d4ed8]/15 border-[#1d4ed8]/30' },
  change_priority: { icon: Flag,        label: 'Изменить приоритет',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25' },
  rename_task:     { icon: Pencil,      label: 'Переименовать',       color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30' },
  add_task:        { icon: Plus,        label: 'Добавить задачу',     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  mark_done:       { icon: CheckCheck,  label: 'Отметить выполненными', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
};

// ── Action detail line ────────────────────────────────────────────────────────
function ActionDetail({ action }: { action: PlanAction }) {
  const items: { label: string; value: string; highlight?: string }[] = [];

  if (action.type === 'delete_task' && action.taskTitle) {
    items.push({ label: 'Задача', value: action.taskTitle });
  }
  if (action.type === 'delete_tasks' && action.taskIds) {
    items.push({ label: 'Задач', value: String(action.taskIds.length) });
  }
  if (action.type === 'change_status' && action.taskTitle && action.newStatus) {
    items.push({ label: 'Задача', value: action.taskTitle });
    items.push({ label: 'Новый статус', value: STATUS_RU[action.newStatus] ?? action.newStatus, highlight: 'status' });
  }
  if (action.type === 'change_priority' && action.taskTitle && action.newPriority) {
    items.push({ label: 'Задача', value: action.taskTitle });
    items.push({ label: 'Приоритет', value: PRIORITY_RU[action.newPriority] ?? action.newPriority });
  }
  if (action.type === 'rename_task' && action.taskTitle && action.newTitle) {
    items.push({ label: 'Было', value: action.taskTitle });
    items.push({ label: 'Станет', value: action.newTitle, highlight: 'new' });
  }
  if (action.type === 'add_task' && action.newTaskTitle) {
    items.push({ label: 'Название', value: action.newTaskTitle });
    if (action.phaseName) items.push({ label: 'Этап', value: action.phaseName });
    if (action.newTaskPriority) items.push({ label: 'Приоритет', value: PRIORITY_RU[action.newTaskPriority] ?? action.newTaskPriority });
  }
  if (action.type === 'mark_done' && action.taskIds) {
    items.push({ label: 'Задач', value: String(action.taskIds.length) });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-white/8 bg-white/4">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] ${i > 0 ? 'border-t border-white/6' : ''}`}>
          <span className="text-white/40">{item.label}</span>
          <span className={`font-medium max-w-[55%] truncate text-right ${
            item.highlight === 'new'    ? 'text-emerald-300' :
            item.highlight === 'status' ? 'text-[#93bbfd]'   :
            'text-white/75'
          }`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Plan action card ──────────────────────────────────────────────────────────
function PlanActionCard({
  action, onApply, onDismiss,
}: {
  action: PlanAction;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const meta = ACTION_META[action.type];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      className={`rounded-xl border p-3 mt-2 ${meta.bg}`}
    >
      <div className="flex items-start gap-2 mb-1">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
          <p className="text-white/65 text-xs mt-0.5 leading-relaxed">{action.message}</p>
        </div>
      </div>

      <ActionDetail action={action} />

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={onApply}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95 touch-manipulation ${
            meta.danger
              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
              : `${meta.color} bg-white/10 hover:bg-white/15`
          }`}
        >
          <Check className="w-3 h-3" />
          {meta.danger ? 'Удалить' : 'Применить'}
        </button>
        <button
          onClick={onDismiss}
          className="text-xs px-3 py-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors touch-manipulation"
        >
          Отмена
        </button>
      </div>
    </motion.div>
  );
}

// ── Storage ───────────────────────────────────────────────────────────────────
const MAX_STORED = 60;
const storageKey     = (uid: string) => `tomi_history_${uid}`;
const personalityKey = (uid: string) => `tomi_personality_${uid}`;
const slidersKey     = (uid: string) => `tomi_sliders_${uid}`;

interface TomiSliders { strictness: number; humor: number; }
function loadSliders(userId: string): TomiSliders {
  try {
    const v = localStorage.getItem(slidersKey(userId));
    return v ? JSON.parse(v) : { strictness: 50, humor: 50 };
  } catch { return { strictness: 50, humor: 50 }; }
}
function saveSliders(userId: string, s: TomiSliders) {
  try { localStorage.setItem(slidersKey(userId), JSON.stringify(s)); } catch {}
}

import { setData as cloudSet, updateSetting as cloudUpdateSetting } from '../lib/cloudSync';

function loadHistory(userId: string): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]'); } catch { return []; }
}
function saveHistory(userId: string, msgs: ChatMessage[]) {
  const trimmed = msgs.slice(-MAX_STORED);
  try { localStorage.setItem(storageKey(userId), JSON.stringify(trimmed)); } catch {}
  try { cloudSet('chat_history', trimmed); } catch {}
}
function loadPersonality(userId: string): PersonalityMode {
  try {
    const v = localStorage.getItem(personalityKey(userId));
    return PERSONALITIES.find(p => p.id === v)?.id ?? 'soft';
  } catch { return 'soft'; }
}
function savePersonality(userId: string, mode: PersonalityMode) {
  try { localStorage.setItem(personalityKey(userId), mode); } catch {}
  try { cloudUpdateSetting('tomi_personality', mode); } catch {}
}

// ── Server ────────────��───────────────────────────────────────────────────────
const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

// ── Direct fallback (disabled) ────────────────────────────────────────────────
async function askTomiDirect(
  messages: ChatMessage[], context: string, username: string, personality: PersonalityMode,
  sliders?: TomiSliders,
): Promise<{ reply: string; planAction: PlanAction | null; tokens: number }> {
  const name = (username || '').trim();
  const nameClause = name
    ? `Имя пользователя: ${name}. Обращайся по имени тепло.`
    : 'Пользователь не представился.';
  const pMap: Record<string, string> = {
    strict:       'СТРОГИЙ КОУЧ: требовательный, конкретный, без лирики, ставь дедлайны.',
    soft:         'МЯГКИЙ КОУЧ: поддерживай, сочувствуй, мотивируй через принятие.',
    business:     'ДЕЛОВОЙ ПЛАНИРОВЩИК: цифры, метрики, ROI, KPI и чеклисты.',
    motivational: 'МОТИВАТОР: заряжай энергией, эмодзи, отмечай победы.',
    zen:          'ДЗЕН-МАСТЕР: спокойно, медитативно, помогай найти баланс.',
    spartan:      'СПАРТАНЕЦ: жёстко, без оправ��аний, короткие команды.',
    joker:        'ВЕСЕЛЬЧАК: юмор и лёгкость, но реально помогай.',
  };
  let fullCtx = context || '';
  if (sliders) {
    const sl = sliders.strictness > 70 ? 'высокая' : sliders.strictness < 30 ? 'низкая' : 'средняя';
    const hl = sliders.humor > 70 ? 'высокий' : sliders.humor < 30 ? 'минимальный' : 'умеренный';
    fullCtx += `\n[Настройки тона: строгость ${sl} (${sliders.strictness}/100), юмор ${hl} (${sliders.humor}/100)]`;
  }
  const systemPrompt = `Ты — Томи, AI-менеджер Vecto. ${nameClause} Стиль: ${pMap[personality] || pMap.soft}
Говоришь только на русском. Никогда не упоминаешь OpenAI/ChatGPT. Ответы 2-5 предложений.
Умеешь выполнять действия с задачами. Верни JSON: {"reply":"текст","planAction":null} или с planAction:
delete_task{taskId,taskTitle}, delete_tasks{taskIds[]}, change_status{taskId,taskTitle,newStatus}, change_priority{taskId,taskTitle,newPriority},
rename_task{taskId,taskTitle,newTitle}, add_task{phaseId,phaseName,newTaskTitle,newTaskPriority}, mark_done{taskIds[]},
reduce_load, focus_top3, reschedule. Используй taskId только из контекста.${fullCtx ? `\nКонтекст плана:\n${fullCtx}` : ''}`;

  // Direct fallback is disabled - rely on Edge Function only
  throw new Error('Direct fallback not configured');
}

async function askTomi(
  messages: ChatMessage[], context: string, username: string, personality: PersonalityMode,
  sliders?: TomiSliders, planStats?: PlanStats,
): Promise<{ reply: string; planAction: PlanAction | null; tokens: number }> {
  // Append slider tone hints to context
  let fullContext = context || '';
  if (sliders) {
    const strictLabel = sliders.strictness > 70 ? 'высокая' : sliders.strictness < 30 ? 'низкая' : 'средняя';
    const humorLabel  = sliders.humor > 70 ? 'высокий' : sliders.humor < 30 ? 'минимальный' : 'умеренный';
    fullContext += `\n[Настройки тона: строгость ${strictLabel} (${sliders.strictness}/100), юмор ${humorLabel} (${sliders.humor}/100)]`;
  }

  // ── 1. Try edge function ──────────────────────────────────────────────────
  try {
    const res = await fetch(`${SERVER}/ai/tomi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({
        username:    username    || undefined,
        context:     fullContext || undefined,
        personality: personality || 'soft',
        planStats:   planStats   || undefined,
        messages:    messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      return { reply: data.reply, planAction: data.planAction ?? null, tokens: data.tokens ?? 0 };
    }
    console.warn('[Tomi] Edge error:', data.error, '— switching to direct proxy');
  } catch (err) {
    console.warn('[Tomi] Edge unreachable — switching to direct proxy:', err);
  }

  // ── 2. Direct Pipedream proxy ─────────────────────────────────────────────
  return askTomiDirect(messages, context, username, personality, sliders);
}

// ── TTS helpers ───────────────────────────────────────────────────────────────
const TTS_VOICE_KEY = (uid: string) => `tomi_tts_${uid}`;
const WAKE_WORD_KEY = (uid: string) => `tomi_wake_${uid}`;

// ── Tomi voice profile ── cute · cartoon · soft ────────────────────────────
//   pitch  1.28  → выше обычного, мультяшно, но не пискляво
//   rate   0.88  → чуть медленнее — тепло и уютно
//   volume 0.92  → немного тише — мягче на слух
const TOMI_PITCH  = 1.28;
const TOMI_RATE   = 0.88;
const TOMI_VOLUME = 0.92;

// Priority list — самые мягкие и приятные русские голоса
// Milena (Apple) → идеальный выбор для macOS и iOS
const VOICE_PRIORITY = [
  'Milena',           // Apple macOS/iOS — мягкий женский, лучший выбор
  'Katya',            // Apple альтернатива
  'Yelena',           // Google Android Russian female
  'Google Русский',
  'Microsoft Irina',
  'Microsoft Svetlana',
  'Irina',
];

// Strip markdown / emoji before TTS
function ttsClean(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'блок кода')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[✅⚠️🚀🎯💪⚡🗑️🔥📊⚔️🤗👋😊✨🌟💡]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Выбрать самый мягкий русский голос
function pickRuVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // 1. По приоритетному списку имён
  for (const name of VOICE_PRIORITY) {
    const v = voices.find(v => v.name.includes(name) && v.lang.startsWith('ru'));
    if (v) return v;
  }
  // 2. Любой локальный русский голос
  const local = voices.find(v => v.lang.startsWith('ru') && v.localService);
  if (local) return local;
  // 3. Любой русский голос
  return voices.find(v => v.lang.startsWith('ru')) ?? null;
}

function ttsSpeak(
  text: string,
  opts: { onStart?: () => void; onEnd?: () => void },
) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const cleaned = ttsClean(text);
  if (!cleaned) return;

  // Обрезать до 300 символов — длинные тексты не читаем целиком
  const snippet = cleaned.length > 300 ? cleaned.slice(0, 300) + '…' : cleaned;

  const speak = () => {
    const utt    = new SpeechSynthesisUtterance(snippet);
    utt.lang     = 'ru-RU';
    utt.pitch    = TOMI_PITCH;
    utt.rate     = TOMI_RATE;
    utt.volume   = TOMI_VOLUME;

    const voice = pickRuVoice();
    if (voice) utt.voice = voice;

    utt.onstart = () => opts.onStart?.();
    utt.onend   = () => opts.onEnd?.();
    utt.onerror = () => opts.onEnd?.();

    window.speechSynthesis.speak(utt);
  };

  // Голоса могут ещё не загрузиться — ждём события
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      speak();
    };
  } else {
    speak();
  }
}

// ── Quick chips ───────────────────────────────────────────────────────────────
const QUICK = [
  { emoji: '🚀', text: 'С чего начать прямо сейчас?' },
  { emoji: '😓', text: 'Кажется, я немного устал…' },
  { emoji: '📋', text: 'Что мне сделать сегодня?' },
  { emoji: '⚡', text: 'Как ускорить выполнение плана?' },
  { emoji: '🎯', text: 'Расставь приоритеты в моём плане' },
  { emoji: '💪', text: 'Мотивируй меня!' },
  { emoji: '🔄', text: 'Помоги упростить план' },
  { emoji: '🗑️', text: 'Удали задачи с низким приоритетом' },
];

// ── Avatar ────────────────────────────────────────────────────────────────────
export function TomiAvatar({
  size = 32,
  mood,
  loading = false,
}: {
  size?: number;
  mood?: 'happy' | 'focused' | 'excited' | 'cool';
  loading?: boolean;
}) {
  // Eyelid animation: loading → slow thoughtful blink; idle → quick natural blink
  const lidAnim = { scaleY: [0, 1, 0] as number[] };
  const lidTransition = loading
    ? { duration: 0.5, ease: [0.4, 0, 0.6, 1] as number[], repeat: Infinity, repeatDelay: 1.3 }
    : { duration: 0.26, ease: [0.3, 0, 0.7, 1] as number[], repeat: Infinity, repeatDelay: 4.2 };
  const lidStyle = { transformBox: 'fill-box' as const, transformOrigin: 'center top' };

  return (
    <svg
      width={size} height={size} viewBox="0 0 80 80" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        {/* Body gradient */}
        <linearGradient id="tm_body" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
        {/* Eye gradient — light blue */}
        <radialGradient id="tm_eye" cx="38%" cy="35%" r="65%">
          <stop stopColor="#e0f2fe" />
          <stop offset="0.55" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#93c5fd" />
        </radialGradient>
        {/* Antenna ball gradient */}
        <radialGradient id="tm_ant" cx="38%" cy="32%" r="68%">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#2563eb" />
        </radialGradient>
        {/* Visor gradient */}
        <linearGradient id="tm_visor" x1="14" y1="28" x2="14" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0c1a3a" />
          <stop offset="1" stopColor="#060d1e" />
        </linearGradient>
      </defs>

      {/* ── Ambient glow ring ── */}
      <circle cx="40" cy="43" r="34" fill="#1d4ed8" fillOpacity="0.13" />

      {/* ── Main head (rounded rect) ── */}
      <rect x="10" y="17" width="60" height="56" rx="19" fill="url(#tm_body)" />

      {/* Glass highlight on top of head */}
      <ellipse cx="31" cy="24" rx="18" ry="6.5" fill="white" fillOpacity="0.13" />

      {/* ── Ear circuit panels ── */}
      <rect x="0" y="30" width="11" height="20" rx="5.5" fill="white" fillOpacity="0.11" />
      <line x1="3" y1="36" x2="8.5" y2="36" stroke="white" strokeOpacity="0.28" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="3" y1="40" x2="8.5" y2="40" stroke="white" strokeOpacity="0.28" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="3" y1="44" x2="8.5" y2="44" stroke="white" strokeOpacity="0.18" strokeWidth="1.1" strokeLinecap="round" />

      <rect x="69" y="30" width="11" height="20" rx="5.5" fill="white" fillOpacity="0.11" />
      <line x1="71.5" y1="36" x2="77" y2="36" stroke="white" strokeOpacity="0.28" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="71.5" y1="40" x2="77" y2="40" stroke="white" strokeOpacity="0.28" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="71.5" y1="44" x2="77" y2="44" stroke="white" strokeOpacity="0.18" strokeWidth="1.1" strokeLinecap="round" />

      {/* ── Visor / screen area ── */}
      <rect x="13" y="27" width="54" height="30" rx="11" fill="url(#tm_visor)" fillOpacity="0.88" />
      {/* Visor inner gleam */}
      <rect x="15" y="28.5" width="50" height="4" rx="2.5" fill="white" fillOpacity="0.06" />

      {/* ── LEFT EYE ── */}
      {/* Eye white */}
      <circle cx="27" cy="42" r="9.5" fill="url(#tm_eye)" />
      {/* Iris */}
      <circle cx="27.5" cy="42" r="6.2" fill="#1d4ed8" />
      {/* Inner iris ring */}
      <circle cx="27.5" cy="42" r="4.2" fill="#1e3a8a" />
      {/* Pupil */}
      <circle cx="27.5" cy="42" r="2.4" fill="#040d1f" />
      {/* Main specular */}
      <circle cx="24.8" cy="39.3" r="2.3" fill="white" fillOpacity="0.9" />
      {/* Secondary specular */}
      <circle cx="30.5" cy="44.8" r="1" fill="white" fillOpacity="0.45" />
      {/* Mood: excited — star sparkle */}
      {mood === 'excited' && (
        <>
          <circle cx="22.5" cy="37.5" r="1" fill="white" fillOpacity="0.7" />
          <circle cx="32" cy="38" r="0.7" fill="white" fillOpacity="0.5" />
        </>
      )}
      {/* Mood: focused — narrowed lid */}
      {(mood === 'focused' || mood === 'cool') && (
        <rect x="17.5" y="32.5" width="19" height="7" rx="3" fill="url(#tm_visor)" fillOpacity="0.75" />
      )}

      {/* ── RIGHT EYE ── */}
      <circle cx="53" cy="42" r="9.5" fill="url(#tm_eye)" />
      <circle cx="53.5" cy="42" r="6.2" fill="#1d4ed8" />
      <circle cx="53.5" cy="42" r="4.2" fill="#1e3a8a" />
      <circle cx="53.5" cy="42" r="2.4" fill="#040d1f" />
      <circle cx="50.8" cy="39.3" r="2.3" fill="white" fillOpacity="0.9" />
      <circle cx="56.5" cy="44.8" r="1" fill="white" fillOpacity="0.45" />
      {mood === 'excited' && (
        <>
          <circle cx="48.5" cy="37.5" r="1" fill="white" fillOpacity="0.7" />
          <circle cx="58" cy="38" r="0.7" fill="white" fillOpacity="0.5" />
        </>
      )}
      {(mood === 'focused' || mood === 'cool') && (
        <rect x="43.5" y="32.5" width="19" height="7" rx="3" fill="url(#tm_visor)" fillOpacity="0.75" />
      )}

      {/* ── Blush cheeks ── */}
      <ellipse cx="15" cy="51" rx="5.5" ry="3.8" fill="#f472b6" fillOpacity={mood === 'excited' ? 0.35 : 0.2} />
      <ellipse cx="65" cy="51" rx="5.5" ry="3.8" fill="#f472b6" fillOpacity={mood === 'excited' ? 0.35 : 0.2} />

      {/* ── Mouth / smile ── */}
      {mood === 'focused' || mood === 'cool' ? (
        /* Straight line for focused/cool */
        <line x1="28" y1="59" x2="52" y2="59" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.65" />
      ) : (
        /* Happy smile (default / excited) */
        <path
          d={mood === 'excited'
            ? 'M 20 57 Q 40 73 60 57'
            : 'M 23 57 Q 40 70 57 57'}
          stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.78"
        />
      )}

      {/* ── Antenna post ── */}
      <rect x="37.5" y="1.5" width="5" height="15.5" rx="2.5" fill="#bfdbfe" fillOpacity="0.82" />

      {/* ── Antenna ball ── */}
      {/* Soft outer glow */}
      <circle cx="40" cy="3.5" r="7.5" fill="#60a5fa" fillOpacity="0.22" />
      {/* Ball body */}
      <circle cx="40" cy="3.5" r="5.8" fill="url(#tm_ant)" />
      {/* Ball ring detail */}
      <circle cx="40" cy="3.5" r="5.8" stroke="#93c5fd" strokeWidth="0.8" strokeOpacity="0.35" fill="none" />
      {/* Shine */}
      <circle cx="38.2" cy="1.8" r="2.1" fill="white" fillOpacity="0.72" />
      <circle cx="42" cy="4.8" r="0.9" fill="white" fillOpacity="0.38" />

      {/* ── EYELIDS — motion-controlled blink ── */}
      {/* Covers each eye with scaleY from top; loading → fast, idle → slow natural */}
      <motion.rect
        x="17.5" y="32.5" width="19" height="19" rx="9.5"
        fill="#060e1e"
        style={lidStyle}
        initial={{ scaleY: 0 }}
        animate={lidAnim}
        transition={lidTransition}
      />
      <motion.rect
        x="43.5" y="32.5" width="19" height="19" rx="9.5"
        fill="#060e1e"
        style={lidStyle}
        initial={{ scaleY: 0 }}
        animate={lidAnim}
        transition={lidTransition}
      />

      {/* Loading: antenna tip pulses to signal "thinking" */}
      {loading && (
        <motion.circle
          cx="40" cy="3.5" r="8"
          fill="#60a5fa"
          fillOpacity={0}
          animate={{ fillOpacity: [0, 0.55, 0] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </svg>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({
  msg, onApplyAction, onDismissAction,
}: {
  msg: ChatMessage;
  onApplyAction?: (a: PlanAction) => void;
  onDismissAction?: () => void;
}) {
  const isUser    = msg.role === 'user';
  const [dismissed, setDismissed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {!isUser && <TomiAvatar size={28} />}
      <div className="max-w-[85%] space-y-1">
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] text-white rounded-br-sm'
              : 'bg-white/9 border border-white/10 text-white/90 rounded-bl-sm'
          }`}
          style={{ fontWeight: isUser ? 500 : 400 }}
        >
          {msg.content}
        </div>
        {!isUser && msg.planAction && !dismissed && (
          <PlanActionCard
            action={msg.planAction}
            onApply={() => { onApplyAction?.(msg.planAction!); setDismissed(true); }}
            onDismiss={() => setDismissed(true)}
          />
        )}
        {msg.tokens && msg.role === 'assistant' && (
          <p className="text-white/18 text-[10px] ml-1 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> {msg.tokens} токенов
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Typing bubble ─────────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <TomiAvatar size={28} loading={true} />
      <div className="bg-white/9 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5">
        {[0,1,2].map(i => (
          <motion.div key={i} animate={{ y:[0,-5,0], opacity:[0.4,1,0.4] }}
            transition={{ duration:0.7, repeat:Infinity, delay: i*0.15 }}
            className="w-1.5 h-1.5 rounded-full bg-[#93bbfd]" />
        ))}
      </div>
    </div>
  );
}

// ── Personality selector ──────────────────────────────────────────────────────
function PersonalitySelector({ current, onChange }: { current: PersonalityMode; onChange: (m: PersonalityMode) => void }) {
  const [open, setOpen] = useState(false);
  const cur = PERSONALITIES.find(p => p.id === current)!;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all touch-manipulation">
        <span className="text-sm leading-none">{cur.emoji}</span>
        <span className="text-white/60 text-xs font-medium">{cur.label}</span>
        <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:-6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-6, scale:0.97 }} transition={{ duration:0.15 }}
            className="absolute top-full left-0 mt-1.5 z-10 min-w-[200px] rounded-2xl border border-white/10 bg-[#0d1a36] shadow-2xl overflow-hidden">
            <div className="p-1.5 space-y-0.5">
              {PERSONALITIES.map(p => {
                const Icon = p.icon;
                return (
                  <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all touch-manipulation ${p.id === current ? 'bg-white/10' : 'hover:bg-white/6'}`}>
                    <Icon className="w-4 h-4 shrink-0" style={{ color: p.color }} />
                    <div>
                      <p className="text-white text-xs font-semibold">{p.emoji} {p.label}</p>
                      <p className="text-white/35 text-[10px]">{p.desc}</p>
                    </div>
                    {p.id === current && <Check className="w-3.5 h-3.5 text-white/50 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
function TomiWidgetConnected({
  externalContext, planActionHandler, forceOpen, onForceOpenHandled, onOpenChange,
  seedMsg, onSeedConsumed, planStats,
}: {
  externalContext:    string;
  planActionHandler:  ((a: PlanAction) => void) | null;
  forceOpen:          boolean;
  onForceOpenHandled: () => void;
  onOpenChange?:      (open: boolean) => void;
  seedMsg:            string;
  onSeedConsumed:     () => void;
  planStats?:         PlanStats;
}) {
  const { user }    = useAuth();
  const username    = getDisplayName(user as Parameters<typeof getDisplayName>[0]);
  const userId      = user?.id ?? 'guest';

  const [open,        setOpen]        = useState(false);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [draft,       setDraft]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [totalTok,    setTotalTok]    = useState(0);
  const [personality, setPersonality] = useState<PersonalityMode>('soft');
  const [sliders,     setSliders]     = useState<TomiSliders>({ strictness: 50, humor: 50 });
  const [showSliders, setShowSliders] = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);
  const [lastAction,  setLastAction]  = useState<PlanAction | null>(null);

  // ── TTS (Tomi speaks) ─────────────────────────────────────────────────────
  const [ttsEnabled,    setTtsEnabled]    = useState(() => {
    try { return localStorage.getItem(TTS_VOICE_KEY('global')) === '1'; } catch { return false; }
  });
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [ttsSupported,  setTtsSupported]  = useState(false);

  useEffect(() => {
    setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const toggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    try { localStorage.setItem(TTS_VOICE_KEY('global'), next ? '1' : '0'); } catch {}
    try { cloudUpdateSetting('tts', next); } catch {}
    if (!next) { window.speechSynthesis?.cancel(); setIsSpeaking(false); }
    else {
      // Demo: greet on enable
      ttsSpeak('Привет! Теперь я буду говорить голосом.', {
        onStart: () => setIsSpeaking(true),
        onEnd:   () => setIsSpeaking(false),
      });
    }
  };

  const speakReply = useCallback((text: string) => {
    if (!ttsEnabled || !ttsSupported) return;
    ttsSpeak(text, {
      onStart: () => setIsSpeaking(true),
      onEnd:   () => setIsSpeaking(false),
    });
  }, [ttsEnabled, ttsSupported]);
  // ── End TTS ───────────────────────────────────────────────────────────────

  // ── Wake word "Томи" / "Эй Томи" ─────────────────────────────────────────
  const [wakeEnabled,  setWakeEnabled]  = useState(false);
  const [wakeActive,   setWakeActive]   = useState(false);
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const openRef    = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  // ── Voice recognition state (must be declared before startWake/stopWake) ──
  const [isRecording,    setIsRecording]    = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interimText,    setInterimText]    = useState('');
  const [voiceError,     setVoiceError]     = useState('');
  const recognitionRef  = useRef<SpeechRecognition | null>(null);
  const pendingVoiceRef = useRef('');
  const sendRef = useRef<(text?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  // Load wake preference
  useEffect(() => {
    try {
      if (localStorage.getItem(WAKE_WORD_KEY(userId)) === '1') setWakeEnabled(true);
    } catch {}
  }, [userId]);

  const stopWake = useCallback(() => {
    try { wakeRecRef.current?.stop(); } catch {}
    wakeRecRef.current = null;
    setWakeActive(false);
  }, []);

  const startWake = useCallback(() => {
    if (!voiceSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec: SpeechRecognition = new SR();
      rec.lang = 'ru-RU';
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      wakeRecRef.current = rec;

      rec.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript.toLowerCase();
          if (t.includes('томи') || t.includes('tomi')) {
            if (!openRef.current) {
              setOpen(true);
            }
          }
        }
      };

      rec.onend = () => {
        // Auto-restart if still enabled and not recording manually
        if (wakeRecRef.current === rec) {
          setTimeout(() => {
            try { if (wakeRecRef.current === rec) rec.start(); } catch {}
          }, 1500);
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'not-allowed') {
          setWakeEnabled(false);
          setWakeActive(false);
          try { localStorage.setItem(WAKE_WORD_KEY(userId), '0'); } catch {}
        }
      };

      rec.start();
      setWakeActive(true);
    } catch {}
  }, [voiceSupported, userId]);

  // Start/stop based on enabled + chat state
  // When chat opens, stop (nulling ref prevents onend auto-restart)
  useEffect(() => {
    if (wakeEnabled && voiceSupported) {
      if (!open) {
        startWake();
      } else {
        stopWake(); // nulls ref → onend won't restart
      }
    } else {
      stopWake();
    }
  }, [wakeEnabled, open, voiceSupported, startWake, stopWake]);

  // Cleanup on unmount
  useEffect(() => () => stopWake(), [stopWake]);

  const toggleWake = () => {
    const next = !wakeEnabled;
    setWakeEnabled(next);
    try { localStorage.setItem(WAKE_WORD_KEY(userId), next ? '1' : '0'); } catch {}
    if (!next) stopWake();
  };
  // ── End wake word ─────────────────────────────────────────────────────────

  // ── Voice recognition callbacks ───────────────────────────────────────────
  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');
  }, []);

  const startVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    setVoiceError('');
    pendingVoiceRef.current = '';

    const rec: SpeechRecognition = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) {
        pendingVoiceRef.current = (pendingVoiceRef.current + ' ' + final).trim();
        setDraft(pendingVoiceRef.current);
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    rec.onend = () => {
      setIsRecording(false);
      setInterimText('');
      const text = pendingVoiceRef.current.trim();
      if (text) {
        setDraft('');
        pendingVoiceRef.current = '';
        setTimeout(() => sendRef.current(text), 350);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      setInterimText('');
      if (e.error === 'not-allowed') {
        setVoiceError('Нет разрешения на микрофон. Разрешите доступ в настройках браузера.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setVoiceError('Ошибка записи: ' + e.error);
      }
    };

    rec.start();
    setIsRecording(true);
  }, []);
  // ── End voice ─────────────────────────────────────────────────────────────

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const prevOpen    = useRef(false);
  const prevUser    = useRef('');
  // Seed message ref — keeps pending seed without extra effect deps
  const seedMsgRef  = useRef('');
  useEffect(() => { if (seedMsg) seedMsgRef.current = seedMsg; }, [seedMsg]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (userId && userId !== prevUser.current) {
      prevUser.current = userId;
      const saved = loadHistory(userId);
      if (saved.length > 0) {
        setMessages(saved);
        setTotalTok(saved.reduce((s, m) => s + (m.tokens ?? 0), 0));
      }
      setPersonality(loadPersonality(userId));
      setSliders(loadSliders(userId));
    }
  }, [userId]);

  useEffect(() => {
    if (messages.length > 0) saveHistory(userId, messages);
  }, [messages, userId]);

  const handlePersonalityChange = (mode: PersonalityMode) => {
    setPersonality(mode);
    savePersonality(userId, mode);
  };

  const handleSliderChange = (key: keyof TomiSliders, value: number) => {
    const next = { ...sliders, [key]: value };
    setSliders(next);
    saveSliders(userId, next);
  };

  useEffect(() => {
    if (forceOpen) { setOpen(true); onForceOpenHandled(); }
  }, [forceOpen, onForceOpenHandled]);

  // Notify parent when open state changes (used by TomiNotificationBubble)
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  useEffect(() => {
    if (open && !prevOpen.current) {
      const greeting = username
        ? `Привет, ${username}! 👋 Я Томи — твой персональный AI-коуч в Vecto. Я слежу за твоим прогрессом, могу напомнить что делать, когда отдохнуть, а когда поднажать. Также управляю задачами напрямую — просто скажи!`
        : `Привет! 👋 Я Томи — AI-коуч Vecto. Помогаю двигаться к цели: слежу за прогрессом, адаптирую план, мотивирую или предлагаю отдых. Могу и задачи менять напрямую. Спрашивай!`;

      if (messages.length === 0) {
        setMessages([{ id: 'hi', role: 'assistant', content: greeting, ts: Date.now() }]);
      }

      // Inject seed message if any (e.g., triggered by 👎 feedback)
      const seed = seedMsgRef.current;
      if (seed) {
        seedMsgRef.current = '';
        const delay = messages.length === 0 ? 480 : 160;
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            { id: Math.random().toString(36).slice(2, 10), role: 'assistant' as const, content: seed, ts: Date.now() },
          ]);
          onSeedConsumed();
        }, delay);
      }

      setTimeout(() => inputRef.current?.focus(), 200);
    }
    prevOpen.current = open;
  }, [open, messages.length, username, onSeedConsumed]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = open ? 'hidden' : '';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, isMobile]);

  const genId = () => Math.random().toString(36).slice(2, 10);

  // If no external context is set, auto-build context from all plans in localStorage
  const effectiveContext = externalContext || (() => {
    try {
      const plans = getPlans();
      if (!plans.length) return '';
      return plans.map(p => {
        const tasks = p.phases.flatMap(ph =>
          ph.tasks.map(t => `[${t.id}] "${t.title}" | этап: "${ph.name}" (id:${ph.id}) | статус: ${t.status} | прио��итет: ${t.priority}`)
        ).join('\n');
        const done = p.phases.flatMap(ph => ph.tasks).filter(t => t.status === 'done').length;
        const total = p.phases.flatMap(ph => ph.tasks).length;
        return `=== План: "${p.goal}" (id:${p.id}) ===\nДедлайн: ${p.deadline} | Выполнено: ${done}/${total}\nЗадачи:\n${tasks}`;
      }).join('\n\n');
    } catch { return ''; }
  })();

  // ── Direct executor — works even without a PlanPage handler ──────────────
  const executeDirectly = useCallback((action: PlanAction): boolean => {
    const plans = getPlans();

    // Helper: find plan that owns a taskId
    const findPlanByTaskId = (taskId: string) =>
      plans.find(p => p.phases.some(ph => ph.tasks.some(t => t.id === taskId)));

    // Helper: find plan that owns a phaseId
    const findPlanByPhaseId = (phaseId: string) =>
      plans.find(p => p.phases.some(ph => ph.id === phaseId));

    switch (action.type) {
      case 'delete_task': {
        if (!action.taskId) return false;
        const plan = findPlanByTaskId(action.taskId);
        if (!plan) return false;
        const updated: Plan = { ...plan, phases: plan.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => t.id !== action.taskId) })) };
        savePlan(updated);
        window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } }));
        return true;
      }
      case 'delete_tasks': {
        if (!action.taskIds?.length) return false;
        const ids = new Set(action.taskIds);
        // Group by plan
        const byPlan = new Map<string, Plan>();
        for (const plan of plans) {
          if (plan.phases.some(ph => ph.tasks.some(t => ids.has(t.id)))) byPlan.set(plan.id, plan);
        }
        for (const plan of byPlan.values()) {
          const updated: Plan = { ...plan, phases: plan.phases.map(ph => ({ ...ph, tasks: ph.tasks.filter(t => !ids.has(t.id)) })) };
          savePlan(updated);
          window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } }));
        }
        return byPlan.size > 0;
      }
      case 'change_status': {
        if (!action.taskId || !action.newStatus) return false;
        const plan = findPlanByTaskId(action.taskId);
        if (!plan) return false;
        const updated = updateTask(plan.id, action.taskId, { status: action.newStatus });
        if (updated) { window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } })); return true; }
        return false;
      }
      case 'mark_done': {
        if (!action.taskIds?.length) return false;
        const byPlan = new Map<string, Plan>();
        for (const plan of plans) {
          if (plan.phases.some(ph => ph.tasks.some(t => action.taskIds!.includes(t.id)))) byPlan.set(plan.id, plan);
        }
        for (const plan of byPlan.values()) {
          let cur = plan;
          action.taskIds.forEach(tid => { const r = updateTask(cur.id, tid, { status: 'done' }); if (r) cur = r; });
          window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } }));
        }
        return byPlan.size > 0;
      }
      case 'change_priority': {
        if (!action.taskId || !action.newPriority) return false;
        const plan = findPlanByTaskId(action.taskId);
        if (!plan) return false;
        const updated = updateTask(plan.id, action.taskId, { priority: action.newPriority });
        if (updated) { window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } })); return true; }
        return false;
      }
      case 'rename_task': {
        if (!action.taskId || !action.newTitle) return false;
        const plan = findPlanByTaskId(action.taskId);
        if (!plan) return false;
        const updated = updateTask(plan.id, action.taskId, { title: action.newTitle });
        if (updated) { window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } })); return true; }
        return false;
      }
      case 'add_task': {
        if (!action.phaseId || !action.newTaskTitle) return false;
        const plan = findPlanByPhaseId(action.phaseId);
        if (!plan) return false;
        const phase = plan.phases.find(ph => ph.id === action.phaseId)!;
        const newTask: Task = {
          id: Math.random().toString(36).slice(2, 10),
          phase_id: action.phaseId,
          title: action.newTaskTitle,
          description: '',
          duration_hours: 2,
          priority: action.newTaskPriority ?? 'medium',
          depends_on: [],
          status: 'todo',
          start_date: phase.start_date,
          end_date: phase.end_date,
          tags: [],
        };
        const updated: Plan = { ...plan, phases: plan.phases.map(ph => ph.id === action.phaseId ? { ...ph, tasks: [...ph.tasks, newTask] } : ph) };
        savePlan(updated);
        window.dispatchEvent(new CustomEvent('stride:plan-refresh', { detail: { planId: plan.id } }));
        return true;
      }
      default:
        return false;
    }
  }, []);

  const handleApplyAction = useCallback((action: PlanAction) => {
    // Try the PlanPage handler first (gives live React state update)
    if (planActionHandler) {
      planActionHandler(action);
    } else {
      // Fallback: execute directly via localStorage (works from any page)
      const ok = executeDirectly(action);
      if (!ok) {
        setMessages(prev => [...prev, {
          id: genId(), role: 'assistant',
          content: '⚠️ Не удалось найти задачу. Убедись, что план существует и попробуй ещё раз.',
          ts: Date.now(),
        }]);
        return;
      }
    }
    setLastAction(action);
    setMessages(prev => [...prev, {
      id: genId(), role: 'assistant',
      content: `✅ Готово! ${action.message}`,
      ts: Date.now(),
    }]);
  }, [planActionHandler, executeDirectly]);

  const send = useCallback(async (text = draft.trim()) => {
    if (!text || loading) return;
    setDraft('');
    setError('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMsg: ChatMessage = { id: genId(), role: 'user', content: text, ts: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const { reply, planAction, tokens } = await askTomi(history, effectiveContext, username, personality, sliders, planStats);
      const aiMsg: ChatMessage = { id: genId(), role: 'assistant', content: reply, planAction, tokens, ts: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
      setTotalTok(t => t + tokens);
      speakReply(reply);
    } catch (err) {
      console.error('[Tomi]', err);
      setError('Не удалось получить ответ. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }, [draft, loading, messages, effectiveContext, username, personality, sliders, speakReply]);

  // Keep sendRef up-to-date for voice onend callback (avoids stale closure)
  useEffect(() => { sendRef.current = send; }, [send]);

  const clear = () => {
    setMessages([]); setTotalTok(0); setError(''); setLastAction(null);
    saveHistory(userId, []);
    setTimeout(() => {
      setMessages([{
        id: genId(), role: 'assistant',
        content: username ? `Диалог очищен, ${username}. Чем могу помочь? 😊` : 'Диалог очищен. Чем могу помочь? 😊',
        ts: Date.now(),
      }]);
    }, 80);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
  };

  const showQuick = messages.length <= 1 && !loading;

  const panelStyle: React.CSSProperties = isMobile
    ? { position:'fixed', inset:0, zIndex:10000, display:'flex', flexDirection:'column',
        background:'linear-gradient(160deg,#0d1a36 0%,#070f1e 100%)', borderRadius:0,
        paddingTop:'env(safe-area-inset-top)' }
    : { position:'fixed', bottom:'6rem', right:'1.5rem', zIndex:10000, display:'flex', flexDirection:'column',
        width:'min(400px, calc(100vw - 2rem))', height:'min(600px, calc(100vh - 8rem))',
        background:'linear-gradient(160deg,#0d1a36 0%,#070f1e 100%)',
        borderRadius:22, border:'1px solid rgba(255,255,255,0.09)',
        boxShadow:'0 28px 72px rgba(0,0,0,.75), 0 0 0 1px rgba(29,78,216,.18)', overflow:'hidden' };

  const panelAnim = isMobile
    ? { initial:{y:'100%',opacity:0}, animate:{y:0,opacity:1}, exit:{y:'100%',opacity:0} }
    : { initial:{y:20,opacity:0,scale:0.96}, animate:{y:0,opacity:1,scale:1}, exit:{y:16,opacity:0,scale:0.97} };

  // Whether Tomi has a plan handler (i.e., we're on a plan page)
  const hasPlanContext = !!planActionHandler;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div key="panel" {...panelAnim}
            transition={{ duration:0.26, ease:[0.22,1,0.36,1] }} style={panelStyle}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0"
              style={{ background:'rgba(29,78,216,.07)', backdropFilter:'blur(8px)' }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <TomiAvatar size={38} mood={personalityMood(personality)} loading={loading} />
                  {/* Speaking glow ring */}
                  {isSpeaking && (
                    <motion.div
                      animate={{ scale: [1, 1.45, 1], opacity: [0.7, 0.2, 0.7] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-[-4px] rounded-full border-2 border-[#93bbfd]"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">Томи</span>
                    <AnimatePresence mode="wait">
                      {isSpeaking ? (
                        <motion.span key="speaking"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/20 border border-[#1d4ed8]/35 text-[#93bbfd] font-medium">
                          {/* mini waveform */}
                          {[0.6,1,0.7,1,0.5].map((h,i) => (
                            <motion.span key={i}
                              animate={{ scaleY:[h,1,h*0.3,1,h] }}
                              transition={{ duration:0.6+i*0.08, repeat:Infinity, delay:i*0.06 }}
                              className="inline-block w-[2px] rounded-full bg-[#93bbfd]"
                              style={{ height:10, transformOrigin:'center' }}
                            />
                          ))}
                          говорит
                        </motion.span>
                      ) : (
                        <motion.span key="online"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                          онлайн
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {hasPlanContext && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/20 border border-[#1d4ed8]/30 text-[#93bbfd] font-medium">
                        ⚡ план активен
                      </span>
                    )}
                  </div>
                  <p className="text-white/35 text-[11px] leading-tight">
                    {isSpeaking
                      ? <motion.span animate={{ opacity:[1,0.5,1] }} transition={{ duration:1.2, repeat:Infinity }}
                          className="text-[#93bbfd]/70">Томи отвечает голосом…</motion.span>
                      : <>{username ? `${username} 👋` : 'Персональный AI-менеджер'}{hasPlanContext && ' · умеет управлять задачами'}</>
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {totalTok > 0 && (
                  <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white/25 text-[10px] mr-1">
                    <Sparkles className="w-2.5 h-2.5" /> {totalTok.toLocaleString()}
                  </div>
                )}

                {/* Wake word toggle */}
                {voiceSupported && (
                  <button
                    onClick={toggleWake}
                    title={wakeEnabled ? 'Выключить «Эй Томи»' : 'Включить wake word «Томи»'}
                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all touch-manipulation ${
                      wakeEnabled
                        ? 'bg-[#1d4ed8]/25 border border-[#1d4ed8]/40'
                        : 'hover:bg-white/8'
                    }`}
                  >
                    {/* Pulse ring when actively listening */}
                    {wakeActive && (
                      <motion.div
                        animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="absolute inset-0 rounded-xl border border-[#1d4ed8]/50"
                      />
                    )}
                    <Radio className={`w-4 h-4 transition-colors ${wakeEnabled ? (wakeActive ? 'text-[#93bbfd]' : 'text-[#1d4ed8]') : 'text-white/25'}`} />
                  </button>
                )}

                {/* TTS toggle */}
                {ttsSupported && (
                  <button
                    onClick={toggleTts}
                    title={ttsEnabled ? 'Выключить голос Томи' : 'Включить голос Томи'}
                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all touch-manipulation ${
                      ttsEnabled
                        ? 'bg-[#1d4ed8]/25 border border-[#1d4ed8]/40'
                        : 'hover:bg-white/8'
                    }`}
                  >
                    {/* Sound wave rings when speaking */}
                    {isSpeaking && (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity }}
                          className="absolute inset-0 rounded-xl border border-[#1d4ed8]/60"
                        />
                        <motion.div
                          animate={{ scale: [1, 2.0], opacity: [0.3, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: 0.2 }}
                          className="absolute inset-0 rounded-xl border border-[#1d4ed8]/30"
                        />
                      </>
                    )}
                    {ttsEnabled
                      ? <Volume2 className={`w-4 h-4 transition-colors ${isSpeaking ? 'text-[#93bbfd]' : 'text-[#1d4ed8]'}`} />
                      : <VolumeX className="w-4 h-4 text-white/25" />
                    }
                  </button>
                )}

                <button onClick={clear} className="w-9 h-9 rounded-xl hover:bg-white/8 flex items-center justify-center transition-colors group touch-manipulation">
                  <Trash2 className="w-4 h-4 text-white/25 group-hover:text-red-400 transition-colors" />
                </button>
                <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-white/8 flex items-center justify-center transition-colors touch-manipulation">
                  {isMobile ? <X className="w-5 h-5 text-white/50" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                </button>
              </div>
            </div>

            {/* Personality + context */}
            <div className="border-b border-white/6 bg-white/2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2">
                <PersonalitySelector current={personality} onChange={handlePersonalityChange} />
                <button
                  onClick={() => setShowSliders(s => !s)}
                  title="Настроить тон Томи"
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-medium border transition-all touch-manipulation ${
                    showSliders
                      ? 'bg-[#1d4ed8]/20 border-[#1d4ed8]/40 text-[#93bbfd]'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
                  }`}>
                  <SlidersHorizontal className="w-3 h-3" />
                  Тон
                </button>
                <AnimatePresence>
                  {externalContext && (
                    <motion.div initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:'auto' }} exit={{ opacity:0, width:0 }}
                      className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 overflow-hidden">
                      <Zap className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                      <span className="text-[#93bbfd] text-[10px] truncate opacity-80">{externalContext.slice(0, 50)}…</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {showSliders && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden">
                    <div className="px-4 pb-3 space-y-2.5">
                      {/* Strictness slider */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/40">Мягкость ↔ Строгость</span>
                          <span className="text-[10px] text-[#93bbfd] font-medium">{sliders.strictness}%</span>
                        </div>
                        <input type="range" min={0} max={100} value={sliders.strictness}
                          onChange={e => handleSliderChange('strictness', +e.target.value)}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: '#1d4ed8' }} />
                      </div>
                      {/* Humor slider */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/40">Серьёзность ↔ Юмор</span>
                          <span className="text-[10px] text-[#93bbfd] font-medium">{sliders.humor}%</span>
                        </div>
                        <input type="range" min={0} max={100} value={sliders.humor}
                          onChange={e => handleSliderChange('humor', +e.target.value)}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: '#1d4ed8' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,.08) transparent',
                       WebkitOverflowScrolling:'touch' } as React.CSSProperties}>
              {messages.map(m => (
                <Bubble key={m.id} msg={m}
                  onApplyAction={handleApplyAction}
                  onDismissAction={() => {}} />
              ))}
              {loading && <TypingBubble />}

              {showQuick && (
                <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}
                  className="flex flex-col gap-1.5 pt-1">
                  <p className="text-[10px] text-white/25 font-medium uppercase tracking-wider px-0.5">Быстрые вопросы</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK.map(q => (
                      <button key={q.text} onClick={() => send(q.text)}
                        className="text-xs px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/55 hover:text-white/90 hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/10 transition-all active:scale-95 touch-manipulation text-left leading-snug">
                        {q.emoji} {q.text}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <span>{error}</span>
                  <button onClick={() => { setError(''); const last = messages.filter(m => m.role==='user').at(-1); if (last) send(last.content); }}
                    className="shrink-0 flex items-center gap-1 hover:text-red-300 transition-colors font-medium touch-manipulation">
                    <RotateCcw className="w-3 h-3" /> Повтор
                  </button>
                </motion.div>
              )}

              {isMobile && totalTok > 0 && (
                <p className="text-center text-white/18 text-[10px] flex items-center justify-center gap-1 pt-1">
                  <Sparkles className="w-2.5 h-2.5" /> {totalTok.toLocaleString()} токенов
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 pt-2 border-t border-white/8 shrink-0"
              style={{ paddingBottom: isMobile ? 'max(0.75rem, env(safe-area-inset-bottom))' : '0.75rem' }}>

              {/* Voice recording indicator */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-2"
                  >
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/22">
                      <motion.div animate={{ scale: [1,1.5,1], opacity:[1,0.5,1] }}
                        transition={{ duration:0.9, repeat:Infinity }}
                        className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[0.5,1,0.7,1,0.4,0.8,0.6].map((h,i) => (
                          <motion.div key={i}
                            animate={{ scaleY:[h,1,h*0.3,1,h] }}
                            transition={{ duration:0.8+i*0.1, repeat:Infinity, delay:i*0.07 }}
                            className="w-[3px] rounded-full bg-red-400"
                            style={{ height:18, transformOrigin:'center' }}
                          />
                        ))}
                      </div>
                      <span className="flex-1 text-xs text-red-300/80 truncate min-w-0 italic">
                        {interimText || 'Слушаю…'}
                      </span>
                      <button onClick={stopVoice}
                        className="shrink-0 text-[11px] font-semibold text-red-400/70 hover:text-red-300 border border-red-500/20 px-2 py-0.5 rounded-lg transition-colors touch-manipulation">
                        Стоп
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice error */}
              <AnimatePresence>
                {voiceError && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="flex items-start gap-2 px-3 py-2 mb-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <span className="flex-1">{voiceError}</span>
                    <button onClick={() => setVoiceError('')} className="shrink-0 hover:text-red-300 touch-manipulation">✕</button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={`flex items-end gap-2 rounded-2xl px-3.5 py-2.5 transition-all ${
                isRecording
                  ? 'bg-red-500/5 border border-red-500/25'
                  : 'bg-white/5 border border-white/10 focus-within:border-[#1d4ed8]/45 focus-within:bg-[#1d4ed8]/5'
              }`}>
                <textarea
                  ref={inputRef} value={draft} onChange={handleInput} onKeyDown={handleKey}
                  placeholder={
                    isRecording ? (interimText || 'Говорите…')
                    : hasPlanContext
                      ? (username ? `${username}, скажи что сделать...` : 'Удали, переименуй, измени статус...')
                      : (username ? `Спроси меня, ${username}...` : 'Спроси Томи что угодно...')
                  }
                  rows={1} disabled={loading || isRecording}
                  className="flex-1 bg-transparent text-white placeholder-white/22 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
                  style={{ maxHeight:130, minHeight:22, fontSize: isMobile ? 16 : 14 }}
                />

                {/* Send */}
                <button onClick={() => send()} disabled={!draft.trim() || loading || isRecording}
                  className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed shadow-md shadow-[#1d4ed8]/25 touch-manipulation">
                  {loading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                </button>

                {/* Mic */}
                {voiceSupported && (
                  <button onClick={isRecording ? stopVoice : startVoice} disabled={loading}
                    className="shrink-0 relative w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-25 touch-manipulation"
                    style={isRecording
                      ? { background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.4)' }
                      : { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)' }}
                    title={isRecording ? 'Остановить запись' : 'Голосовое сообщение (ru)'}>
                    {isRecording && (
                      <motion.div animate={{ scale:[1,1.8], opacity:[0.6,0] }}
                        transition={{ duration:1.0, repeat:Infinity }}
                        className="absolute inset-0 rounded-xl border border-red-400/60" />
                    )}
                    {isRecording
                      ? <Radio className="w-3.5 h-3.5 text-red-400" />
                      : <Mic className="w-3.5 h-3.5 text-white/50" />
                    }
                  </button>
                )}
              </div>

              {/* Stop TTS bar */}
              <AnimatePresence>
                {isSpeaking && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-1.5"
                  >
                    <button
                      onClick={() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }}
                      className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl text-[11px] font-semibold text-[#93bbfd] border border-[#1d4ed8]/25 bg-[#1d4ed8]/8 hover:bg-[#1d4ed8]/15 transition-colors touch-manipulation"
                    >
                      {/* Mini waveform */}
                      <span className="flex items-center gap-[2px]">
                        {[0.6,1,0.5,1,0.7,1,0.4].map((h,i) => (
                          <motion.span key={i}
                            animate={{ scaleY:[h,1,h*0.2,1,h] }}
                            transition={{ duration:0.7+i*0.07, repeat:Infinity, delay:i*0.05 }}
                            className="inline-block w-[2px] rounded-full bg-[#93bbfd]"
                            style={{ height:12, transformOrigin:'center' }}
                          />
                        ))}
                      </span>
                      Остановить голос
                      <VolumeX className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isMobile && (
                <p className="text-center text-white/12 text-[10px] mt-1.5">
                  Enter — отправить · Shift+Enter — перенос{voiceSupported ? ' · 🎤 голос' : ''}{wakeEnabled ? ' · 📡 wake: «Томи»' : ''}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div key="bd" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
        )}
      </AnimatePresence>

      {/* FAB */}
      <AnimatePresence>
        {(!open || !isMobile) && (
          <motion.button
            key="fab"
            initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.8, opacity:0 }}
            transition={{ duration:0.2 }}
            onClick={() => setOpen(o => !o)}
            whileHover={{ scale:1.06 }} whileTap={{ scale:0.92 }}
            className="fixed right-4 sm:right-6 z-[9999] flex items-center gap-2.5 pl-3 pr-4 rounded-2xl text-white font-semibold text-sm select-none touch-manipulation"
            style={{
              height: isMobile ? 52 : 48,
              bottom: isMobile ? 'calc(5.5rem + env(safe-area-inset-bottom))' : '1.25rem',
              background: open
                ? 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%)'
                : 'linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%)',
              boxShadow: open
                ? '0 8px 28px rgba(29,78,216,.6), 0 0 0 2px rgba(29,78,216,.3)'
                : '0 6px 22px rgba(29,78,216,.5)',
            }}
          >
            <AnimatePresence mode="wait">
              {open
                ? <motion.span key="x" initial={{ rotate:-90,opacity:0 }} animate={{ rotate:0,opacity:1 }} exit={{ rotate:90,opacity:0 }} transition={{ duration:0.18 }}>
                    <X className="w-4 h-4" />
                  </motion.span>
                : <motion.span key="av" initial={{ scale:0.7,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:0.7,opacity:0 }} transition={{ duration:0.18 }}>
                    <TomiAvatar size={26} mood={personalityMood(personality)} />
                  </motion.span>
              }
            </AnimatePresence>
            <span>Томи</span>
            {!open && wakeActive && (
              <motion.span
                animate={{ scale:[1,1.3,1], opacity:[0.7,1,0.7] }}
                transition={{ duration:1.5, repeat:Infinity }}
                title="Wake word активен — скажи «Томи»"
                className="w-2 h-2 rounded-full bg-blue-300"
              />
            )}
            {!open && !wakeActive && (
              <motion.span animate={{ scale:[1,1.4,1], opacity:[1,0.6,1] }}
                transition={{ duration:2.2, repeat:Infinity, repeatDelay:2 }}
                className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Provider ───────────────────────────────────────���──────────────────────────
export function TomiProvider({ children }: { children: ReactNode }) {
  const [context,           setContextState]           = useState('');
  const [planStatsState,    setPlanStatsState]         = useState<PlanStats | undefined>(undefined);
  const [forceOpen,         setForceOpen]              = useState(false);
  const [planActionHandler, setPlanActionHandlerState] = useState<((a: PlanAction) => void) | null>(null);
  const [chatOpen,          setChatOpen]               = useState(false);
  const [seedMsg,           setSeedMsg]                = useState('');

  const handleSetContext    = useCallback((ctx: string, stats?: PlanStats) => {
    setContextState(ctx);
    setPlanStatsState(stats);
  }, []);
  const handleForceOpen     = useCallback(() => setForceOpen(true), []);
  const handleSetPAH        = useCallback((fn: ((a: PlanAction) => void) | null) => {
    setPlanActionHandlerState(() => fn);
  }, []);
  const handleOpenWithSeed  = useCallback((msg: string) => {
    setSeedMsg(msg);
    setForceOpen(true);
  }, []);
  const handleSeedConsumed  = useCallback(() => setSeedMsg(''), []);

  return (
    <TomiCtx.Provider value={{
      setContext:           handleSetContext,
      openTomi:             handleForceOpen,
      setPlanActionHandler: handleSetPAH,
      openTomiWithSeed:     handleOpenWithSeed,
    }}>
      {children}
      <TomiWidgetConnected
        externalContext={context}
        planActionHandler={planActionHandler}
        forceOpen={forceOpen}
        onForceOpenHandled={() => setForceOpen(false)}
        onOpenChange={setChatOpen}
        seedMsg={seedMsg}
        onSeedConsumed={handleSeedConsumed}
        planStats={planStatsState}
      />
      <TomiNotificationBubble
        chatOpen={chatOpen}
        onAction={handleForceOpen}
      />
    </TomiCtx.Provider>
  );
}