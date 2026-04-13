import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { updateOnboarding } from '../lib/cloudSync';

const TOURED_KEY = 'stride_toured_v1';

interface Props {
  isReady: boolean; // pass true once the page DOM is ready
}

export function OnboardingTour({ isReady }: Props) {
  useEffect(() => {
    if (!isReady) return;
    if (localStorage.getItem(TOURED_KEY)) return;

    // Small delay to let DOM settle
    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        progressText: '{{current}} из {{total}}',
        nextBtnText: 'Далее →',
        prevBtnText: '← Назад',
        doneBtnText: 'Готово ✓',
        popoverClass: 'stride-tour',
        animate: true,
        overlayOpacity: 0.6,
        onDestroyStarted: () => {
          localStorage.setItem(TOURED_KEY, '1');
          try { updateOnboarding({ toured: true }); } catch {}
          driverObj.destroy();
        },
        steps: [
          {
            element: '[data-tour="stats"]',
            popover: {
              title: '📊 Статистика плана',
              description: 'Здесь отображается общий прогресс — выполненные задачи, часы и дедлайн.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '[data-tour="view-toggle"]',
            popover: {
              title: '👁 Три режима просмотра',
              description: 'Переключайтесь между Таймлайном, Kanban и Календарём — выберите удобный формат.',
              side: 'bottom',
              align: 'end',
            },
          },
          {
            element: '[data-tour="phases"]',
            popover: {
              title: '🗂 Этапы плана',
              description: 'Слева — список этапов. Нажмите на этап, чтобы раскрыть задачи. Кликните на задачу — откроется редактор.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="main-view"]',
            popover: {
              title: '🎯 Основная область',
              description: 'Здесь отображается выбранный вид. В Kanban можно перетаскивать задачи между колонками.',
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '[data-tour="analytics-btn"]',
            popover: {
              title: '📈 Аналитика',
              description: 'Откройте аналитику: burn-down chart, прогресс по фазам и heatmap активности.',
              side: 'bottom',
              align: 'end',
            },
          },
        ],
      });

      driverObj.drive();
    }, 600);

    return () => clearTimeout(timer);
  }, [isReady]);

  return null;
}