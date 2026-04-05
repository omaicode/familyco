export type ApprovalMode = 'auto' | 'suggest_only' | 'require_review';

export interface ApprovalContext {
  actorId: string;
  action: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

export interface ApprovalDecision {
  allowed: boolean;
  requiresReview: boolean;
  reason?: string;
}
