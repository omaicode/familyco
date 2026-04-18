export type FounderNotificationTrigger =
  | 'task.status.agent'
  | 'task.comment.agent'
  | 'inbox.approval.required'
  | 'budget.near.limit';

export type FounderNotificationSeverity = 'info' | 'warning' | 'alert';

export interface FounderNotificationInput {
  trigger: FounderNotificationTrigger;
  severity: FounderNotificationSeverity;
  title: string;
  body: string;
  route: string;
  senderId?: string;
  payload?: Record<string, unknown>;
}

export interface BudgetNearLimitNotificationInput {
  usedPercent: number;
  monthlyLimitUSD: number;
  alertThresholdPercent: number;
  totalCostUSD: number;
}
