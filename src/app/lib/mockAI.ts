import { Plan, Phase, Task, Priority } from './types';
import { addDays, format, differenceInDays } from 'date-fns';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

type GoalType =
  | 'product' | 'learning' | 'fitness' | 'travel' | 'writing' | 'career'
  | 'youtube' | 'mobile' | 'language' | 'finance' | 'renovation'
  | 'marathon' | 'course' | 'podcast' | 'design' | 'relocation'
  | 'general';

// Ordered from most specific to most general — first match wins
const GOAL_TYPE_CHECKS: [GoalType, string[]][] = [
  ['marathon',   ['марафон', 'marathon', '42 км', '42км', 'triathlon', 'триатлон', 'полумарафон']],
  ['language',   ['английск', 'english', 'ielts', 'toefl', 'немецк', 'французск', 'испанск', 'японск', 'китайск', 'язык до уровня', 'b2', 'c1', 'b1 уровн']],
  ['podcast',    ['подкаст', 'podcast']],
  ['youtube',    ['youtube', 'ютуб', 'ютюб', 'видеоблог', 'видео-блог']],
  ['mobile',     ['мобильн', 'ios приложен', 'android приложен', 'flutter', 'react native', 'swift', 'kotlin', 'app store', 'play market', 'play store']],
  ['renovation', ['ремонт', 'квартир']],
  ['finance',    ['финансов', 'финанс', 'инвестир', 'инвестиц', 'накопит', 'сбережен', 'пассивн доход', 'брокерск', 'портфел']],
  ['course',     ['онлайн-курс', 'онлайн курс', 'инфопродукт', 'свой курс', 'продать курс', 'создать курс', 'запустить курс']],
  ['design',     ['ux/ui', 'ux дизайн', 'ui дизайн', 'figma', 'дизайн-портфолио', 'веб-дизайн']],
  ['relocation', ['переезд', 'переехат', 'релокац', 'эмиграц', 'эмигрир']],
  ['product',    ['product', 'launch', 'app', 'brand', 'startup', 'business', 'store', 'shop', 'marketplace', 'бренд', 'запустить', 'запуск', 'маркетплейс', 'магазин', 'сайт', 'white label', 'нижнее', 'одежд', 'fashion', 'ecommerce', 'интернет-магазин']],
  ['learning',   ['learn', 'study', 'course', 'skill', 'master', 'certificate', 'учиться', 'изучить', 'курс', 'навык', 'programm', 'coding', 'python', 'react', 'javascript', 'java ', 'c++', 'golang']],
  ['fitness',    ['fitness', 'health', 'workout', 'run', 'gym', 'diet', 'sport', 'фитнес', 'здоровье', 'тренировка', 'похудеть', 'спорт', 'бег', 'похудение']],
  ['travel',     ['travel', 'trip', 'vacation', 'visit', 'tour', 'путешествие', 'поездка', 'отпуск', 'тур', 'поехать']],
  ['writing',    ['write', 'book', 'blog', 'content', 'novel', 'article', 'писать', 'книга', 'блог', 'роман', 'статья', 'контент']],
  ['career',     ['job', 'career', 'promotion', 'resume', 'portfolio', 'interview', 'работа', 'карьера', 'резюме', 'портфолио', 'собеседование', 'повышение']],
];

function detectGoalType(goal: string): GoalType {
  const lower = goal.toLowerCase();
  for (const [type, words] of GOAL_TYPE_CHECKS) {
    if (words.some(w => lower.includes(w))) return type;
  }
  return 'general';
}

interface PhaseTemplate {
  name: string;
  durationPct: number;
  color: string;
  tasks: { title: string; hours: number; priority: Priority }[];
}

const PHASE_COLORS = [
  '#1d4ed8', '#2563eb', '#1e40af', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6',
];

