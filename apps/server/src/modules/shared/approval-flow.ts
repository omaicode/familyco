import {
  type ApprovalMode,
  type ApprovalService,
  ApprovalGuard,
  type ApprovalRequest,
  type SettingsService
} from '@familyco/core';

import type { AuthContext } from '../../plugins/auth.types.js';

export interface EnsureApprovalInput {
  approvalGuard: ApprovalGuard;
  approvalService: ApprovalService;
  settingsService?: SettingsService;
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
  const mode = await resolveApprovalMode(input.authContext?.level, input.settingsService);

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

async function resolveApprovalMode(
  level: AuthContext['level'] | undefined,
  settingsService?: SettingsService
): Promise<ApprovalMode> {
  const configured = await settingsService?.get('agent.defaultApprovalMode');
  const override = normalizeApprovalModeSetting(configured?.value);
  if (override) {
    return override;
  }

  if (level === 'L0') {
    return 'auto';
  }

  if (level === 'L1') {
    return 'suggest_only';
  }

  return 'require_review';
}

function normalizeApprovalModeSetting(value: unknown): ApprovalMode | null {
  if (value === 'auto' || value === 'suggest_only' || value === 'require_review') {
    return value;
  }

  if (value === 'suggest') {
    return 'suggest_only';
  }

  if (value === 'review') {
    return 'require_review';
  }

  return null;
}