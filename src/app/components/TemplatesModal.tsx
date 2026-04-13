import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Sliders } from 'lucide-react';
import { format, addMonths, addWeeks } from 'date-fns';

interface TemplateParam {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'select';
  options?: string[];
}

export interface Template {
  id: string;
  emoji: string;
  title: string;
  niche: string;
  category: string;
  goal: string;
  deadline: string;
  hoursPerWeek: number;
  color: string;
  desc: string;
  params?: TemplateParam[];
  goalTemplate?: string;
}

const today = new Date();

const TEMPLATES: Template[] = [
  // ── Бизнес ────────────────────────────────────────────────────────────────
  {
    id: 'saas',
    emoji: '🚀',
    title: 'Запуск SaaS',
    niche: 'Продукт',
    category: 'Бизнес',
    goal: 'Запустить SaaS-продукт с нуля до первых платящих клиентов',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 15,
    color: '#2563eb',
    desc: 'От идеи до MVP и первых продаж за 3 месяца',
    params: [
      { key: 'product', label: 'Тип продукта', placeholder: 'Например: CRM для фрилансеров' },
      { key: 'audience', label: 'Целевая аудитория', placeholder: 'Например: малый бизнес' },
      { key: 'stack', label: 'Стек технологий', placeholder: 'Например: React + Node.js', type: 'select', options: ['React + Node.js', 'Next.js + Supabase', 'Vue + Django', 'Flutter', 'No-code (Bubble)'] },
    ],
    goalTemplate: 'Запустить {product} для {audience} на стеке {stack} до первых платящих клиентов',
  },
  {
    id: 'shop',
    emoji: '🛍️',
    title: 'Интернет-магазин',
    niche: 'Ecommerce',
    category: 'Бизнес',
    goal: 'Запустить интернет-магазин на маркетплейсе и получить первые заказы',
    deadline: format(addMonths(today, 2), 'yyyy-MM-dd'),
    hoursPerWeek: 20,
    color: '#f59e0b',
    desc: 'Товарный бизнес на маркетплейсах за 2 месяца',
    params: [
      { key: 'niche', label: 'Ниша товаров', placeholder: 'Например: аксессуары для телефонов' },
      { key: 'platform', label: 'Платформа', type: 'select', placeholder: '', options: ['Wildberries', 'Ozon', 'Shopify', 'Собственный сайт'] },
      { key: 'budget', label: 'Стартовый бюджет', placeholder: 'Например: 100 000 ₽' },
    ],
    goalTemplate: 'Запустить интернет-магазин {niche} на {platform} с бюджетом {budget} и получить первые заказы',
  },
  {
    id: 'brand',
    emoji: '🎯',
    title: 'Личный бренд',
    niche: 'Маркетинг',
    category: 'Бизнес',
    goal: 'Создать личный бренд и набрать 10 000 подписчиков в Instagram',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 12,
    color: '#ef4444',
    desc: 'Стратегия контента и рост аудитории',
    params: [
      { key: 'topic', label: 'Тема блога', placeholder: 'Например: финансовая грамотность' },
      { key: 'platform', label: 'Платформа', type: 'select', placeholder: '', options: ['Instagram', 'Telegram', 'YouTube', 'TikTok', 'LinkedIn'] },
      { key: 'target', label: 'Цель по подписчикам', placeholder: 'Например: 10 000' },
    ],
    goalTemplate: 'Создать личный бренд по теме «{topic}» в {platform} и набрать {target} подписчиков',
  },
  {
    id: 'mobile',
    emoji: '📱',
    title: 'Мобильное приложение',
    niche: 'Разработка',
    category: 'Бизнес',
    goal: 'Разработать мобильное приложение с нуля до публикации в App Store',
    deadline: format(addMonths(today, 4), 'yyyy-MM-dd'),
    hoursPerWeek: 20,
    color: '#3b82f6',
    desc: 'От идеи и дизайна до MVP и публикации',
    params: [
      { key: 'app', label: 'Что за приложение', placeholder: 'Например: трекер привычек' },
      { key: 'platform', label: 'Платформа', type: 'select', placeholder: '', options: ['iOS (Swift)', 'Android (Kotlin)', 'Flutter', 'React Native'] },
    ],
    goalTemplate: 'Разработать мобильное приложение «{app}» на {platform} и опубликовать в сторе',
  },
  {
    id: 'course',
    emoji: '🎓',
    title: 'Онлайн-курс',
    niche: 'Инфобизнес',
    category: 'Бизнес',
    goal: 'Создать и продать свой онлайн-курс',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 15,
    color: '#1e40af',
    desc: 'От записи до первых студентов и продаж',
    params: [
      { key: 'topic', label: 'Тема курса', placeholder: 'Например: основы веб-разработки' },
      { key: 'platform', label: 'Платформа', type: 'select', placeholder: '', options: ['Stepik', 'Udemy', 'GetCourse', 'Собственный сайт'] },
    ],
    goalTemplate: 'Создать онлайн-курс «{topic}» на платформе {platform} и продать первым студентам',
  },

  // ── Обучение ──────────────────────────────────────────────────────────────
  {
    id: 'python',
    emoji: '📚',
    title: 'Изучение Python',
    niche: 'Программирование',
    category: 'Обучение',
    goal: 'Выучить Python с нуля до уровня Junior-разработчика',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 15,
    color: '#3b82f6',
    desc: 'От Hello World до трудоустройства',
    params: [
      { key: 'direction', label: 'Направление', type: 'select', placeholder: '', options: ['Backend (Django/Flask)', 'Data Science', 'ML/AI', 'Автоматизация', 'Общее программирование'] },
      { key: 'level', label: 'Текущий уровень', type: 'select', placeholder: '', options: ['Абсолютный ноль', 'Знаю основы', 'Есть опыт в другом языке'] },
    ],
    goalTemplate: 'Выучить Python для {direction} (старт: {level}) до уровня Junior-разработчика',
  },
  {
    id: 'english',
    emoji: '🇬🇧',
    title: 'Английский до B2',
    niche: 'Языки',
    category: 'Обучение',
    goal: 'Выучить английский язык с нуля до уровня B2',
    deadline: format(addMonths(today, 6), 'yyyy-MM-dd'),
    hoursPerWeek: 7,
    color: '#1e40af',
    desc: 'Грамматика, разговорная практика и подготовка к экзамену',
    params: [
      { key: 'currentLevel', label: 'Текущий уровень', type: 'select', placeholder: '', options: ['A0 (нуль)', 'A1', 'A2', 'B1'] },
      { key: 'purpose', label: 'Для чего', placeholder: 'Например: работа в IT' },
    ],
    goalTemplate: 'Выучить английский с {currentLevel} до B2 для {purpose}',
  },
  {
    id: 'design',
    emoji: '🎨',
    title: 'UX/UI Дизайн',
    niche: 'Дизайн',
    category: 'Обучение',
    goal: 'Собрать UX/UI портфолио и получить первых клиентов',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 15,
    color: '#ec4899',
    desc: 'Figma, UX-кейсы, сайт-портфолио и первые проекты',
  },

  // ── Здоровье ──────────────────────────────────────────────────────────────
  {
    id: 'fitness',
    emoji: '💪',
    title: 'Фитнес и здоровье',
    niche: 'Фитнес',
    category: 'Здоровье',
    goal: 'Похудеть на 10 кг и войти в лучшую форму за 3 месяца',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 8,
    color: '#10b981',
    desc: 'Системный подход к похудению и спорту',
    params: [
      { key: 'goal_kg', label: 'Цель (кг)', placeholder: 'Например: -10 кг' },
      { key: 'activity', label: 'Тип активности', type: 'select', placeholder: '', options: ['Тренажёрный зал', 'Домашние тренировки', 'Бег', 'Йога', 'Плавание', 'Комбинированный'] },
    ],
    goalTemplate: 'Похудеть на {goal_kg} через {activity} и войти в лучшую форму',
  },
  {
    id: 'marathon',
    emoji: '🏃',
    title: 'Первый марафон',
    niche: 'Бег',
    category: 'Здоровье',
    goal: 'Подготовиться к первому марафону и пробежать 42 км',
    deadline: format(addMonths(today, 4), 'yyyy-MM-dd'),
    hoursPerWeek: 8,
    color: '#10b981',
    desc: 'От нулевого бегуна до финишной ленты',
  },

  // ── Творчество ────────────────────────────────────────────────────────────
  {
    id: 'book',
    emoji: '✍️',
    title: 'Написание книги',
    niche: 'Писательство',
    category: 'Творчество',
    goal: 'Написать и опубликовать бизнес-книгу',
    deadline: format(addMonths(today, 6), 'yyyy-MM-dd'),
    hoursPerWeek: 10,
    color: '#1e40af',
    desc: 'Концепция, черновик и публикация за 6 месяцев',
    params: [
      { key: 'genre', label: 'Жанр', type: 'select', placeholder: '', options: ['Бизнес', 'Художественная', 'Self-help', 'Научпоп', 'Мемуары'] },
      { key: 'topic', label: 'Тема книги', placeholder: 'Например: продуктивность для интровертов' },
    ],
    goalTemplate: 'Написать и опубликовать книгу в жанре {genre} на тему «{topic}»',
  },
  {
    id: 'youtube',
    emoji: '🎥',
    title: 'YouTube канал',
    niche: 'Видео',
    category: 'Творчество',
    goal: 'Запустить YouTube канал с нуля до 1000 подписчиков',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 10,
    color: '#ef4444',
    desc: 'Стратегия, первые 10 видео и монетизация',
    params: [
      { key: 'topic', label: 'Тема канала', placeholder: 'Например: обзоры гаджетов' },
      { key: 'target', label: 'Цель подписчиков', placeholder: 'Например: 1000' },
    ],
    goalTemplate: 'Запустить YouTube канал на тему «{topic}» и набрать {target} подписчиков',
  },
  {
    id: 'podcast',
    emoji: '🎙️',
    title: 'Запуск подкаста',
    niche: 'Аудио',
    category: 'Творчество',
    goal: 'Запустить подкаст с нуля до первых 100 постоянных слушателей',
    deadline: format(addMonths(today, 2), 'yyyy-MM-dd'),
    hoursPerWeek: 8,
    color: '#1e40af',
    desc: 'Концепция, оборудование, первые эпизоды и рост',
  },

  // ── Карьера ───────────────────────────────────────────────────────────────
  {
    id: 'job',
    emoji: '💼',
    title: 'Поиск работы',
    niche: 'Карьера',
    category: 'Карьера',
    goal: 'Найти работу Flutter-разработчика и получить оффер',
    deadline: format(addWeeks(today, 6), 'yyyy-MM-dd'),
    hoursPerWeek: 25,
    color: '#1e40af',
    desc: 'Резюме, портфолио и офферы за 6 недель',
    params: [
      { key: 'role', label: 'Должность', placeholder: 'Например: Frontend-разработчик' },
      { key: 'level', label: 'Уровень', type: 'select', placeholder: '', options: ['Junior', 'Middle', 'Senior', 'Lead'] },
      { key: 'format', label: 'Формат', type: 'select', placeholder: '', options: ['Удалённо', 'Офис', 'Гибрид'] },
    ],
    goalTemplate: 'Найти работу {role} уровня {level} ({format}) и получить оффер',
  },

  // ── Личное ────────────────────────────────────────────────────────────────
  {
    id: 'travel',
    emoji: '✈️',
    title: 'Путешествие',
    niche: 'Путешествия',
    category: 'Личное',
    goal: 'Спланировать и совершить масштабное путешествие по Европе',
    deadline: format(addMonths(today, 2), 'yyyy-MM-dd'),
    hoursPerWeek: 5,
    color: '#ec4899',
    desc: 'От маршрута до бронирований и сборов',
    params: [
      { key: 'destination', label: 'Куда', placeholder: 'Например: Италия и Испания' },
      { key: 'duration', label: 'Длительность', placeholder: 'Например: 2 недели' },
    ],
    goalTemplate: 'Спланировать и совершить путешествие в {destination} на {duration}',
  },
  {
    id: 'finance',
    emoji: '💰',
    title: 'Личные финансы',
    niche: 'Финансы',
    category: 'Личное',
    goal: 'Создать финансовую подушку и начать инвестировать',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 5,
    color: '#10b981',
    desc: 'Бюджет, подушка безопасности и первый портфель',
  },
  {
    id: 'renovation',
    emoji: '🏠',
    title: 'Ремонт квартиры',
    niche: 'Дом',
    category: 'Личное',
    goal: 'Сделать ремонт в квартире с нуля',
    deadline: format(addMonths(today, 3), 'yyyy-MM-dd'),
    hoursPerWeek: 40,
    color: '#f59e0b',
    desc: 'Планирование, черновые работы, чистовые и монтаж',
    params: [
      { key: 'rooms', label: 'Комнаты', placeholder: 'Например: 2-комнатная' },
      { key: 'type', label: 'Тип ремонта', type: 'select', placeholder: '', options: ['Косметический', 'Капитальный', 'Дизайнерский', 'Под ключ'] },
    ],
    goalTemplate: 'Сделать {type} ремонт в {rooms} квартире с нуля',
  },
  {
    id: 'relocation',
    emoji: '🌍',
    title: 'Переезд за рубеж',
    niche: 'Релокация',
    category: 'Личное',
    goal: 'Переехать жить и работать в другую страну',
    deadline: format(addMonths(today, 6), 'yyyy-MM-dd'),
    hoursPerWeek: 10,
    color: '#1e40af',
    desc: 'Документы, визы, жильё и адаптация',
    params: [
      { key: 'country', label: 'Страна', placeholder: 'Например: Германия' },
      { key: 'purpose', label: 'Цель переезда', type: 'select', placeholder: '', options: ['Работа', 'Учёба', 'Бизнес', 'Семья'] },
    ],
    goalTemplate: 'Переехать в {country} ({purpose}): документы, визы, жильё и адаптация',
  },
];

