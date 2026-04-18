import { randomUUID } from 'node:crypto';

import type {
  EventBus,
  InboxService,
  SettingsService,
  TaskService
} from '@familyco/core';

import type {
  BudgetNearLimitNotificationInput,
  FounderNotificationInput,
  FounderNotificationTrigger
} from './notification.types.js';

const FOUNDER_ID = 'founder';
const BUDGET_MONTH_MARKER_KEY = 'notification.budgetNearLimit.lastAlertMonth';

const TRIGGER_SETTING_KEYS: Record<FounderNotificationTrigger, string> = {
  'task.status.agent': 'notification.trigger.taskStatusFromAgent',
  'task.comment.agent': 'notification.trigger.taskCommentFromAgent',
  'inbox.approval.required': 'notification.trigger.inboxApprovalRequested',
  'budget.near.limit': 'notification.trigger.budgetNearLimit'
};

export interface NotificationServiceDeps {
  eventBus: EventBus;
  inboxService: InboxService;
  settingsService: SettingsService;
  taskService: TaskService;
}

export class NotificationService {
  constructor(private readonly deps: NotificationServiceDeps) {}

  register(): void {
    this.deps.eventBus.on('task.status.updated', (payload) => {
      void this.handleTaskStatusUpdated(payload).catch(() => undefined);
    });

    this.deps.eventBus.on('task.comment.added', (payload) => {
      void this.handleTaskCommentAdded(payload).catch(() => undefined);
    });

    this.deps.eventBus.on('approval.requested', (payload) => {
      void this.handleApprovalRequested(payload).catch(() => undefined);
    });
  }

  async notifyBudgetNearLimit(input: BudgetNearLimitNotificationInput): Promise<boolean> {
    if (!(await this.isTriggerEnabled('budget.near.limit'))) {
      return false;
    }

    const marker = await this.deps.settingsService.get(BUDGET_MONTH_MARKER_KEY);
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (marker?.value === currentMonth) {
      return false;
    }

    const usedPercent = Math.round(input.usedPercent * 10) / 10;
    const title = `Budget alert: ${usedPercent}% used`;
    const body = `Monthly budget usage reached ${usedPercent}% (${input.totalCostUSD.toFixed(2)} / ${input.monthlyLimitUSD.toFixed(2)} USD).`;

    await this.createFounderNotification({
      trigger: 'budget.near.limit',
      severity: usedPercent >= 100 ? 'alert' : 'warning',
      title,
      body,
      route: '/budget',
      senderId: 'system',
      payload: {
        usedPercent,
        monthlyLimitUSD: input.monthlyLimitUSD,
        alertThresholdPercent: input.alertThresholdPercent,
        totalCostUSD: input.totalCostUSD,
        month: currentMonth
      }
    });

    await this.deps.settingsService.upsert({
      key: BUDGET_MONTH_MARKER_KEY,
      value: currentMonth
    });

    return true;
  }

  private async handleTaskStatusUpdated(payload: {
    taskId: string;
    status: string;
    source?: 'agent' | 'human' | 'system';
    actorId?: string;
  }): Promise<void> {
    if (payload.source !== 'agent') {
      return;
    }

    if (!(await this.isTriggerEnabled('task.status.agent'))) {
      return;
    }

    const task = await this.deps.taskService.getTask(payload.taskId).catch(() => null);
    const taskLabel = task?.title ?? payload.taskId;

    await this.createFounderNotification({
      trigger: 'task.status.agent',
      severity: 'info',
      title: 'Task status updated by agent',
      body: `Task "${taskLabel}" moved to ${payload.status}.`,
      route: '/tasks',
      senderId: payload.actorId ?? 'system',
      payload: {
        taskId: payload.taskId,
        taskStatus: payload.status,
        actorId: payload.actorId,
        source: payload.source,
        taskTitle: task?.title
      }
    });
  }

  private async handleTaskCommentAdded(payload: {
    taskId: string;
    authorId: string;
    authorType: 'agent' | 'human';
    authorLabel?: string;
    body: string;
    commentId?: string;
  }): Promise<void> {
    if (payload.authorType !== 'agent') {
      return;
    }

    if (!(await this.isTriggerEnabled('task.comment.agent'))) {
      return;
    }

    const task = await this.deps.taskService.getTask(payload.taskId).catch(() => null);
    const taskLabel = task?.title ?? payload.taskId;

    await this.createFounderNotification({
      trigger: 'task.comment.agent',
      severity: 'info',
      title: 'New agent comment in task',
      body: `${payload.authorLabel ?? payload.authorId} commented on "${taskLabel}".`,
      route: '/tasks',
      senderId: payload.authorId,
      payload: {
        taskId: payload.taskId,
        taskTitle: task?.title,
        commentId: payload.commentId,
        authorId: payload.authorId,
        authorLabel: payload.authorLabel,
        excerpt: payload.body.slice(0, 280)
      }
    });
  }

  private async handleApprovalRequested(payload: {
    actorId: string;
    action: string;
  }): Promise<void> {
    if (!(await this.isTriggerEnabled('inbox.approval.required'))) {
      return;
    }

    const notificationId = randomUUID();
    const createdAt = new Date().toISOString();

    this.deps.eventBus.emit('notification.created', {
      notificationId,
      recipientId: FOUNDER_ID,
      trigger: 'inbox.approval.required',
      severity: 'warning',
      title: 'Approval required',
      body: `A new approval request is waiting in Inbox (${payload.action}).`,
      route: '/inbox',
      createdAt,
      payload: {
        action: payload.action,
        actorId: payload.actorId
      }
    });
  }

  private async createFounderNotification(input: FounderNotificationInput): Promise<void> {
    const message = await this.deps.inboxService.createMessage({
      recipientId: FOUNDER_ID,
      senderId: input.senderId ?? 'system',
      type: input.severity === 'alert' ? 'alert' : 'info',
      title: input.title,
      body: input.body,
      payload: {
        trigger: input.trigger,
        route: input.route,
        ...input.payload
      }
    });

    this.deps.eventBus.emit('notification.created', {
      notificationId: message.id,
      recipientId: FOUNDER_ID,
      trigger: input.trigger,
      severity: input.severity,
      title: input.title,
      body: input.body,
      route: input.route,
      createdAt: message.createdAt.toISOString(),
      payload: message.payload
    });
  }

  private async isTriggerEnabled(trigger: FounderNotificationTrigger): Promise<boolean> {
    const [globalSetting, triggerSetting] = await Promise.all([
      this.deps.settingsService.get('notification.enabled'),
      this.deps.settingsService.get(TRIGGER_SETTING_KEYS[trigger])
    ]);

    const globalEnabled = toBooleanSetting(globalSetting?.value, true);
    if (!globalEnabled) {
      return false;
    }

    return toBooleanSetting(triggerSetting?.value, true);
  }
}

function toBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}
