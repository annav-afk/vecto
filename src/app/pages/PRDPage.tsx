import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, ChevronRight, ChevronDown, Code2, Database, Layers, Shield,
  Sparkles, Users, BarChart2, Smartphone, Globe, Lock, Cpu,
  CheckCircle2, AlertCircle, Clock, Star, ArrowLeft, Copy, Check,
  FileText, Boxes, Workflow, Palette, Wifi, TestTube, Download,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { copyToClipboard } from '../lib/clipboard';

// ── Types ────────────────────────────────────────────────────────────────────
type Status = 'done' | 'in_progress' | 'planned' | 'future';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface Requirement {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  component?: string;
}

interface Section {
  id: string;
  icon: typeof Zap;
  title: string;
  color: string;
  content: React.ReactNode;
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  done:        { label: 'Готово',       color: '#10b981', bg: '#f0fdf7', dot: '#10b981' },
  in_progress: { label: 'В работе',     color: '#1d4ed8', bg: '#eff6ff', dot: '#1d4ed8' },
  planned:     { label: 'Запланировано',color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  future:      { label: 'Будущее',      color: '#94a3b8', bg: '#f8fafc', dot: '#94a3b8' },
};
const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string }> = {
  P0: { color: '#ef4444', bg: '#fef2f2' },
  P1: { color: '#f59e0b', bg: '#fffbeb' },
  P2: { color: '#1d4ed8', bg: '#eff6ff' },
  P3: { color: '#94a3b8', bg: '#f8fafc' },
};

