import {
  type ApprovalMode,
  type ApprovalService,
  ApprovalGuard,
  type ApprovalRequest
} from '@familyco/core';

import type { AuthContext } from '../../plugins/auth.types.js';

export interface EnsureApprovalInput {
  approvalGuard: ApprovalGuard;
  approvalService: ApprovalService;
  authContext: AuthContext | undefined;
  action: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

export interface ApprovalOutcomeAllowed {
  allowed: true;
  mode: ApprovalMode;
}

export interface ApprovalOutcomeBlocked {
  allowed: false;
  mode: ApprovalMode;
  reason: string;
  request: ApprovalRequest;
}

export type ApprovalOutcome = ApprovalOutcomeAllowed | ApprovalOutcomeBlocked;

export async function ensureApproval(input: EnsureApprovalInput): Promise<ApprovalOutcome> {
  const actorId = input.authContext?.subject ?? 'unknown';
  const mode = resolveApprovalMode(input.authContext?.level);

  const decision = input.approvalGuard.check(mode, {
    actorId,
    action: input.action,
    targetId: input.targetId,
    payload: input.payload
  });

  if (decision.allowed) {
    return {
      allowed: true,
      mode
    };
  }

  const request = await input.approvalService.createApprovalRequest({
    actorId,
    action: input.action,
    targetId: input.targetId,
    payload: input.payload
  });

  return {
    allowed: false,
    mode,
    reason: decision.reason ?? `Approval required for ${input.action}`,
    request
  };
}

function resolveApprovalMode(level: AuthContext['level'] | undefined): ApprovalMode {
  if (level === 'L0') {
    return 'auto';
  }

  if (level === 'L1') {
    return 'suggest_only';
  }

  return 'require_review';
}