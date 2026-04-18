import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { uiRuntime } from '../runtime';
import { useToast } from '../plugins/toast.plugin';
import { useI18n } from './useI18n';
import { subscribeEventsStream } from './useEventsSocket';

interface FounderNotificationEvent {
  notificationId: string;
  recipientId: string;
  trigger: 'task.status.agent' | 'task.comment.agent' | 'inbox.approval.required' | 'budget.near.limit';
  severity: 'info' | 'warning' | 'alert';
  title: string;
  body: string;
  route: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

interface DesktopWindowStateEvent {
  type: 'window-state';
  isVisible?: boolean;
}

interface DesktopNotificationClickEvent {
  type: 'notification-click';
  route: string;
  notificationId?: string;
}

type DesktopSystemEvent = DesktopWindowStateEvent | DesktopNotificationClickEvent;

const MAX_SEEN_IDS = 300;

export function useFounderNotifications(): void {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();

  const isDesktopRuntime =
    typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function';
  const isDesktopWindowVisible = ref(true);

  let unsubscribeEventsStream: (() => void) | null = null;
  let unsubscribeDesktopEvents: (() => void) | null = null;
  const seenNotificationIds = new Set<string>();

  const canUseBrowserNotifications = (): boolean =>
    typeof window !== 'undefined' && 'Notification' in window;

  const getSettingBoolean = (key: string, fallback: boolean): boolean => {
    const value = uiRuntime.stores.settings.state.data.find((item) => item.key === key)?.value;

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }

    return fallback;
  };

  const isNotificationEnabled = (trigger: FounderNotificationEvent['trigger']): boolean => {
    if (!getSettingBoolean('notification.enabled', true)) {
      return false;
    }

    const settingKeyByTrigger: Record<FounderNotificationEvent['trigger'], string> = {
      'task.status.agent': 'notification.trigger.taskStatusFromAgent',
      'task.comment.agent': 'notification.trigger.taskCommentFromAgent',
      'inbox.approval.required': 'notification.trigger.inboxApprovalRequested',
      'budget.near.limit': 'notification.trigger.budgetNearLimit'
    };

    return getSettingBoolean(settingKeyByTrigger[trigger], true);
  };

  const parseDesktopSystemEvent = (payload: unknown): DesktopSystemEvent | null => {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const candidate = payload as Partial<DesktopSystemEvent>;

    if (candidate.type === 'window-state') {
      return {
        type: 'window-state',
        ...(typeof candidate.isVisible === 'boolean' ? { isVisible: candidate.isVisible } : {})
      };
    }

    if (candidate.type === 'notification-click' && typeof candidate.route === 'string') {
      return {
        type: 'notification-click',
        route: candidate.route,
        ...(typeof candidate.notificationId === 'string'
          ? { notificationId: candidate.notificationId }
          : {})
      };
    }

    return null;
  };

  const parseFounderNotification = (raw: unknown): FounderNotificationEvent | null => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Partial<FounderNotificationEvent>;
    if (
      typeof candidate.notificationId !== 'string' ||
      typeof candidate.recipientId !== 'string' ||
      typeof candidate.trigger !== 'string' ||
      typeof candidate.severity !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.body !== 'string' ||
      typeof candidate.route !== 'string' ||
      typeof candidate.createdAt !== 'string'
    ) {
      return null;
    }

    if (
      candidate.trigger !== 'task.status.agent' &&
      candidate.trigger !== 'task.comment.agent' &&
      candidate.trigger !== 'inbox.approval.required' &&
      candidate.trigger !== 'budget.near.limit'
    ) {
      return null;
    }

    if (
      candidate.severity !== 'info' &&
      candidate.severity !== 'warning' &&
      candidate.severity !== 'alert'
    ) {
      return null;
    }

