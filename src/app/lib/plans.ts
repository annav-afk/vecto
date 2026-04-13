export type PlanTier = 'free' | 'medium' | 'pro';

export interface TierConfig {
  id: PlanTier;
  name: string;
  price: string;
  period: string;
  plansPerCycle: number;
  cycleDays?: number;      // for free: 3-day trial
  cycleName: string;
  hasExport: boolean;
  hasTemplates: boolean;
  hasSupport: boolean;
  color: string;
  glowColor: string;
  badge?: string;
  features: string[];
  notFeatures?: string[];  // features explicitly blocked (shown as crossed out)
  cta: string;
}

export const TIERS: Record<PlanTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: '0₽',
    period: '',
    plansPerCycle: 2,
    cycleDays: 3,
    cycleName: '3 дня',
    hasExport: false,
    hasTemplates: false,
    hasSupport: false,
    color: '#64748b',
    glowColor: 'rgba(100,116,139,0.2)',
    features: [
      '2 плана за 3 дня',
      'AI-генерация плана',
      'Все режимы просмотра',
      'Базовая приоритизация',
    ],
    cta: 'Начать бесплатно',
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    price: '400₽',
    period: '/мес',
    plansPerCycle: 5,
    cycleName: 'месяц',
    hasExport: false,
    hasTemplates: true,
    hasSupport: false,
    color: '#1d4ed8',
    glowColor: 'rgba(29,78,216,0.22)',
    features: [
      '5 планов в месяц',
      'AI-генерация плана',
      'Все режимы просмотра',
      'Шаблоны по нишам',
      'Зависимости задач',
      'Базовая аналитика',
    ],
    notFeatures: ['Экспорт (CSV / Google Cal)'],
    cta: 'Выбрать Medium',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '600₽',
    period: '/мес',
    plansPerCycle: 50,
    cycleName: 'месяц',
    hasExport: true,
    hasTemplates: true,
    hasSupport: true,
    color: '#1e40af',
    glowColor: 'rgba(30,64,175,0.25)',
    badge: 'Лучший выбор',
    features: [
      'До 50 планов в месяц',
      'AI-генерация плана',
      'Все режимы просмотра',
      'Экспорт: CSV + Google Calendar',
      'Все шаблоны по нишам',
      'Зависимости задач',
      'Полная аналитика',
      'Поддержка — запись к специалисту',
    ],
    cta: 'Выбрать Pro',
  },
};

export const TIER_ORDER: PlanTier[] = ['free', 'medium', 'pro'];

export function getPlanLimit(tier: PlanTier): number {
  return TIERS[tier].plansPerCycle;
}

export function canExport(tier: PlanTier): boolean {
  return TIERS[tier].hasExport;
}

export function hasSupport(tier: PlanTier): boolean {
  return TIERS[tier].hasSupport;
}

export function canUseTemplates(tier: PlanTier): boolean {
  return TIERS[tier].hasTemplates;
}

export function getTierLabel(tier: PlanTier): string {
  return TIERS[tier].name;
}

export function getTierColor(tier: PlanTier): string {
  return TIERS[tier].color;
}

export function getTierBadgeStyle(tier: PlanTier): Record<string, string> {
  const map: Record<PlanTier, Record<string, string>> = {
    free: {
      background: 'rgba(100,116,139,0.1)',
      border: '1px solid rgba(100,116,139,0.2)',
      color: '#64748b',
    },
    medium: {
      background: 'rgba(29,78,216,0.1)',
      border: '1px solid rgba(29,78,216,0.25)',
      color: '#1d4ed8',
    },
    pro: {
      background: 'rgba(30,64,175,0.1)',
      border: '1px solid rgba(30,64,175,0.25)',
      color: '#1e40af',
    },
  };
  return map[tier];
}