function getTemplates(type: GoalType): PhaseTemplate[] {
  switch (type) {

    case 'product': return [
      { name: 'Исследование рынка', durationPct: 15, color: PHASE_COLORS[0], tasks: [
        { title: 'Анализ конкурентов', hours: 8, priority: 'high' },
        { title: 'Целевая аудитория: портреты покупателей', hours: 6, priority: 'high' },
        { title: 'Анализ трендов и спроса', hours: 4, priority: 'medium' },
        { title: 'SWOT-анализ', hours: 3, priority: 'medium' },
      ]},
      { name: 'Планирование и стратегия', durationPct: 12, color: PHASE_COLORS[1], tasks: [
        { title: 'Определить позиционирование бренда', hours: 5, priority: 'high' },
        { title: 'Выбор ниши и ценовой сегмент', hours: 4, priority: 'high' },
        { title: 'Финансовый план и бюджет', hours: 6, priority: 'high' },
        { title: 'Юридическое оформление', hours: 4, priority: 'medium' },
      ]},
      { name: 'Разработка продукта', durationPct: 28, color: PHASE_COLORS[2], tasks: [
        { title: 'Поиск поставщиков / производителей', hours: 10, priority: 'high' },
        { title: 'Заказ образцов и тестирование', hours: 8, priority: 'high' },
        { title: 'Разработка упаковки и лейблов', hours: 6, priority: 'medium' },
        { title: 'Производственный заказ (MVP партия)', hours: 4, priority: 'high' },
      ]},
      { name: 'Контент и маркетинг', durationPct: 20, color: PHASE_COLORS[3], tasks: [
        { title: 'Фотосессия продукта', hours: 8, priority: 'high' },
        { title: 'Создание карточек товаров', hours: 6, priority: 'high' },
        { title: 'Настройка соцсетей и бренд-кит', hours: 5, priority: 'medium' },
        { title: 'SEO и ключевые слова для маркетплейса', hours: 4, priority: 'medium' },
      ]},
      { name: 'Логистика и запуск', durationPct: 15, color: PHASE_COLORS[4], tasks: [
        { title: 'Регистрация на маркетплейсе', hours: 3, priority: 'high' },
        { title: 'Настройка фулфилмента / доставки', hours: 5, priority: 'high' },
        { title: 'Загрузка товаров и публикация', hours: 4, priority: 'high' },
        { title: 'Тестовые заказы', hours: 2, priority: 'medium' },
      ]},
      { name: 'Реклама и рост', durationPct: 10, color: PHASE_COLORS[5], tasks: [
        { title: 'Запуск рекламных кампаний', hours: 6, priority: 'high' },
        { title: 'A/B тест объявлений', hours: 4, priority: 'medium' },
        { title: 'Сбор первых отзывов', hours: 3, priority: 'medium' },
        { title: 'Анализ первых результатов', hours: 3, priority: 'high' },
      ]},
    ];

    case 'learning': return [
      { name: 'Оценка и постановка целей', durationPct: 10, color: PHASE_COLORS[0], tasks: [
        { title: 'Определить текущий уровень', hours: 3, priority: 'high' },
        { title: 'Составить список ресурсов и курсов', hours: 4, priority: 'high' },
        { title: 'Выбрать метод обучения', hours: 2, priority: 'medium' },
      ]},
      { name: 'Фундаментальные основы', durationPct: 30, color: PHASE_COLORS[1], tasks: [
        { title: 'Изучение базовых концепций', hours: 15, priority: 'high' },
        { title: 'Практические упражнения', hours: 10, priority: 'high' },
        { title: 'Мини-проект для закрепления', hours: 8, priority: 'medium' },
      ]},
      { name: 'Углублённое изучение', durationPct: 35, color: PHASE_COLORS[2], tasks: [
        { title: 'Продвинутые темы и техники', hours: 20, priority: 'high' },
        { title: 'Работа над реальным проектом', hours: 15, priority: 'high' },
        { title: 'Разбор кейсов и примеров', hours: 8, priority: 'medium' },
      ]},
      { name: 'Практика и закрепление', durationPct: 25, color: PHASE_COLORS[3], tasks: [
        { title: 'Финальный проект / портфолио', hours: 20, priority: 'high' },
        { title: 'Получение сертификата', hours: 4, priority: 'medium' },
        { title: 'Сообщество и нетворкинг', hours: 5, priority: 'low' },
      ]},
    ];

    case 'fitness': return [
      { name: 'Подготовка и базовая линия', durationPct: 15, color: PHASE_COLORS[0], tasks: [
        { title: 'Медицинское обследование', hours: 3, priority: 'high' },
        { title: 'Разработка плана питания', hours: 4, priority: 'high' },
        { title: 'Выбор программы тренировок', hours: 2, priority: 'high' },
      ]},
      { name: 'Начальный этап (адаптация)', durationPct: 25, color: PHASE_COLORS[1], tasks: [
        { title: 'Тренировки 3×/неделю', hours: 3, priority: 'high' },
        { title: 'Дневник питания', hours: 1, priority: 'medium' },
        { title: 'Кардиотренировки', hours: 2, priority: 'medium' },
      ]},
      { name: 'Основная фаза', durationPct: 40, color: PHASE_COLORS[2], tasks: [
        { title: 'Интенсивные тренировки 4-5×/неделю', hours: 5, priority: 'high' },
        { title: 'Отслеживание прогресса', hours: 1, priority: 'medium' },
        { title: 'Корректировка диеты', hours: 2, priority: 'medium' },
      ]},
      { name: 'Финальная фаза', durationPct: 20, color: PHASE_COLORS[3], tasks: [
        { title: 'Пиковая форма — финальные тренировки', hours: 5, priority: 'high' },
        { title: 'Фотофиксация прогресса', hours: 1, priority: 'low' },
        { title: 'Планирование следующего цикла', hours: 2, priority: 'medium' },
      ]},
    ];

    case 'travel': return [
      { name: 'Планирование маршрута', durationPct: 25, color: PHASE_COLORS[0], tasks: [
        { title: 'Выбор направления и дат', hours: 3, priority: 'high' },
        { title: 'Исследование достопримечательностей', hours: 5, priority: 'medium' },
        { title: 'Составление маршрута', hours: 4, priority: 'high' },
      ]},
      { name: 'Бронирование', durationPct: 30, color: PHASE_COLORS[1], tasks: [
        { title: 'Купить авиабилеты', hours: 2, priority: 'high' },
        { title: 'Забронировать отели', hours: 3, priority: 'high' },
        { title: 'Оформить визу (если нужна)', hours: 4, priority: 'high' },
        { title: 'Страховка', hours: 1, priority: 'medium' },
      ]},
      { name: 'Подготовка', durationPct: 30, color: PHASE_COLORS[2], tasks: [
        { title: 'Список вещей и сборка', hours: 3, priority: 'medium' },
        { title: 'Обмен валюты', hours: 1, priority: 'medium' },
        { title: 'Скачать офлайн-карты', hours: 1, priority: 'low' },
      ]},
      { name: 'Поездка', durationPct: 15, color: PHASE_COLORS[3], tasks: [
        { title: 'Путешествие', hours: 40, priority: 'high' },
      ]},
    ];

    case 'writing': return [
      { name: 'Концепция и исследование', durationPct: 20, color: PHASE_COLORS[0], tasks: [
        { title: 'Разработка идеи и темы', hours: 4, priority: 'high' },
        { title: 'Исследование и сбор материала', hours: 8, priority: 'high' },
        { title: 'Структура и план', hours: 4, priority: 'high' },
      ]},
      { name: 'Черновик', durationPct: 40, color: PHASE_COLORS[1], tasks: [
        { title: 'Написание первого черновика', hours: 25, priority: 'high' },
        { title: 'Регулярные сессии письма', hours: 15, priority: 'high' },
      ]},
      { name: 'Редактирование', durationPct: 30, color: PHASE_COLORS[2], tasks: [
        { title: 'Структурное редактирование', hours: 10, priority: 'high' },
        { title: 'Корректура текста', hours: 8, priority: 'medium' },
        { title: 'Финальный вычит', hours: 5, priority: 'medium' },
      ]},
      { name: 'Публикация', durationPct: 10, color: PHASE_COLORS[3], tasks: [
        { title: 'Выбор платформы и публикация', hours: 4, priority: 'high' },
        { title: 'Продвижение', hours: 5, priority: 'medium' },
      ]},
    ];

    case 'career': return [
      { name: 'Самоанализ и цели', durationPct: 15, color: PHASE_COLORS[0], tasks: [
        { title: 'Оценить текущие навыки и достижения', hours: 4, priority: 'high' },
        { title: 'Определить целевые позиции и компании', hours: 3, priority: 'high' },
        { title: 'Изучить требования рынка', hours: 4, priority: 'medium' },
      ]},
      { name: 'Подготовка материалов', durationPct: 25, color: PHASE_COLORS[1], tasks: [
        { title: 'Обновить резюме / CV', hours: 6, priority: 'high' },
        { title: 'Написать сопроводительное письмо', hours: 4, priority: 'high' },
        { title: 'Обновить LinkedIn профиль', hours: 3, priority: 'medium' },
        { title: 'Собрать портфолио работ', hours: 8, priority: 'high' },
      ]},
      { name: 'Поиск и нетворкинг', durationPct: 35, color: PHASE_COLORS[2], tasks: [
        { title: 'Активный поиск вакансий', hours: 6, priority: 'high' },
        { title: 'Нетворкинг на профессиональных мероприятиях', hours: 4, priority: 'medium' },
        { title: 'Отклики на вакансии', hours: 5, priority: 'high' },
      ]},
      { name: 'Интервью и оффер', durationPct: 25, color: PHASE_COLORS[3], tasks: [
        { title: 'Подготовка к техническим интервью', hours: 10, priority: 'high' },
        { title: 'Прохождение собеседований', hours: 6, priority: 'high' },
        { title: 'Переговоры по офферу', hours: 3, priority: 'medium' },
      ]},
    ];

    // ── 10 новых типов ────────────────────────────────────────────────────────

    case 'youtube': return [
      { name: 'Стратегия и ниша', durationPct: 15, color: PHASE_COLORS[5], tasks: [
        { title: 'Выбор ниши и целевой аудитории', hours: 4, priority: 'high' },
        { title: 'Анализ конкурентных каналов', hours: 5, priority: 'high' },
        { title: 'Разработка контент-стратегии', hours: 4, priority: 'high' },
        { title: 'Название, лого и оформление канала', hours: 3, priority: 'medium' },
      ]},
      { name: 'Техническая подготовка', durationPct: 15, color: PHASE_COLORS[0], tasks: [
        { title: 'Выбор и настройка оборудования', hours: 3, priority: 'high' },
        { title: 'Создание канала и шапки', hours: 2, priority: 'high' },
        { title: 'Изучение монтажа (базовый уровень)', hours: 6, priority: 'medium' },
        { title: 'Записать и удалить пробный эпизод', hours: 2, priority: 'low' },
      ]},
      { name: 'Первые 10 видео', durationPct: 35, color: PHASE_COLORS[1], tasks: [
        { title: 'Написать сценарии для видео 1–5', hours: 8, priority: 'high' },
        { title: 'Съёмка и монтаж видео 1–5', hours: 15, priority: 'high' },
        { title: 'SEO: заголовки, описания, теги', hours: 4, priority: 'high' },
        { title: 'Написать сценарии для видео 6–10', hours: 8, priority: 'high' },
        { title: 'Съёмка и монтаж видео 6–10', hours: 15, priority: 'high' },
      ]},
      { name: 'Рост и аналитика', durationPct: 25, color: PHASE_COLORS[2], tasks: [
        { title: 'Анализ YouTube Studio и метрик', hours: 4, priority: 'high' },
        { title: 'A/Б тест превью и заголовков', hours: 3, priority: 'medium' },
        { title: 'Создание YouTube Shorts', hours: 6, priority: 'medium' },
        { title: 'Коллаборации с другими блогерами', hours: 4, priority: 'medium' },
      ]},
      { name: 'Монетизация', durationPct: 10, color: PHASE_COLORS[3], tasks: [
        { title: 'Достичь 1000 подписчиков и 4000 ч просмотров', hours: 2, priority: 'high' },
        { title: 'Подать заявку на монетизацию', hours: 1, priority: 'high' },
        { title: 'Настроить дополнительные источники дохода', hours: 4, priority: 'medium' },
      ]},
    ];

    case 'mobile': return [
      { name: 'Идея и валидация', durationPct: 15, color: PHASE_COLORS[0], tasks: [
        { title: 'Детальное описание идеи и ценностного предложения', hours: 3, priority: 'high' },
        { title: 'Анализ конкурентов в App Store / Play Market', hours: 5, priority: 'high' },
        { title: 'Пользовательские интервью (min 5 человек)', hours: 6, priority: 'high' },
        { title: 'Выбор технологического стека', hours: 3, priority: 'medium' },
      ]},
      { name: 'Дизайн и прототип', durationPct: 20, color: PHASE_COLORS[1], tasks: [
        { title: 'Wireframes ключевых экранов в Figma', hours: 8, priority: 'high' },
        { title: 'UI дизайн: цвета, типографика, компоненты', hours: 10, priority: 'high' },
        { title: 'Пользовательский тест прототипа', hours: 4, priority: 'high' },
        { title: 'Итерация на основе фидбека', hours: 4, priority: 'medium' },
      ]},
      { name: 'Разработка MVP', durationPct: 40, color: PHASE_COLORS[2], tasks: [
        { title: 'Настройка проекта и базовая архитектура', hours: 8, priority: 'high' },
        { title: 'Разработка ключевых экранов', hours: 20, priority: 'high' },
        { title: 'Интеграция backend / API', hours: 10, priority: 'high' },
        { title: 'Тестирование и исправление багов', hours: 8, priority: 'high' },
      ]},
      { name: 'Публикация', durationPct: 15, color: PHASE_COLORS[3], tasks: [
        { title: 'Подготовка скриншотов и описания', hours: 4, priority: 'high' },
        { title: 'Регистрация в Apple / Google Developer', hours: 2, priority: 'high' },
        { title: 'Публикация в App Store / Play Market', hours: 3, priority: 'high' },
        { title: 'Сбор первых отзывов и оценок', hours: 2, priority: 'medium' },
      ]},
      { name: 'Рост и итерации', durationPct: 10, color: PHASE_COLORS[4], tasks: [
        { title: 'Анализ retention и удержания', hours: 3, priority: 'high' },
        { title: 'Исправление критических багов v1.1', hours: 5, priority: 'high' },
        { title: 'ASO-оптимизация листинга', hours: 3, priority: 'medium' },
      ]},
    ];

    case 'language': return [
      { name: 'Диагностика и план', durationPct: 8, color: PHASE_COLORS[0], tasks: [
        { title: 'Тест текущего уровня (placement test)', hours: 2, priority: 'high' },
        { title: 'Выбор курсов и учебных материалов', hours: 3, priority: 'high' },
        { title: 'Создание расписания и ежедневных ритуалов', hours: 2, priority: 'high' },
      ]},
      { name: 'Грамматика и словарный запас', durationPct: 25, color: PHASE_COLORS[1], tasks: [
        { title: 'Изучение базовой грамматики', hours: 15, priority: 'high' },
        { title: '1000 самых частых слов (карточки Anki)', hours: 10, priority: 'high' },
        { title: 'Практика аудирования (подкасты, видео)', hours: 8, priority: 'medium' },
        { title: 'Ежедневные упражнения 30 мин', hours: 12, priority: 'high' },
      ]},
      { name: 'Разговорная практика', durationPct: 30, color: PHASE_COLORS[2], tasks: [
        { title: 'Занятия с носителем языка (iTalki / Preply)', hours: 12, priority: 'high' },
        { title: 'Онлайн-разговорный клуб', hours: 8, priority: 'medium' },
        { title: 'Просмотр фильмов и сериалов на целевом языке', hours: 10, priority: 'medium' },
        { title: 'Письменная практика: дневник на целевом языке', hours: 6, priority: 'low' },
      ]},
      { name: 'Подготовка к экзамену', durationPct: 27, color: PHASE_COLORS[3], tasks: [
        { title: 'Пробные тесты и анализ ошибок', hours: 10, priority: 'high' },
        { title: 'Тренировка всех секций (Reading, Writing, Listening, Speaking)', hours: 12, priority: 'high' },
        { title: 'Итоговый mock-экзамен', hours: 4, priority: 'high' },
      ]},
      { name: 'Экзамен и поддержание уровня', durationPct: 10, color: PHASE_COLORS[4], tasks: [
        { title: 'Сдача экзамена', hours: 4, priority: 'high' },
        { title: 'Ежедневная практика для поддержания уровня', hours: 5, priority: 'medium' },
      ]},
    ];

    case 'finance': return [
      { name: 'Аудит финансов', durationPct: 20, color: PHASE_COLORS[3], tasks: [
        { title: 'Анализ всех доходов и расходов за 3 месяца', hours: 4, priority: 'high' },
        { title: 'Составить персональный бюджет', hours: 3, priority: 'high' },
        { title: 'Расчёт текущего финансового состояния', hours: 2, priority: 'high' },
        { title: 'Определить финансовые цели на 1/3/5 лет', hours: 3, priority: 'high' },
      ]},
      { name: 'Оптимизация расходов', durationPct: 20, color: PHASE_COLORS[0], tasks: [
        { title: 'Составить план экономии', hours: 3, priority: 'high' },
        { title: 'Ревизия подписок и автосписаний', hours: 2, priority: 'medium' },
        { title: 'Рефинансирование кредитов (если есть)', hours: 4, priority: 'high' },
        { title: 'Создать финансовую подушку (3 мес. расходов)', hours: 2, priority: 'high' },
      ]},
      { name: 'Основы инвестирования', durationPct: 25, color: PHASE_COLORS[1], tasks: [
        { title: 'Изучить типы инструментов: акции, облигации, ETF', hours: 6, priority: 'high' },
        { title: 'Открыть брокерский счёт / ИИС', hours: 2, priority: 'high' },
        { title: 'Составить инвестиционный портфель', hours: 4, priority: 'high' },
        { title: 'Первые вложения в ETF / индексные фонды', hours: 2, priority: 'medium' },
      ]},
      { name: 'Пассивный доход', durationPct: 25, color: PHASE_COLORS[2], tasks: [
        { title: 'Изучить 3 источника пассивного дохода', hours: 5, priority: 'medium' },
        { title: 'Запустить первый пассивный доход', hours: 8, priority: 'high' },
        { title: 'Автоматизировать ежемесячные накопления', hours: 2, priority: 'medium' },
      ]},
      { name: 'Мониторинг и рост', durationPct: 10, color: PHASE_COLORS[4], tasks: [
        { title: 'Ежемесячный обзор портфеля', hours: 2, priority: 'medium' },
        { title: 'Корректировка инвестиционной стратегии', hours: 3, priority: 'medium' },
        { title: 'Налоговый вычет по ИИС', hours: 2, priority: 'medium' },
      ]},
    ];

    case 'renovation': return [
      { name: 'Планирование и смета', durationPct: 18, color: PHASE_COLORS[0], tasks: [
        { title: 'Определить объём работ и приоритеты', hours: 4, priority: 'high' },
        { title: 'Составить детальную смету', hours: 6, priority: 'high' },
        { title: 'Выбрать дизайн-концепцию и материалы', hours: 5, priority: 'high' },
        { title: 'Найти и нанять бригаду / подрядчиков', hours: 8, priority: 'high' },
      ]},
      { name: 'Черновые работы', durationPct: 28, color: PHASE_COLORS[5], tasks: [
        { title: 'Демонтаж и снос старых конструкций', hours: 12, priority: 'high' },
        { title: 'Электрика: разводка и замена проводки', hours: 10, priority: 'high' },
        { title: 'Сантехника: трубы и розетки', hours: 8, priority: 'high' },
        { title: 'Выравнивание стен и стяжка полов', hours: 10, priority: 'high' },
      ]},
      { name: 'Чистовые работы', durationPct: 35, color: PHASE_COLORS[1], tasks: [
        { title: 'Укладка плитки в санузле и кухне', hours: 12, priority: 'high' },
        { title: 'Укладка напольных покрытий', hours: 8, priority: 'high' },
        { title: 'Покраска стен и потолков', hours: 10, priority: 'high' },
        { title: 'Установка дверей и наличников', hours: 6, priority: 'medium' },
      ]},
      { name: 'Монтаж и финиш', durationPct: 19, color: PHASE_COLORS[3], tasks: [
        { title: 'Установка мебели и встроенной техники', hours: 10, priority: 'high' },
        { title: 'Декор, освещение и текстиль', hours: 6, priority: 'medium' },
        { title: 'Финальная уборка и приёмка работ', hours: 4, priority: 'high' },
      ]},
    ];

    case 'marathon': return [
      { name: 'Подготовка к тренировкам', durationPct: 10, color: PHASE_COLORS[3], tasks: [
        { title: 'Медицинская консультация и допуск к бегу', hours: 3, priority: 'high' },
        { title: 'Выбор кроссовок и экипировки', hours: 2, priority: 'high' },
        { title: 'Выбор тренировочного плана', hours: 2, priority: 'high' },
        { title: 'Базовые беговые тесты (ЧСС, темп)', hours: 2, priority: 'medium' },
      ]},
      { name: 'Строительство базы', durationPct: 30, color: PHASE_COLORS[0], tasks: [
        { title: 'Длинные пробежки: 20–30 км/нед.', hours: 4, priority: 'high' },
        { title: 'Разминка и заминка каждую тренировку', hours: 1, priority: 'high' },
        { title: 'Питание и гидратация во время бега', hours: 2, priority: 'medium' },
        { title: 'ОФП: укрепление ног и кора', hours: 2, priority: 'medium' },
      ]},
      { name: 'Интенсификация', durationPct: 38, color: PHASE_COLORS[1], tasks: [
        { title: 'Длинные пробежки: 35–45 км/нед.', hours: 6, priority: 'high' },
        { title: 'Темповые тренировки', hours: 3, priority: 'high' },
        { title: 'Тренировки на марафонском темпе', hours: 4, priority: 'high' },
        { title: 'Восстановление: сон, растяжка, массаж', hours: 2, priority: 'medium' },
        { title: 'Тест: полумарафон в соревновательном темпе', hours: 3, priority: 'high' },
      ]},
      { name: 'Tapering и забег', durationPct: 22, color: PHASE_COLORS[4], tasks: [
        { title: 'Снижение объёма тренировок (tapering)', hours: 3, priority: 'high' },
        { title: 'Стратегия распределения сил на 42 км', hours: 2, priority: 'high' },
        { title: 'Подготовка снаряжения к забегу', hours: 1, priority: 'medium' },
        { title: '🏅 Пробежать первый марафон!', hours: 5, priority: 'high' },
      ]},
    ];

    case 'course': return [
      { name: 'Концепция и валидация', durationPct: 15, color: PHASE_COLORS[0], tasks: [
        { title: 'Выбор темы и целевой аудитории', hours: 3, priority: 'high' },
        { title: 'Анализ конкурентных курсов', hours: 4, priority: 'high' },
        { title: 'Customer Development: 10 интервью', hours: 6, priority: 'high' },
        { title: 'Разработка учебной программы', hours: 4, priority: 'high' },
      ]},
      { name: 'Производство контента', durationPct: 38, color: PHASE_COLORS[1], tasks: [
        { title: 'Написание сценариев всех уроков', hours: 10, priority: 'high' },
        { title: 'Запись видеоуроков', hours: 15, priority: 'high' },
        { title: 'Создание рабочих материалов и заданий', hours: 6, priority: 'medium' },
        { title: 'Монтаж и постпродакшн видео', hours: 10, priority: 'high' },
        { title: 'Настройка платформы (Teachable / GetCourse)', hours: 4, priority: 'medium' },
      ]},
      { name: 'Запуск и продажи', durationPct: 32, color: PHASE_COLORS[2], tasks: [
        { title: 'Создать продающий лендинг', hours: 8, priority: 'high' },
        { title: 'Написать email-серию для запуска', hours: 5, priority: 'high' },
        { title: 'Провести бесплатный вебинар-демо', hours: 4, priority: 'high' },
        { title: 'Запустить таргетированную рекламу', hours: 4, priority: 'high' },
        { title: 'Первые продажи и онбординг студентов', hours: 3, priority: 'high' },
      ]},
      { name: 'Масштабирование', durationPct: 15, color: PHASE_COLORS[3], tasks: [
        { title: 'Сбор отзывов и NPS студентов', hours: 3, priority: 'high' },
        { title: 'Доработка курса по фидбеку', hours: 5, priority: 'medium' },
        { title: 'Настройка автоматической воронки', hours: 6, priority: 'high' },
        { title: 'Партнёрская программа', hours: 3, priority: 'low' },
      ]},
    ];

    case 'podcast': return [
      { name: 'Концепция и позиционирование', durationPct: 18, color: PHASE_COLORS[6], tasks: [
        { title: 'Выбор темы, формата и целевой аудитории', hours: 4, priority: 'high' },
        { title: 'Анализ конкурентных подкастов', hours: 4, priority: 'high' },
        { title: 'Разработка названия и обложки', hours: 3, priority: 'medium' },
        { title: 'Составить контент-план на первые 10 эпизодов', hours: 3, priority: 'high' },
      ]},
      { name: 'Техническая подготовка', durationPct: 14, color: PHASE_COLORS[0], tasks: [
        { title: 'Выбор и покупка микрофона', hours: 2, priority: 'high' },
        { title: 'Настройка DAW (Audacity / GarageBand)', hours: 3, priority: 'high' },
        { title: 'Регистрация на хостинге (Spotify for Podcasters)', hours: 2, priority: 'high' },
        { title: 'Тестовая запись и настройка звука', hours: 2, priority: 'medium' },
      ]},
      { name: 'Первые эпизоды', durationPct: 38, color: PHASE_COLORS[1], tasks: [
        { title: 'Запись и монтаж эпизодов 1–3', hours: 10, priority: 'high' },
        { title: 'Публикация с описаниями и тегами', hours: 3, priority: 'high' },
        { title: 'Продвижение в соцсетях', hours: 5, priority: 'high' },
        { title: 'Запись и монтаж эпизодов 4–8', hours: 12, priority: 'high' },
        { title: 'Создать регулярный календарь выхода', hours: 2, priority: 'medium' },
      ]},
      { name: 'Рост и монетизация', durationPct: 30, color: PHASE_COLORS[2], tasks: [
        { title: 'Приглашение интересных гостей', hours: 6, priority: 'high' },
        { title: 'Кросс-промо с другими подкастами', hours: 4, priority: 'medium' },
        { title: 'Поиск первых спонсоров', hours: 5, priority: 'medium' },
        { title: 'Запуск Patreon или донатов', hours: 3, priority: 'low' },
      ]},
    ];

    case 'design': return [
      { name: 'Прокачка навыков', durationPct: 20, color: PHASE_COLORS[6], tasks: [
        { title: 'Figma: продвинутый уровень (компоненты, автолейаут)', hours: 8, priority: 'high' },
        { title: 'Изучить UX-принципы и паттерны', hours: 6, priority: 'high' },
        { title: 'Пройти курс по UX Research', hours: 8, priority: 'medium' },
      ]},
      { name: 'Разработка кейсов', durationPct: 42, color: PHASE_COLORS[1], tasks: [
        { title: 'Кейс 1: редизайн существующего продукта', hours: 15, priority: 'high' },
        { title: 'User Research и юзабилити-тесты для кейса 1', hours: 6, priority: 'high' },
        { title: 'Кейс 2: мобильное приложение с нуля', hours: 15, priority: 'high' },
        { title: 'Кейс 3: веб-интерфейс / дэшборд', hours: 12, priority: 'medium' },
      ]},
      { name: 'Портфолио и бренд', durationPct: 23, color: PHASE_COLORS[0], tasks: [
        { title: 'Создать сайт-портфолио (Notion / Readymag / код)', hours: 8, priority: 'high' },
        { title: 'Написать описания кейсов с процессом', hours: 6, priority: 'high' },
        { title: 'Обновить LinkedIn и Behance', hours: 3, priority: 'medium' },
        { title: 'Дизайн CV под вакансии', hours: 3, priority: 'medium' },
      ]},
      { name: 'Поиск работы / клиентов', durationPct: 15, color: PHASE_COLORS[3], tasks: [
        { title: 'Публикация работ на Behance / Dribbble', hours: 3, priority: 'high' },
        { title: 'Активный отклик на вакансии', hours: 5, priority: 'high' },
        { title: 'Первый фриланс-проект или контракт', hours: 4, priority: 'high' },
      ]},
    ];

    case 'relocation': return [
      { name: 'Выбор направления', durationPct: 12, color: PHASE_COLORS[0], tasks: [
        { title: 'Исследование стран: качество жизни, налоги, визы', hours: 8, priority: 'high' },
        { title: 'Финансовый план переезда', hours: 4, priority: 'high' },
        { title: 'Финальный выбор страны и города', hours: 3, priority: 'high' },
      ]},
      { name: 'Документы и юридическая подготовка', durationPct: 25, color: PHASE_COLORS[1], tasks: [
        { title: 'Сбор и проверка всех необходимых документов', hours: 6, priority: 'high' },
        { title: 'Нотариальный перевод документов с апостилем', hours: 4, priority: 'high' },
        { title: 'Подача заявки на визу / вид на жительство', hours: 5, priority: 'high' },
        { title: 'Юридическая консультация по налогам', hours: 3, priority: 'medium' },
      ]},
      { name: 'Логистика и подготовка', durationPct: 28, color: PHASE_COLORS[2], tasks: [
        { title: 'Поиск жилья удалённо', hours: 8, priority: 'high' },
        { title: 'Поиск удалённой работы или клиентов', hours: 10, priority: 'high' },
        { title: 'Базовое изучение языка страны', hours: 6, priority: 'medium' },
        { title: 'Решить вопрос с вещами (продать, отправить)', hours: 4, priority: 'medium' },
      ]},
      { name: 'Переезд', durationPct: 20, color: PHASE_COLORS[4], tasks: [
        { title: 'Перелёт и заселение', hours: 8, priority: 'high' },
        { title: 'Регистрация по адресу проживания', hours: 3, priority: 'high' },
        { title: 'Открытие банковского счёта', hours: 3, priority: 'high' },
        { title: 'SIM-карта и базовый быт', hours: 2, priority: 'medium' },
      ]},
      { name: 'Адаптация', durationPct: 15, color: PHASE_COLORS[3], tasks: [
        { title: 'Социализация и первые знакомства', hours: 5, priority: 'medium' },
        { title: 'Изучение района и инфраструктуры', hours: 3, priority: 'low' },
        { title: 'Обустройство быта и рутины', hours: 4, priority: 'medium' },
      ]},
    ];

    // ── General fallback ──────────────────────────────────────────────────────
    default: return [
      { name: 'Подготовка и исследование', durationPct: 20, color: PHASE_COLORS[0], tasks: [
        { title: 'Определить и уточнить цель', hours: 3, priority: 'high' },
        { title: 'Сбор информации и ресурсов', hours: 5, priority: 'high' },
        { title: 'Анализ рисков и препятствий', hours: 3, priority: 'medium' },
      ]},
      { name: 'Планирование', durationPct: 15, color: PHASE_COLORS[1], tasks: [
        { title: 'Составить детальный план действий', hours: 4, priority: 'high' },
        { title: 'Распределить ресурсы', hours: 3, priority: 'high' },
        { title: 'Установить контрольные точки', hours: 2, priority: 'medium' },
      ]},
      { name: 'Реализация — Этап 1', durationPct: 25, color: PHASE_COLORS[2], tasks: [
        { title: 'Выполнение ключевых задач', hours: 12, priority: 'high' },
        { title: 'Регулярные проверки прогресса', hours: 4, priority: 'medium' },
        { title: 'Корректировка плана', hours: 3, priority: 'medium' },
      ]},
      { name: 'Реализация — Этап 2', durationPct: 25, color: PHASE_COLORS[3], tasks: [
        { title: 'Продвинутые задачи', hours: 12, priority: 'high' },
        { title: 'Промежуточная оценка результатов', hours: 4, priority: 'high' },
      ]},
      { name: 'Финализация', durationPct: 15, color: PHASE_COLORS[4], tasks: [
        { title: 'Проверка всех выполненных задач', hours: 5, priority: 'high' },
        { title: 'Финальная доработка', hours: 6, priority: 'high' },
        { title: 'Оценка результатов', hours: 3, priority: 'medium' },
      ]},
    ];
  }
}