const CATEGORIES = ['Все', 'Бизнес', 'Обучение', 'Здоровье', 'Творчество', 'Карьера', 'Личное'];

function applyParams(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '...');
  }
  return result;
}

interface TemplatesModalProps {
  onSelect: (template: Template) => void;
  onClose: () => void;
}

export function TemplatesModal({ onSelect, onClose }: TemplatesModalProps) {
  const [activeCategory, setActiveCategory] = useState('Все');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const filtered = activeCategory === 'Все'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  const handleSelectTemplate = (tmpl: Template) => {
    if (tmpl.params && tmpl.params.length > 0) {
      setSelectedTemplate(tmpl);
      const defaults: Record<string, string> = {};
      tmpl.params.forEach(p => { defaults[p.key] = p.options?.[0] || ''; });
      setParamValues(defaults);
    } else {
      onSelect(tmpl);
      onClose();
    }
  };

  const handleApplyParams = () => {
    if (!selectedTemplate) return;
    const customGoal = selectedTemplate.goalTemplate
      ? applyParams(selectedTemplate.goalTemplate, paramValues)
      : selectedTemplate.goal;
    onSelect({ ...selectedTemplate, goal: customGoal });
    onClose();
  };

  const previewGoal = selectedTemplate?.goalTemplate
    ? applyParams(selectedTemplate.goalTemplate, paramValues)
    : selectedTemplate?.goal || '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full sm:max-w-2xl bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/8 shrink-0">
            <div className="flex items-center gap-3">
              {selectedTemplate && (
                <button onClick={() => setSelectedTemplate(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <h2
                  style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}
                  className="text-slate-900 dark:text-white text-lg"
                >
                  {selectedTemplate ? `${selectedTemplate.emoji} ${selectedTemplate.title}` : 'Шаблоны по нишам'}
                </h2>
                <p className="text-slate-400 dark:text-white/40 text-sm mt-0.5">
                  {selectedTemplate ? 'Настройте параметры шаблона' : `${TEMPLATES.length} шаблонов — выберите готовый старт`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedTemplate ? (
            /* ── Parameter customization step ── */
            <div className="overflow-y-auto p-5 space-y-4">
              {/* Goal preview */}
              <div className="p-3 rounded-xl bg-[#1d4ed8]/5 border border-[#1d4ed8]/15">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#1d4ed8]" />
                  <span className="text-xs font-semibold text-[#1d4ed8]">Цель (предпросмотр)</span>
                </div>
                <p className="text-sm text-slate-800 dark:text-white/90 leading-relaxed">{previewGoal}</p>
              </div>

              {/* Param fields */}
              {selectedTemplate.params?.map(param => (
                <div key={param.key}>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-white/60 mb-1.5">{param.label}</label>
                  {param.type === 'select' && param.options ? (
                    <select
                      value={paramValues[param.key] || ''}
                      onChange={e => setParamValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                      className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-[#1d4ed8]/40 focus:ring-2 focus:ring-[#1d4ed8]/10 transition-all cursor-pointer"
                    >
                      {param.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={paramValues[param.key] || ''}
                      onChange={e => setParamValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                      placeholder={param.placeholder}
                      className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-[#1d4ed8]/40 focus:ring-2 focus:ring-[#1d4ed8]/10 transition-all"
                    />
                  )}
                </div>
              ))}

              {/* Info */}
              <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-white/30 pt-2">
                <span>{selectedTemplate.hoursPerWeek}ч/нед</span>
                <span>·</span>
                <span>Дедлайн: {selectedTemplate.deadline}</span>
                <span>·</span>
                <span style={{ color: selectedTemplate.color, fontWeight: 500 }}>{selectedTemplate.category}</span>
              </div>

              {/* CTA */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelectedTemplate(null)}
                  className="flex-1 py-3 rounded-xl text-sm text-slate-500 dark:text-white/50 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                  Назад
                </button>
                <button onClick={handleApplyParams}
                  className="flex-1 py-3 rounded-xl text-sm text-white bg-[#1d4ed8] hover:bg-[#1e40af] font-semibold shadow-md shadow-[#1d4ed8]/25 transition-all">
                  Использовать шаблон
                </button>
              </div>
            </div>
          ) : (
            /* ── Template selection grid ── */
            <>
              {/* Category tabs */}
              <div className="px-4 pt-3 pb-0 border-b border-slate-100 dark:border-white/8 shrink-0 overflow-x-auto">
                <div className="flex gap-1 pb-3 min-w-max">
                  {CATEGORIES.map(cat => {
                    const count = cat === 'Все' ? TEMPLATES.length : TEMPLATES.filter(t => t.category === cat).length;
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-[#1d4ed8] text-white shadow-sm'
                            : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/8'
                        }`}
                        style={{ fontWeight: isActive ? 600 : 400 }}
                      >
                        {cat}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-white/30'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Templates grid */}
              <div className="overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((tmpl, i) => (
                    <motion.button
                      key={tmpl.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03, duration: 0.18 }}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className="group text-left p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/10 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ background: `${tmpl.color}18`, border: `1px solid ${tmpl.color}30` }}
                        >
                          {tmpl.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>
                              {tmpl.title}
                            </span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: `${tmpl.color}15`, color: tmpl.color }}
                            >
                              {tmpl.niche}
                            </span>
                            {tmpl.params && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1d4ed8]/10 text-[#1d4ed8] font-medium">
                                Настраиваемый
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-white/40 leading-snug">{tmpl.desc}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-white/30">
                            <span>{tmpl.hoursPerWeek}ч/нед</span>
                            <span>·</span>
                            <span style={{ color: tmpl.color, fontWeight: 500 }}>{tmpl.category}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/50 transition-colors shrink-0 mt-0.5" />
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
