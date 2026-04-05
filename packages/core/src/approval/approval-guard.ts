import type { ApprovalContext, ApprovalDecision, ApprovalMode } from './approval.entity.js';

export class ApprovalGuard {
  check(mode: ApprovalMode, context: ApprovalContext): ApprovalDecision {
    if (mode === 'auto') {
      return {
        allowed: true,
        requiresReview: false
      };
    }

    if (mode === 'suggest_only') {
      return {
        allowed: false,
        requiresReview: true,
        reason: `Approval required for action: ${context.action}`
      };
    }

    return {
      allowed: false,
      requiresReview: true,
      reason: `Hard approval required for action: ${context.action}`
    };
  }
}