export function generatePlan(goal: string, deadline: string, hoursPerWeek: number): Plan {
  const goalType = detectGoalType(goal);
  const templates = getTemplates(goalType);
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const totalDays = Math.max(differenceInDays(deadlineDate, today), 14);

  let currentDate = today;
  const phases: Phase[] = templates.map((template, phaseIndex) => {
    const phaseDays = Math.max(Math.round((template.durationPct / 100) * totalDays), 3);
    const phaseStart = currentDate;
    const phaseEnd = addDays(phaseStart, phaseDays);

    const tasks: Task[] = template.tasks.map((taskTemplate, taskIndex) => {
      const taskDurationDays = Math.max(Math.ceil(taskTemplate.hours / (hoursPerWeek / 5)), 1);
      const taskStart = addDays(phaseStart, Math.round((taskIndex / template.tasks.length) * phaseDays));
      const taskEnd = addDays(taskStart, taskDurationDays);

      return {
        id: uid(),
        phase_id: `phase-${phaseIndex}`,
        title: taskTemplate.title,
        duration_hours: taskTemplate.hours,
        priority: taskTemplate.priority,
        depends_on: [],
        status: 'todo' as const,
        start_date: format(taskStart, 'yyyy-MM-dd'),
        end_date: format(taskEnd > phaseEnd ? phaseEnd : taskEnd, 'yyyy-MM-dd'),
        tags: [],
      };
    });

    const phase: Phase = {
      id: `phase-${phaseIndex}`,
      name: template.name,
      duration_days: phaseDays,
      color: template.color,
      tasks,
      start_date: format(phaseStart, 'yyyy-MM-dd'),
      end_date: format(phaseEnd, 'yyyy-MM-dd'),
    };

    currentDate = addDays(phaseEnd, 1);
    return phase;
  });

  return {
    id: uid(),
    goal,
    deadline,
    hours_per_week: hoursPerWeek,
    total_days: totalDays,
    phases,
    created_at: new Date().toISOString(),
  };
}