// ── Requirements data ────────────────────────────────────────────────────────
const REQUIREMENTS: Requirement[] = [
  // Core
  { id: 'R-001', title: 'AI-генерация плана', description: 'Пользователь вводит цель на естественном языке → AI генерирует структурированный план с фазами, задачами, приоритетами и временными оценками.', status: 'done', priority: 'P0', component: 'GoalInputPage, mockAI.ts, server/index.tsx' },
  { id: 'R-002', title: 'Управление задачами (CRUD)', description: 'Создание, редактирование, удаление задач с полным набором полей: название, описание, дата, приоритет, статус, часы, зависимости.', status: 'done', priority: 'P0', component: 'TaskEditModal.tsx, storage.ts' },
  { id: 'R-003', title: 'Три вида отображения', description: 'Timeline (Ганта-диаграмма со стрелками зависимостей), Kanban (drag & drop), Календарь — переключение хоткеями T/K/C.', status: 'done', priority: 'P0', component: 'TimelineView, KanbanView, CalendarView' },
  { id: 'R-004', title: 'Аутентификация', description: 'Email/пароль регистрация и вход через Supabase Auth. Автоматическое подтверждение email. Защищённые роуты на сервере.', status: 'done', priority: 'P0', component: 'AuthModal.tsx, auth.tsx, server/auth' },
  { id: 'R-005', title: 'Cloud sync', description: 'Все планы синхронизируются с Supabase KV-хранилищем. Оптимистичные обновления — UI не блокируется ожиданием сети. Rollback при ошибке.', status: 'done', priority: 'P0', component: 'api.ts, DashboardPage, PlanPage' },
  { id: 'R-006', title: 'Undo / Redo (Ctrl+Z)', description: 'Стек из 30 операций в памяти. Работает для всех мутаций плана: создание, редактирование, удаление, смена статуса, bulk-действия.', status: 'done', priority: 'P1', component: 'useUndoRedo.ts' },
  { id: 'R-007', title: 'AI-расширение фазы', description: 'Кнопка ✨ у каждой фазы → GPT-4o-mini анализирует существующие задачи и генерирует 3–5 новых с учётом контекста. Пользователь выбирает нужные.', status: 'done', priority: 'P1', component: 'AIExpandModal.tsx, server/ai/expand-phase' },
  { id: 'R-008', title: 'Time tracking', description: 'Таймер ▶/⏹ на каждой Kanban-карточке. Фиксирует tracked_seconds в задаче. Отображается в карточке, в модале, в Focus Mode.', status: 'done', priority: 'P1', component: 'KanbanView.tsx, TaskEditModal.tsx' },
  { id: 'R-009', title: 'Focus Mode (Pomodoro)', description: 'Fullscreen тёмный режим: таймер 25/5 мин, кольцо прогресса, счётчик 🍅, заметки к задаче, кнопка «Отметить выполненной». Хоткей F.', status: 'done', priority: 'P1', component: 'FocusMode.tsx' },
  { id: 'R-010', title: 'Bulk Actions', description: 'Выделение нескольких задач чекбоксами в Kanban. Плавающая панель: Выполнено / В работу / Приоритет / Удалить. Работает с undo.', status: 'done', priority: 'P1', component: 'BulkActionBar.tsx, KanbanView.tsx' },
  { id: 'R-011', title: 'Inline-редактирование', description: 'Двойной клик по названию задачи в Kanban → input на месте карточки. Enter/Blur сохраняет без открытия модала.', status: 'done', priority: 'P1', component: 'KanbanView.tsx (TaskCard)' },
  { id: 'R-012', title: 'Комментарии к задаче', description: 'Вкладка «Заметки» в TaskEditModal. История комментариев с датой. Enter отправляет, каждую можно удалить. Хранятся в Task.comments[].', status: 'done', priority: 'P1', component: 'TaskEditModal.tsx' },
  { id: 'R-013', title: 'Кастомные поля', description: 'Вкладка «Поля»: теги (chips), ссылка с превью, оценка сложности 1–5. Сохраняются в Task.tags, task.link_url, task.difficulty.', status: 'done', priority: 'P2', component: 'TaskEditModal.tsx' },
  { id: 'R-014', title: 'Прогноз завершения', description: 'Velocity за последние 7 дней (задач/день) → forecast_date = now + remaining/velocity. Отображается в header плана рядом с progress bar.', status: 'done', priority: 'P1', component: 'PlanPage.tsx' },
  { id: 'R-015', title: 'Activity Heatmap', description: 'GitHub-стиль: 16 недель × 7 дней. recordActivity() вызывается при каждом закрытии задачи. Серия дней, всего выполнено, активных дней.', status: 'done', priority: 'P2', component: 'ActivityHeatmap.tsx, activity.ts' },
  { id: 'R-016', title: 'Weekly Digest', description: 'Модал с итогами недели: выполнено/просрочено/velocity/прогноз/прогресс по фазам. PDF (window.print), Email через Resend API.', status: 'done', priority: 'P2', component: 'WeeklyDigest.tsx, server/digest/email' },
  { id: 'R-017', title: 'Повторяющиеся задачи', description: 'Флаг recurring + интервал (ежедневно/еженедельно/раз в 2 нед/ежемесячно). Отображаются значком ↻ в Kanban и Timeline.', status: 'done', priority: 'P2', component: 'TaskEditModal.tsx (вкладка Повтор)' },
  { id: 'R-018', title: 'Зависимости задач', description: 'Вкладка «Зависит» в модале: выбор задач из списка с поиском. На Timeline рисуются SVG-стрелки зависимостей.', status: 'done', priority: 'P2', component: 'TaskEditModal.tsx, TimelineView.tsx' },
  { id: 'R-019', title: 'Публичные ссылки / Share', description: 'Генерация share_id, хранение в KV. Страница /share/:id в режиме read-only с Timeline и статистикой. Кнопка «Использовать как шаблон».', status: 'done', priority: 'P2', component: 'SharePage.tsx, server/share' },
  { id: 'R-020', title: 'Onboarding checklist', description: 'Виджет в Dashboard: 6 шагов с XP (+50…+100). Gamification. Прогресс-бар. Закрывается крестиком. Шаги отмечаются автоматически.', status: 'done', priority: 'P2', component: 'OnboardingChecklist.tsx' },
  { id: 'R-021', title: 'Offline Queue', description: 'Неудачные cloud-операции сохраняются в localStorage. При восстановлении сети — автоматический flush. До 5 попыток на операцию.', status: 'done', priority: 'P2', component: 'offlineQueue.ts' },
  { id: 'R-022', title: 'Referral система', description: 'Генерация уникального кода fp-XXXXXX. При применении — +2 extra плана обеим сторонам. Хранение в KV. server/referral/*.', status: 'done', priority: 'P2', component: 'server/referral/generate|apply|code' },
  { id: 'R-023', title: 'Paywall (Free limit)', description: '5 планов/месяц на бесплатном тарне. Счётчик в Dashboard. Модал PaywallModal со ссылкой на Stripe. Pro снимает ограничение.', status: 'done', priority: 'P0', component: 'PaywallModal.tsx, storage.ts' },
  { id: 'R-024', title: 'Экспорт (Notion, PDF)', description: 'ExportModal: копирование в Notion-формате (Markdown), экспорт JSON, PDF через window.print с кастомным CSS.', status: 'done', priority: 'P2', component: 'ExportModal.tsx' },
  { id: 'R-025', title: 'Аналитика (burn-down)', description: 'AnalyticsPanel: burn-down chart, velocity по фазам, heatmap активности. Библиотека recharts.', status: 'done', priority: 'P2', component: 'AnalyticsPanel.tsx' },
  { id: 'R-026', title: 'Поиск и фильтры', description: 'Строка поиска по названию + 3 фильтра: статус, приоритет, этап. Активные фильтры считаются. Кнопка «Сбросить».', status: 'done', priority: 'P1', component: 'PlanPage.tsx' },
  { id: 'R-027', title: 'Горячие клавиши', description: 'T/K/C (виды), N (новый план), A (аналитика), F (фокус), Ctrl+Z/Y (undo/redo), ? (подсказка), Esc (закрыть). Оверлей справки.', status: 'done', priority: 'P2', component: 'PlanPage.tsx (HotkeysOverlay)' },
  { id: 'R-028', title: 'PWA (Progressive Web App)', description: 'manifest.json + service worker. Установка на рабочий стол. Работает оффлайн (кешированные ресурсы). Push-уведомления — planned.', status: 'done', priority: 'P2', component: 'public/manifest.json, sw.js' },
  { id: 'R-029', title: 'Тёмная тема', description: 'ThemeContext + next-themes. CSS-переменные. Все компоненты адаптированы. Синхронизация с prefers-color-scheme.', status: 'done', priority: 'P2', component: 'ThemeContext, theme.css' },
  { id: 'R-030', title: 'Drag & Drop Kanban', description: 'react-dnd + HTML5Backend. Карточки между колонками, анимация при переносе. При drop в Done — конфетти.', status: 'done', priority: 'P1', component: 'KanbanView.tsx' },
  { id: 'R-031', title: 'Deadline alerts', description: 'Баннеры просроченных задач (красный) и задач с дедлайном через 3 дня (янтарный) над основным контентом плана.', status: 'done', priority: 'P1', component: 'PlanPage.tsx (DeadlineAlerts)' },
  { id: 'R-032', title: 'Шаблоны планов', description: 'TemplatesModal: 5+ готовых шаблонов (стартап, обучение, ремонт, фитнес, книга). Один клик — создаёт план из шаблона.', status: 'done', priority: 'P2', component: 'TemplatesModal.tsx' },
  { id: 'R-033', title: 'Onboarding Tour', description: 'driver.js пошаговая экскурсия по интерфейсу при первом открытии плана. 4 шага: статистика, фазы, виды, аналитика.', status: 'done', priority: 'P2', component: 'OnboardingTour.tsx' },
  { id: 'R-034', title: 'Мобильный swipe', description: 'Свайп влево/вправо меняет активный вид (Timeline ↔ Kanban ↔ Календарь). Порог 60px.', status: 'done', priority: 'P2', component: 'PlanPage.tsx' },
  { id: 'R-035', title: 'ErrorBoundary', description: 'Обёртка вокруг всего приложения. При падении компонента — fallback UI с кнопкой перезагрузки вместо белого экрана.', status: 'done', priority: 'P1', component: 'ErrorBoundary.tsx' },
  { id: 'R-036', title: 'Конфетти при выполнении', description: 'ConfettiBurst при переводе задачи в Done (из Kanban, из модала, из bulk-actions, из Focus Mode).', status: 'done', priority: 'P3', component: 'ConfettiBurst.tsx' },
  // Planned
  { id: 'R-037', title: 'Invite Collaborators', description: 'Приглашение по email с правами viewer/editor. Real-time синхронизация через Supabase Realtime. Activity feed.', status: 'planned', priority: 'P1', component: '—' },
  { id: 'R-038', title: 'Stripe Billing Portal', description: 'Подписка Pro через Stripe. Webhook для активации. Customer Portal для управления подпиской. Extra plans через referral.', status: 'planned', priority: 'P0', component: '—' },
  { id: 'R-039', title: 'Supabase Realtime', description: 'Подписка на изменения KV — мгновенная синхронизация между вкладками и устройствами без перезагрузки.', status: 'planned', priority: 'P1', component: '—' },
  { id: 'R-040', title: 'Drag-to-reschedule Timeline', description: 'Перетаскивание задачи по горизонтали на Ганте меняет start_date/end_date.', status: 'planned', priority: 'P2', component: '—' },
  { id: 'R-041', title: 'Push notifications', description: 'Web Push API: напоминания о дедлайнах, ежедневная сводка прогресса.', status: 'future', priority: 'P2', component: '—' },
  { id: 'R-042', title: 'AI-ассистент в чате', description: 'Floating AI-чат внутри плана: «Что мне сделать сегодня?», «Почему я отстаю?», переформулировать задачу.', status: 'future', priority: 'P1', component: '—' },
  { id: 'R-043', title: 'Vitest тесты', description: 'Unit-тесты для mockAI.ts, storage.ts, useUndoRedo.ts, offlineQueue.ts. E2E через Playwright.', status: 'future', priority: 'P2', component: '—' },
];

// ── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'typescript' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl bg-[#0d0d1a] border border-white/10 overflow-hidden my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
        <span className="text-xs text-white/40">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
          {copied ? <Check className="w-3 h-3 text-[#10b981]" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs text-white/80 overflow-x-auto leading-relaxed" style={{ fontFamily: 'monospace' }}>{code}</pre>
    </div>
  );
}

// ── Badge components ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border" style={{ background: c.bg, color: c.color, borderColor: `${c.color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
function PriorityBadge({ p }: { p: Priority }) {
  const c = PRIORITY_CONFIG[p];
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-md" style={{ background: c.bg, color: c.color, fontWeight: 600 }}>{p}</span>
  );
}

// ── Accordion ────────────────────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden mb-3">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
        <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/40" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-slate-100 dark:border-white/8 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Requirements table ────────────────────────────────────────────────────────
function RequirementsTable({ filter }: { filter?: Status }) {
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>(filter ?? 'all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = REQUIREMENTS.filter(r => {
    const matchStatus   = statusFilter === 'all' || r.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    const matchSearch   = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPriority && matchSearch;
  });

  const counts = {
    done:        REQUIREMENTS.filter(r => r.status === 'done').length,
    in_progress: REQUIREMENTS.filter(r => r.status === 'in_progress').length,
    planned:     REQUIREMENTS.filter(r => r.status === 'planned').length,
    future:      REQUIREMENTS.filter(r => r.status === 'future').length,
  };

  return (
    <div>
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.entries(counts) as [Status, number][]).map(([s, n]) => {
          const c = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{ background: statusFilter === s ? c.bg : 'transparent', color: c.color, borderColor: `${c.color}30`, fontWeight: statusFilter === s ? 600 : 400 }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
              {c.label} ({n})
            </button>
          );
        })}
      </div>

      {/* Search + priority filter */}
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ID или названию..."
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-[#1d4ed8]/40 transition-colors" />
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)}
          className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 focus:outline-none cursor-pointer">
          <option value="all">Все приоритеты</option>
          {(['P0','P1','P2','P3'] as Priority[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
              <th className="text-left px-4 py-3 text-slate-500 dark:text-white/50" style={{ fontWeight: 600 }}>ID</th>
              <th className="text-left px-4 py-3 text-slate-500 dark:text-white/50" style={{ fontWeight: 600 }}>Требование</th>
              <th className="text-left px-4 py-3 text-slate-500 dark:text-white/50 hidden lg:table-cell" style={{ fontWeight: 600 }}>Компонент</th>
              <th className="text-left px-4 py-3 text-slate-500 dark:text-white/50" style={{ fontWeight: 600 }}>Приоритет</th>
              <th className="text-left px-4 py-3 text-slate-500 dark:text-white/50" style={{ fontWeight: 600 }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} className={`border-b border-slate-100 dark:border-white/8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                <td className="px-4 py-3">
                  <span className="text-slate-400 dark:text-white/30 font-mono">{r.id}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-900 dark:text-white mb-0.5" style={{ fontWeight: 500 }}>{r.title}</div>
                  <div className="text-slate-400 dark:text-white/35 text-xs leading-relaxed max-w-sm">{r.description}</div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-slate-400 dark:text-white/35 font-mono text-xs">{r.component}</span>
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge p={r.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-white/30 text-sm">Ничего не найдено</div>
        )}
      </div>
      <p className="text-xs text-slate-400 dark:text-white/30 mt-2">{filtered.length} из {REQUIREMENTS.length} требований</p>
    </div>
  );
}

// ── Architecture diagram (text-based) ───────────────────────────────────────
function ArchDiagram() {
  const layers = [
    {
      label: 'Frontend (React 18 + Vite)',
      color: '#1d4ed8',
      items: ['LandingPage', 'GoalInputPage', 'DashboardPage', 'PlanPage', 'SharePage', 'PRDPage'],
    },
    {
      label: 'Components (UI Layer)',
      color: '#2563eb',
      items: ['TimelineView', 'KanbanView', 'CalendarView', 'TaskEditModal', 'FocusMode', 'AIExpandModal', 'WeeklyDigest', 'BulkActionBar', 'ActivityHeatmap', 'OnboardingChecklist'],
    },
    {
      label: 'State & Storage (Client)',
      color: '#3b82f6',
      items: ['useUndoRedo', 'activity.ts', 'offlineQueue.ts', 'storage.ts (localStorage)', 'auth.tsx (Supabase session)'],
    },
    {
      label: 'Supabase Edge Function (Deno + Hono)',
      color: '#10b981',
      items: ['POST /auth/signup', 'GET|POST|DELETE /plans', 'GET|POST /usage', 'POST /ai/expand-phase', 'GET|POST /share', 'POST /digest/email', 'GET|POST /referral/*'],
    },
    {
      label: 'External Services',
      color: '#f59e0b',
      items: ['OpenAI API (GPT-4o-mini)', 'Resend API (Email)', 'Supabase Auth', 'Supabase KV Store (kv_store_a5927615)', 'Stripe (planned)'],
    },
  ];

  return (
    <div className="space-y-2">
      {layers.map((layer, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: layer.color }} />
            <span className="text-xs text-slate-600 dark:text-white/60" style={{ fontWeight: 600 }}>{layer.label}</span>
          </div>
          <div className="ml-4 flex flex-wrap gap-1.5 mb-2">
            {layer.items.map(item => (
              <span key={item} className="text-xs px-2.5 py-1 rounded-lg border font-mono" style={{ borderColor: `${layer.color}30`, background: `${layer.color}08`, color: layer.color }}>
                {item}
              </span>
            ))}
          </div>
          {i < layers.length - 1 && (
            <div className="ml-5 flex items-center gap-1 mb-1">
              <div className="w-px h-4 bg-slate-200 dark:bg-white/10 ml-0.5" />
              <ChevronRight className="w-3 h-3 text-slate-300 dark:text-white/20 -ml-0.5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function PRDPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [isPrinting, setIsPrinting] = useState(false);

  const handleDownloadPDF = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  const done   = REQUIREMENTS.filter(r => r.status === 'done').length;
  const total  = REQUIREMENTS.length;
  const pct    = Math.round((done / total) * 100);

  const NAV_ITEMS = [
    { id: 'overview',  label: 'Обзор',           icon: FileText },
    { id: 'arch',      label: 'Архитектура',      icon: Layers },
    { id: 'data',      label: 'Модель данных',    icon: Database },
    { id: 'api',       label: 'API',              icon: Code2 },
    { id: 'features',  label: 'Функциональность', icon: Boxes },
    { id: 'ux',        label: 'UX / UI',          icon: Palette },
    { id: 'security',  label: 'Безопасность',     icon: Shield },
    { id: 'perf',      label: 'Производительность',icon: Cpu },
    { id: 'roadmap',   label: 'Roadmap',          icon: Workflow },
    { id: 'requirements', label: 'Требования',    icon: TestTube },
  ];

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <h2 id={`section-${id}`} className="text-xl text-slate-900 dark:text-white mb-5 flex items-center gap-2.5 pt-2" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
      {children}
    </h2>
  );

  const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-sm text-slate-900 dark:text-white mb-3 mt-5" style={{ fontWeight: 600 }}>{children}</h3>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed mb-3">{children}</p>
  );

  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-white/60 mb-1.5">
      <CheckCircle2 className="w-3.5 h-3.5 text-[#1d4ed8] shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );

  const Tag = ({ children, color = '#1d4ed8' }: { children: string; color?: string }) => (
    <span className="inline-block text-xs px-2 py-0.5 rounded-md mr-1 mb-1" style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>{children}</span>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-[#eff6ff] dark:bg-[#0d0d1a] text-slate-900 dark:text-white">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside { display: none !important; }
          body, html { background: white !important; color: #0f172a !important; font-size: 12px; }
          main { max-width: 100% !important; margin: 0 !important; padding: 16px !important; }
          h2 { font-size: 16px !important; margin-top: 24px !important; break-before: page; page-break-before: page; }
          h2:first-of-type { break-before: auto; page-break-before: auto; }
          h3 { font-size: 13px !important; }
          .p-4, .p-5, .p-6, .p-8 { break-inside: avoid; padding: 8px !important; }
          .grid { display: block !important; }
          .grid > * { margin-bottom: 8px !important; }
          pre { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; font-size: 10px !important; color: #1e293b !important; padding: 8px !important; white-space: pre-wrap !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 4px 8px; }
          .rounded-xl, .rounded-2xl, .rounded-3xl { border-radius: 6px !important; border: 1px solid #e2e8f0 !important; }
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-2xl { box-shadow: none !important; }
          .overflow-hidden { overflow: visible !important; }
          [style*="height: 0"] { height: auto !important; }
          .sticky { position: static !important; }
          @page { margin: 15mm 20mm; size: A4; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print sticky top-0 z-40 bg-white/95 dark:bg-[#0d0d1a]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-900 dark:text-white text-sm" style={{ fontWeight: 700 }}>Vecto</span>
            <span className="text-slate-300 dark:text-white/20 text-sm">/</span>
            <span className="text-slate-500 dark:text-white/50 text-sm hidden sm:block">PRD & Технический документ</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-slate-400 dark:text-white/40 hidden md:block">v2.0 · 3 марта 2026</span>
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              {pct}% ({done}/{total})
            </div>
            {/* Download PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-xs hover:opacity-90 active:scale-95 transition-all shadow-sm shadow-[#1d4ed8]/25 disabled:opacity-60"
              style={{ fontWeight: 600 }}
            >
              <Download className="w-3.5 h-3.5" />
              {isPrinting ? 'Готовим...' : 'Скачать PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar nav */}
        <aside className="no-print hidden xl:block w-52 shrink-0">
          <div className="sticky top-24 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left ${activeSection === item.id ? 'bg-[#1d4ed8]/10 text-[#1d4ed8]' : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                style={{ fontWeight: activeSection === item.id ? 600 : 400 }}>
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-10">

          {/* ── TITLE ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-2xl bg-gradient-to-br from-[#1d4ed8]/8 via-[#2563eb]/5 to-[#3b82f6]/5 border border-[#1d4ed8]/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] flex items-center justify-center shadow-lg shadow-[#1d4ed8]/30">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.75rem' }} className="text-slate-900 dark:text-white">Vecto</h1>
                <p className="text-slate-500 dark:text-white/50 text-sm">Product Requirements Document · Техническое описание</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-white/60 text-sm leading-relaxed max-w-2xl mb-5">
              Vecto — AI-планировщик задач: пользователь описывает цель на естественном языке,
              система генерирует структурированный план с этапами, задачами, временными оценками и зависимостями.
              Инструмент для индивидуальных пользователей и небольших команд, которым нужна скорость, а не сложность Enterprise-систем.
            </p>
            <div className="flex flex-wrap gap-2">
              {['React 18', 'TypeScript', 'Tailwind CSS v4', 'Supabase', 'Deno + Hono', 'GPT-4o-mini', 'react-router', 'motion/react', 'recharts', 'react-dnd', 'Resend'].map(t => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </motion.div>

          {/* ── OVERVIEW ── */}
          <section id="section-overview">
            <H2 id="overview"><Globe className="w-5 h-5 text-[#1d4ed8]" />Обзор продукта</H2>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                { icon: Users, label: 'Целевая аудитория', value: 'Индивидуальные специалисты, фрилансеры, студенты, небольшие команды до 10 чел.', color: '#1d4ed8' },
                { icon: Star, label: 'Ключевое УТП', value: 'Описал цель словами → получил готовый план за 10 секунд. AI за вас декомпозирует задачу.', color: '#2563eb' },
                { icon: BarChart2, label: 'Монетизация', value: 'Freemium: 5 планов/мес бесплатно. Pro — неограниченно + коллаборация + приоритетный AI.', color: '#3b82f6' },
              ].map(card => (
                <div key={card.label} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${card.color}15` }}>
                    <card.icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                  <div className="text-xs text-slate-400 dark:text-white/40 mb-1" style={{ fontWeight: 500 }}>{card.label}</div>
                  <p className="text-sm text-slate-700 dark:text-white/70 leading-snug">{card.value}</p>
                </div>
              ))}
            </div>

            <Accordion title="Проблема и решение" defaultOpen>
              <H3>Проблема</H3>
              <ul className="space-y-1 mb-4">
                <Li>Существующие task-менеджеры (Jira, Asana, Notion) требуют ручной декомпозиции задач — это занимает часы</Li>
                <Li>Пользователь знает «что» хочет достичь, но не знает «как» — нет структурированного пути</Li>
                <Li>AI-инструменты (ChatGPT) дают текстовый ответ, не интегрированный в рабочий трекер</Li>
              </ul>
              <H3>Решение</H3>
              <ul className="space-y-1">
                <Li>Один промпт на естественном языке → структурированный план с фазами и задачами</Li>
                <Li>Встроенный трекер с Kanban, Timeline, Календарём — не нужны сторонние инструменты</Li>
                <Li>AI остаётся активным: расширяет фазы, анализирует velocity, даёт прогнозы</Li>
              </ul>
            </Accordion>

            <Accordion title="User Journey (основной сценарий)">
              <div className="space-y-3">
                {[
                  { step: '1', label: 'Описывает цель', desc: 'Пользователь вводит: «Запустить SaaS-продукт за 3 месяца, 20 часов в неделю»', color: '#1d4ed8' },
                  { step: '2', label: 'AI генерирует план', desc: 'GPT-4o-mini за 8–12 сек создаёт 4–6 фаз с задачами, приоритетами и временными оценками', color: '#2563eb' },
                  { step: '3', label: 'Управляет задачами', desc: 'Kanban/Timeline/Календарь, Drag&Drop, смена статусов, таймер, фокус-режим', color: '#3b82f6' },
                  { step: '4', label: 'Расширяет с AI', desc: 'Кнопка ✨ на фазе → AI генерирует +3–5 задач с учётом уже существующих', color: '#10b981' },
                  { step: '5', label: 'Анализирует прогресс', desc: 'Burn-down chart, velocity, heatmap, прогноз даты завершения', color: '#f59e0b' },
                  { step: '6', label: 'Делится / коллаборирует', desc: 'Публичная ссылка, «использовать как шаблон», приглашение коллег (planned)', color: '#ef4444' },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs text-white" style={{ background: s.color, fontWeight: 700 }}>{s.step}</div>
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 500 }}>{s.label}</p>
                      <p className="text-xs text-slate-400 dark:text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Accordion>
          </section>

          {/* ── ARCHITECTURE ── */}
          <section id="section-arch">
            <H2 id="arch"><Layers className="w-5 h-5 text-[#2563eb]" />Архитектура</H2>
            <P>Трёхуровневая архитектура: Frontend (React/Vite) → Edge Function (Deno/Hono) → Supabase (KV + Auth + Storage). Frontend не обращается к БД напрямую — всё через сервер.</P>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 mb-4">
              <ArchDiagram />
            </div>

            <Accordion title="Стратегия хранения данных">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { title: 'localStorage (клиент)', color: '#1d4ed8', items: ['stride_plans — массив Plan[]', 'stride_usage — {month, count}', 'stride_activity — DayActivity[]', 'stride_offline_queue — QueueItem[]', 'stride_onboarding — Record<stepId, bool>'] },
                  { title: 'Supabase KV (сервер)', color: '#10b981', items: ['user:{id}:plans — JSON планов', 'user:{id}:usage:{month} — счётчик', 'share:{shareId} — публичный план', 'referral:{code} — данные реферала', 'user:{id}:referral_code — код пользователя', 'user:{id}:extra_plans:{month} — бонусные планы'] },
                ].map(s => (
                  <div key={s.title} className="p-4 rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-sm" style={{ fontWeight: 600, color: s.color }}>{s.title}</span>
                    </div>
                    <ul className="space-y-1">
                      {s.items.map(i => <li key={i} className="text-xs text-slate-500 dark:text-white/50 font-mono">{i}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Accordion>

            <Accordion title="Оптимистичные обновления и Undo/Redo">
              <P>Все мутации применяются немедленно к localStorage и React state. Cloud sync — фоновый. При ошибке sync — откат через ErrorBoundary + toast.</P>
              <CodeBlock lang="typescript" code={`// useUndoRedo.ts — стек из 30 операций
const { present: plan, push, undo, redo } = useUndoRedo<Plan | null>(null);

// Мутация: сохранить → push в стек → фоновый cloud sync
const applyPlan = (updated: Plan) => {
  push(updated);          // history stack
  savePlan(updated);      // localStorage
  cloudSync(updated);     // Supabase (non-blocking)
};

// Ctrl+Z
const prev = undo();
if (prev) { savePlan(prev); cloudSync(prev); }`} />
            </Accordion>

            <Accordion title="Offline Queue">
              <P>Если cloud sync упал — операция попадает в offlineQueue (localStorage). При восстановлении сети — автоматический flush. До 5 попыток.</P>
              <CodeBlock lang="typescript" code={`// offlineQueue.ts
export async function flushQueue(token, ops) {
  const queue = getQueue();
  for (const item of queue) {
    try {
      if (item.type === 'save_plan') await ops.savePlan(item.payload, token);
      dequeue(item.id); // success
    } catch {
      // increment retries, remove after 5 fails
    }
  }
}`} />
            </Accordion>
          </section>

          {/* ── DATA MODEL ── */}
          <section id="section-data">
            <H2 id="data"><Database className="w-5 h-5 text-[#3b82f6]" />Модель данных</H2>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {[
                {
                  name: 'Plan',
                  color: '#1d4ed8',
                  fields: [
                    ['id', 'string', 'nanoid'],
                    ['goal', 'string', 'Цель пользователя'],
                    ['deadline', 'string', 'ISO date'],
                    ['hours_per_week', 'number', 'Часов в неделю'],
                    ['total_days', 'number', 'Дней до дедлайна'],
                    ['phases', 'Phase[]', 'Массив этапов'],
                    ['created_at', 'string', 'ISO date'],
                  ],
                },
                {
                  name: 'Phase',
                  color: '#2563eb',
                  fields: [
                    ['id', 'string', 'nanoid'],
                    ['name', 'string', 'Название этапа'],
                    ['duration_days', 'number', 'Длительность'],
                    ['color', 'string', 'HEX-цвет'],
                    ['tasks', 'Task[]', 'Задачи этапа'],
                    ['start_date', 'string', 'ISO date'],
                    ['end_date', 'string', 'ISO date'],
                  ],
                },
                {
                  name: 'Task',
                  color: '#3b82f6',
                  fields: [
                    ['id', 'string', 'nanoid'],
                    ['phase_id', 'string', 'FK → Phase.id'],
                    ['title', 'string', 'Название'],
                    ['description?', 'string', 'Описание/заметки'],
                    ['duration_hours', 'number', 'Оценка времени'],
                    ['priority', 'high|medium|low', 'Приоритет'],
                    ['status', 'todo|in_progress|done', 'Статус'],
                    ['depends_on', 'string[]', 'ID зависимостей'],
                    ['recurring?', 'boolean', 'Повторяющаяся'],
                    ['recurrence_interval?', 'daily|weekly|…', 'Интервал'],
                    ['tracked_seconds?', 'number', 'Факт. время (сек)'],
                    ['timer_start?', 'string', 'ISO — старт таймера'],
                    ['comments?', 'TaskComment[]', 'Заметки'],
                    ['tags?', 'string[]', 'Теги'],
                    ['link_url?', 'string', 'Ссылка'],
                    ['difficulty?', '1|2|3|4|5', 'Сложность'],
                  ],
                },
                {
                  name: 'TaskComment',
                  color: '#10b981',
                  fields: [
                    ['id', 'string', 'nanoid'],
                    ['text', 'string', 'Текст заметки'],
                    ['created_at', 'string', 'ISO datetime'],
                    ['author?', 'string', 'Имя автора'],
                  ],
                },
              ].map(model => (
                <div key={model.name} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: model.color }} />
                    <span className="text-sm font-mono" style={{ fontWeight: 700, color: model.color }}>interface {model.name}</span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {model.fields.map(([field, type, comment]) => (
                        <tr key={field} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                          <td className="py-1 pr-2 font-mono text-slate-700 dark:text-white/70">{field}</td>
                          <td className="py-1 pr-2 font-mono" style={{ color: model.color }}>{type}</td>
                          <td className="py-1 text-slate-400 dark:text-white/30">{comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {/* ── API ── */}
          <section id="section-api">
            <H2 id="api"><Code2 className="w-5 h-5 text-[#10b981]" />API Reference</H2>
            <P>Все запросы к Supabase Edge Function. Базовый URL: <code className="text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded font-mono">/functions/v1/make-server-a5927615</code></P>

            <div className="space-y-2">
              {[
                { method: 'POST', path: '/auth/signup', auth: false, desc: 'Регистрация. Body: {email, password, name}. email_confirm: true (авто).' },
                { method: 'GET',  path: '/plans', auth: true, desc: 'Все планы пользователя из KV. Returns: {plans: Plan[]}.' },
                { method: 'POST', path: '/plans', auth: true, desc: 'Сохранить/обновить план. Body: {plan: Plan}.' },
                { method: 'DELETE', path: '/plans/:id', auth: true, desc: 'Удалить план из KV.' },
                { method: 'GET',  path: '/usage', auth: true, desc: 'Счётчик планов за текущий месяц. Returns: {count: number}.' },
                { method: 'POST', path: '/usage/increment', auth: true, desc: 'Инкрементировать счётчик.' },
                { method: 'POST', path: '/share', auth: true, desc: 'Создать публичную ссылку. Returns: {shareId: string}.' },
                { method: 'GET',  path: '/share/:shareId', auth: false, desc: 'Получить публичный план. Returns: {plan, sharedAt}.' },
                { method: 'POST', path: '/ai/generate-plan', auth: false, desc: 'AI-генерация плана. Body: {goal, deadline, hoursPerWeek}. Вызывает OpenAI.' },
                { method: 'POST', path: '/ai/expand-phase', auth: false, desc: 'AI-расширение фазы. Body: {goal, phaseName, existingTasks, deadline, hoursPerWeek}.' },
                { method: 'POST', path: '/digest/email', auth: true, desc: 'Отправить еженедельный дайджест через Resend API.' },
                { method: 'GET',  path: '/referral/code', auth: true, desc: 'Получить реферальный код пользователя.' },
                { method: 'POST', path: '/referral/generate', auth: true, desc: 'Сгенерировать реферальный код fp-XXXXXX.' },
                { method: 'POST', path: '/referral/apply', auth: true, desc: 'Применить реферальный код. +2 плана обеим сторонам.' },
                { method: 'GET',  path: '/extra-plans', auth: true, desc: 'Количество бонусных планов за текущий месяц.' },
              ].map(ep => (
                <div key={ep.path} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 mt-0.5 ${ep.method === 'GET' ? 'bg-[#10b981]/10 text-[#10b981]' : ep.method === 'POST' ? 'bg-[#1d4ed8]/10 text-[#1d4ed8]' : 'bg-red-50 text-red-500'}`} style={{ fontWeight: 600 }}>
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono text-slate-700 dark:text-white/70">{ep.path}</span>
                    {ep.auth && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">🔒 Auth</span>}
                    <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FEATURES ── */}
          <section id="section-features">
            <H2 id="features"><Boxes className="w-5 h-5 text-[#f59e0b]" />Функциональность</H2>

            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              {[
                { icon: Sparkles, label: 'AI-ядро', color: '#2563eb', items: ['Генерация плана (GPT-4o-mini)', 'AI-расширение фазы (+3–5 задач)', 'Прогноз завершения (velocity × remaining)', 'Скрытый брендинг (no OpenAI mentions)'] },
                { icon: Workflow, label: 'Управление задачами', color: '#1d4ed8', items: ['CRUD задач с полным набором полей', 'Undo/Redo 30 операций (Ctrl+Z/Y)', 'Inline-редактирование (dbl-click)', 'Bulk actions: done/progress/priority/delete'] },
                { icon: BarChart2, label: 'Виды и аналитика', color: '#3b82f6', items: ['Timeline (Ганта + SVG-стрелки зависимостей)', 'Kanban (DnD, сортировка)', 'Календарь', 'Burn-down chart, velocity, heatmap'] },
                { icon: Clock, label: 'Продуктивность', color: '#10b981', items: ['Focus Mode (Pomodoro 25/5 мин)', 'Time Tracking (tracked_seconds)', 'Повторяющиеся задачи', 'Weekly Digest (PDF + Email)'] },
                { icon: Users, label: 'Коллаборация (planned)', color: '#f59e0b', items: ['Invite by email (viewer/editor)', 'Supabase Realtime sync', 'Activity feed', 'Публичные ссылки (ready)'] },
                { icon: Globe, label: 'Growth', color: '#ef4444', items: ['Referral: fp-XXXXXX код (+2 планов)', 'Onboarding checklist с XP', 'Шаблоны планов (5+ типов)', '«Использовать как шаблон» на SharePage'] },
              ].map(card => (
                <div key={card.label} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}15` }}>
                      <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                    </div>
                    <span className="text-sm" style={{ fontWeight: 600 }}>{card.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {card.items.map(i => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55">
                        <div className="w-1 h-1 rounded-full shrink-0" style={{ background: card.color }} />
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Accordion title="Горячие клавиши">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ['T', 'Таймлайн'], ['K', 'Kanban'], ['C', 'Календарь'],
                  ['N', 'Новый план'], ['A', 'Аналитика'], ['F', 'Фокус-режим'],
                  ['Ctrl+Z', 'Отменить'], ['Ctrl+Y', 'Повторить'], ['?', 'Подсказка'],
                  ['Esc', 'Закрыть / Снять выделение'], ['↔ Swipe', 'Смена вида (mobile)'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
                    <span className="text-xs text-slate-500 dark:text-white/50">{desc}</span>
                    <kbd className="text-xs px-2 py-1 rounded bg-white dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-white/70" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </Accordion>
          </section>

          {/* ── UX / UI ── */}
          <section id="section-ux">
            <H2 id="ux"><Palette className="w-5 h-5 text-[#1e40af]" />UX / UI</H2>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                <H3>Дизайн-система</H3>
                <div className="space-y-2">
                  {[
                    ['Фон (light)', '#eff6ff'],
                    ['Акцент 1', '#1d4ed8'],
                    ['Акцент 2', '#2563eb'],
                    ['Акцент 3', '#3b82f6'],
                    ['Успех', '#10b981'],
                    ['Предупреждение', '#f59e0b'],
                    ['Ошибка', '#ef4444'],
                  ].map(([name, color]) => (
                    <div key={name} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg border border-black/10" style={{ background: color }} />
                      <span className="text-xs text-slate-500 dark:text-white/50">{name}</span>
                      <span className="ml-auto text-xs font-mono text-slate-400 dark:text-white/30">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                <H3>Типографика и компоненты</H3>
                <ul className="space-y-1.5">
                  {[
                    'Заголовки: Syne (700–800)',
                    'Текст: Inter (400–600)',
                    'Код: monospace',
                    'Анимации: motion/react (spring damping)',
                    'Skeleton loading при загрузке',
                    'Toast уведомления: sonner',
                    'Конфетти: ConfettiBurst при Done',
                    'Responsive: mobile-first, swipe',
                    'Dark mode: ThemeContext + CSS vars',
                    'Onboarding: driver.js tour',
                  ].map(i => <Li key={i}>{i}</Li>)}
                </ul>
              </div>
            </div>

            <Accordion title="Структура роутинга">
              <CodeBlock lang="typescript" code={`// routes.ts
createBrowserRouter([
  { path: '/',               Component: LandingPage },    // Hero, CTA
  { path: '/new',            Component: GoalInputPage },  // AI-генерация
  { path: '/plan/:id',       Component: PlanPage },       // Основная страница плана
  { path: '/dashboard',      Component: DashboardPage },  // Список планов
  { path: '/share/:shareId', Component: SharePage },      // Read-only публичный вид
  { path: '/prd',            Component: PRDPage },         // Этот документ
  { path: '*',               Component: LandingPage },
]);`} />
            </Accordion>
          </section>

          {/* ── SECURITY ── */}
          <section id="section-security">
            <H2 id="security"><Shield className="w-5 h-5 text-[#ef4444]" />Безопасность</H2>

            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {[
                { icon: Lock, label: 'Аутентификация', color: '#ef4444', items: ['Supabase Auth (email/password)', 'JWT-токены, автоматическое истечение', 'email_confirm: true (без SMTP)', 'Protected routes на сервере через getUser()'] },
                { icon: Shield, label: 'Авторизация', color: '#f59e0b', items: ['Все /plans и /usage — только с валидным JWT', 'SUPABASE_SERVICE_ROLE_KEY только на сервере (Deno)', 'Public endpoints: /share/:id, /ai/* (rate-limit planned)', 'CORS: wildcard для dev, restrict для prod'] },
              ].map(card => (
                <div key={card.label} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon className="w-4 h-4" style={{ color: card.color }} />
                    <span className="text-sm" style={{ fontWeight: 600 }}>{card.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {card.items.map(i => <Li key={i}>{i}</Li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-300" style={{ fontWeight: 600 }}>Известные ограничения</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 mt-1 space-y-0.5">
                  <li>• Rate limiting на AI-эндпоинтах пока не реализован (planned)</li>
                  <li>• CORS wildcard (*) следует сузить до production-домена</li>
                  <li>• OpenAI API ключ должен быть только в Supabase Secrets, не в клиенте</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── PERFORMANCE ── */}
          <section id="section-perf">
            <H2 id="perf"><Cpu className="w-5 h-5 text-[#3b82f6]" />Производительность</H2>

            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              {[
                { metric: '< 10 сек', label: 'AI генерация плана', desc: 'GPT-4o-mini streaming (non-streaming в текущей реализации)' },
                { metric: 'Instant', label: 'Смена задачи (UI)', desc: 'Optimistic update: localStorage → state до получения ответа сервера' },
                { metric: '< 2 сек', label: 'Открытие Dashboard', desc: 'localStorage-first, cloud sync в фоне' },
              ].map(m => (
                <div key={m.label} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-center">
                  <div className="text-xl text-[#3b82f6] mb-1" style={{ fontWeight: 700, fontFamily: 'monospace' }}>{m.metric}</div>
                  <div className="text-sm text-slate-900 dark:text-white mb-1" style={{ fontWeight: 500 }}>{m.label}</div>
                  <div className="text-xs text-slate-400 dark:text-white/40">{m.desc}</div>
                </div>
              ))}
            </div>

            <Accordion title="Оптимизации">
              <ul className="space-y-1">
                <Li>useMemo для allTaskOptions и filteredPlan — не пересчитываются без изменений</Li>
                <Li>motion/react layout animations — GPU-ускоренные CSS transforms</Li>
                <Li>Lazy loading компонентов (planned — React.lazy для модалов)</Li>
                <Li>Оффлайн-кеш через Service Worker (PWA)</Li>
                <Li>localStorage-first: данные доступны мгновенно без сети</Li>
                <Li>Cloud sync не блокирует UI (Promise без await в рендере)</Li>
              </ul>
            </Accordion>
          </section>

          {/* ── ROADMAP ── */}
          <section id="section-roadmap">
            <H2 id="roadmap"><Workflow className="w-5 h-5 text-[#2563eb]" />Roadmap</H2>

            <div className="space-y-6">
              {[
                {
                  quarter: 'Q1 2026 · Текущий',
                  color: '#10b981',
                  items: [
                    { done: true,  text: 'AI-генерация плана (GPT-4o-mini)' },
                    { done: true,  text: 'Supabase Auth + Cloud Sync' },
                    { done: true,  text: 'Kanban, Timeline, Календарь' },
                    { done: true,  text: 'Undo/Redo + Optimistic Updates' },
                    { done: true,  text: 'AI-расширение фазы' },
                    { done: true,  text: 'Focus Mode (Pomodoro)' },
                    { done: true,  text: 'Time Tracking + Bulk Actions' },
                    { done: true,  text: 'Activity Heatmap + Forecast' },
                    { done: true,  text: 'Weekly Digest (PDF + Email)' },
                    { done: true,  text: 'Referral система' },
                  ],
                },
                {
                  quarter: 'Q2 2026',
                  color: '#1d4ed8',
                  items: [
                    { done: false, text: 'Stripe Pro подписка + Billing Portal' },
                    { done: false, text: 'Invite Collaborators (viewer/editor)' },
                    { done: false, text: 'Supabase Realtime синхронизация' },
                    { done: false, text: 'Activity Feed внутри плана' },
                    { done: false, text: 'Drag-to-reschedule на Timeline' },
                    { done: false, text: 'Radix Select (замена нативных <select>)' },
                    { done: false, text: 'Rate limiting на AI-эндпоинтах' },
                  ],
                },
                {
                  quarter: 'Q3 2026',
                  color: '#2563eb',
                  items: [
                    { done: false, text: 'AI-чат ассистент внутри плана' },
                    { done: false, text: 'Web Push уведомления о дедлайнах' },
                    { done: false, text: 'iOS/Android нативное приложение (React Native)' },
                    { done: false, text: 'Интеграции: Notion, Linear, GitHub Issues' },
                    { done: false, text: 'Vitest + Playwright тесты' },
                    { done: false, text: 'Streaming ответов от AI (Server-Sent Events)' },
                  ],
                },
              ].map(q => (
                <div key={q.quarter}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: q.color }} />
                    <span className="text-sm" style={{ fontWeight: 700, color: q.color }}>{q.quarter}</span>
                  </div>
                  <div className="ml-4 grid sm:grid-cols-2 gap-1.5">
                    {q.items.map(item => (
                      <div key={item.text} className="flex items-center gap-2">
                        {item.done
                          ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
                          : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-white/20 shrink-0" />
                        }
                        <span className={`text-xs ${item.done ? 'text-slate-500 dark:text-white/40 line-through' : 'text-slate-700 dark:text-white/70'}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── REQUIREMENTS ── */}
          <section id="section-requirements">
            <H2 id="requirements"><TestTube className="w-5 h-5 text-[#f59e0b]" />Реестр требований</H2>
            <P>Полный список функциональных требований с приоритетами и статусами. Приоритет P0 — критично для MVP, P3 — nice-to-have.</P>
            <RequirementsTable />
          </section>

          {/* Footer */}
          <div className="pt-6 pb-12 border-t border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-white/50" style={{ fontWeight: 500 }}>Vecto PRD v2.0</p>
                <p className="text-xs text-slate-400 dark:text-white/30">Документ актуален на 3 марта 2026 · Автоматически сгенерирован</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {done} / {total} требований выполнено ({pct}%)
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