    return {
      notificationId: candidate.notificationId,
      recipientId: candidate.recipientId,
      trigger: candidate.trigger,
      severity: candidate.severity,
      title: candidate.title,
      body: candidate.body,
      route: candidate.route,
      createdAt: candidate.createdAt,
      ...(candidate.payload && typeof candidate.payload === 'object'
        ? { payload: candidate.payload as Record<string, unknown> }
        : {})
    };
  };

  const toLocalizedNotification = (event: FounderNotificationEvent): { title: string; body: string } => {
    const payload = event.payload ?? {};

    if (event.trigger === 'task.status.agent') {
      const taskTitle =
        typeof payload.taskTitle === 'string' && payload.taskTitle.trim().length > 0
          ? payload.taskTitle
          : (typeof payload.taskId === 'string' ? payload.taskId : '');
      const status = typeof payload.taskStatus === 'string' ? payload.taskStatus : '';
      return {
        title: t('notification.toast.taskStatus.title'),
        body: t('notification.toast.taskStatus.body', { taskTitle, status })
      };
    }

    if (event.trigger === 'task.comment.agent') {
      const authorLabel =
        typeof payload.authorLabel === 'string' && payload.authorLabel.trim().length > 0
          ? payload.authorLabel
          : (typeof payload.authorId === 'string' ? payload.authorId : 'Agent');
      const taskTitle =
        typeof payload.taskTitle === 'string' && payload.taskTitle.trim().length > 0
          ? payload.taskTitle
          : (typeof payload.taskId === 'string' ? payload.taskId : 'task');
      return {
        title: t('notification.toast.taskComment.title'),
        body: t('notification.toast.taskComment.body', { authorLabel, taskTitle })
      };
    }

    if (event.trigger === 'inbox.approval.required') {
      const action = typeof payload.action === 'string' ? payload.action : '';
      return {
        title: t('notification.toast.approval.title'),
        body: t('notification.toast.approval.body', { action })
      };
    }

    if (event.trigger === 'budget.near.limit') {
      const usedPercent =
        typeof payload.usedPercent === 'number'
          ? payload.usedPercent
          : Number(payload.usedPercent ?? 0);
      return {
        title: t('notification.toast.budget.title'),
        body: t('notification.toast.budget.body', { percent: Number.isFinite(usedPercent) ? usedPercent.toFixed(1) : '0.0' })
      };
    }

    return {
      title: event.title,
      body: event.body
    };
  };

  const isDocumentVisible = (): boolean => {
    if (typeof document === 'undefined') {
      return true;
    }

    return document.visibilityState === 'visible';
  };

  const showBrowserNotification = (title: string, body: string, route: string): boolean => {
    if (!canUseBrowserNotifications()) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    const notification = new Notification(title, {
      body,
      tag: `familyco-${route}`
    });

    notification.onclick = () => {
      window.focus();
      void router.push(route);
    };

    return true;
  };

  const showDesktopNativeNotification = async (
    event: FounderNotificationEvent,
    title: string,
    body: string
  ): Promise<boolean> => {
    if (!isDesktopRuntime) {
      return false;
    }

    if (!getSettingBoolean('notification.channel.electronNative', true)) {
      return false;
    }

    if (isDesktopWindowVisible.value) {
      return false;
    }

    try {
      await window.familycoDesktop!.invoke('desktop:notification:show', {
        notificationId: event.notificationId,
        title,
        body,
        route: event.route
      });
      return true;
    } catch {
      return false;
    }
  };

  const markSeen = (notificationId: string): boolean => {
    if (seenNotificationIds.has(notificationId)) {
      return false;
    }

    seenNotificationIds.add(notificationId);
    if (seenNotificationIds.size > MAX_SEEN_IDS) {
      const oldest = seenNotificationIds.values().next().value;
      if (typeof oldest === 'string') {
        seenNotificationIds.delete(oldest);
      }
    }

    return true;
  };

  const handleFounderNotification = async (event: FounderNotificationEvent): Promise<void> => {
    if (event.recipientId !== 'founder') {
      return;
    }

    if (!markSeen(event.notificationId)) {
      return;
    }

    if (!isNotificationEnabled(event.trigger)) {
      return;
    }

    const localized = toLocalizedNotification(event);
    const route = event.route || '/inbox';

    const desktopShown = await showDesktopNativeNotification(event, localized.title, localized.body);
    if (desktopShown) {
      return;
    }

    const isVisible = isDesktopRuntime ? isDesktopWindowVisible.value : isDocumentVisible();
    const inAppEnabled = getSettingBoolean('notification.channel.inApp', true);

    if (!isVisible && !isDesktopRuntime && getSettingBoolean('notification.channel.browser', true)) {
      if (showBrowserNotification(localized.title, localized.body, route)) {
        return;
      }
    }

    if (inAppEnabled) {
      const toastType = event.severity === 'alert' ? 'error' : 'info';
      toast.show({ type: toastType, message: `${localized.title}: ${localized.body}`, durationMs: 8000 });
    }
  };

  const handleSocketMessage = (event: { type?: string; payload?: unknown }): void => {
    if (event.type !== 'notification.created') {
      return;
    }

    const notificationEvent = parseFounderNotification(event.payload);
    if (!notificationEvent) {
      return;
    }

    void handleFounderNotification(notificationEvent);
  };

  const syncDesktopWindowState = async (): Promise<void> => {
    if (!isDesktopRuntime) {
      return;
    }

    try {
      const state = await window.familycoDesktop!.invoke('desktop:window:state', {});
      if (state && typeof state === 'object' && 'isVisible' in state && typeof (state as { isVisible?: unknown }).isVisible === 'boolean') {
        isDesktopWindowVisible.value = Boolean((state as { isVisible: boolean }).isVisible);
      }
    } catch {
      // Ignore startup timing errors.
    }
  };

  onMounted(() => {
    unsubscribeEventsStream = subscribeEventsStream(handleSocketMessage);

    if (!isDesktopRuntime) {
      return;
    }

    unsubscribeDesktopEvents = window.familycoDesktop!.on('desktop:system:event', (payload) => {
      const event = parseDesktopSystemEvent(payload);
      if (!event) {
        return;
      }

      if (event.type === 'window-state' && typeof event.isVisible === 'boolean') {
        isDesktopWindowVisible.value = event.isVisible;
        return;
      }

      if (event.type === 'notification-click') {
        void router.push(event.route);
      }
    });

    void syncDesktopWindowState();
  });

  onUnmounted(() => {
    unsubscribeEventsStream?.();
    unsubscribeEventsStream = null;
    unsubscribeDesktopEvents?.();
    unsubscribeDesktopEvents = null;
  });
}
