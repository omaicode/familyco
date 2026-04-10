import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { uiRuntime } from '../runtime';

const TOUR_SEEN_KEY = 'tour.seen';

const buildSteps = (t: (key: string) => string): DriveStep[] => [
  {
    element: '#tour-dashboard',
    popover: {
      title: t('tour.step.dashboard.title'),
      description: t('tour.step.dashboard.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-inbox',
    popover: {
      title: t('tour.step.inbox.title'),
      description: t('tour.step.inbox.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-chat',
    popover: {
      title: t('tour.step.chat.title'),
      description: t('tour.step.chat.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-agents',
    popover: {
      title: t('tour.step.agents.title'),
      description: t('tour.step.agents.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-projects',
    popover: {
      title: t('tour.step.projects.title'),
      description: t('tour.step.projects.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-tasks',
    popover: {
      title: t('tour.step.tasks.title'),
      description: t('tour.step.tasks.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-settings',
    popover: {
      title: t('tour.step.settings.title'),
      description: t('tour.step.settings.desc'),
      side: 'right',
      align: 'center',
    },
  },
];

export function useTutorialTour() {
  const isSeen = (): boolean =>
    uiRuntime.stores.settings.state.data.some(
      s => s.key === TOUR_SEEN_KEY && s.value === true
    );

  const markSeen = (): void => {
    void uiRuntime.api.upsertSetting({ key: TOUR_SEEN_KEY, value: true });
  };

  const start = (t: (key: string) => string): void => {
    const driverObj = driver({
      animate: true,
      allowClose: true,
      showProgress: true,
      progressText: t('tour.progress'),
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.back'),
      doneBtnText: t('tour.done'),
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      onDestroyStarted: () => {
        markSeen();
        driverObj.destroy();
      },
      steps: buildSteps(t),
    });
    driverObj.drive();
  };

  return { start, isSeen, markSeen };
}
