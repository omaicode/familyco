export type ApprovalMode = 'auto' | 'suggest_only' | 'require_review';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

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

export interface ApprovalRequest {
  id: string;
  actorId: string;
  action: string;
  targetId?: string;
  status: ApprovalStatus;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApprovalRequestInput {
  actorId: string;
  action: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

export interface DecideApprovalInput {
  id: string;
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>;
}
