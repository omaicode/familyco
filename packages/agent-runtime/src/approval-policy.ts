export type ApprovalCategory = 'AP-01' | 'AP-02' | 'AP-03';

export type ApprovalResolution =
  | 'approve'
  | 'reject'
  | 'request_change'
  | 'clarification_answer';

export interface ApprovalEvaluation {
  category: ApprovalCategory;
  requiresApproval: boolean;
  requiresClarification: boolean;
  reason: string;
}

const AP_01_ACTIONS = new Set<string>([
  'agent.create',
  'agent.delete',
  'project.archive',
  'budget.hard_cap.exceed',
  'provider.credentials.rotate',
  'settings.company.defaults.modify',
  'bulk.destructive.change'
]);

const AP_02_ACTIONS = new Set<string>([
  'project.create.high_risk',
  'automation.recurring.create',
  'task.critical.assign.new_agent',
  'external.side_effect.call',
  'provider.model.premium.use'
]);

const AP_03_ACTIONS = new Set<string>([
  'clarify.intent.vague',
  'clarify.deadline.missing',
  'clarify.budget_cap.missing',
  'clarify.project_ownership.conflict',
  'clarify.acceptance_criteria.unclear'
]);

export function evaluateApprovalCategory(action: string): ApprovalEvaluation {
  if (AP_01_ACTIONS.has(action)) {
    return {
      category: 'AP-01',
      requiresApproval: true,
      requiresClarification: false,
      reason: 'Action requires hard approval before execution.'
    };
  }

  if (AP_02_ACTIONS.has(action)) {
    return {
      category: 'AP-02',
      requiresApproval: true,
      requiresClarification: false,
      reason: 'Action requires approval unless overridden by policy.'
    };
  }

  if (AP_03_ACTIONS.has(action)) {
    return {
      category: 'AP-03',
      requiresApproval: false,
      requiresClarification: true,
      reason: 'Clarification is required before continuing execution.'
    };
  }

  return {
    category: 'AP-02',
    requiresApproval: false,
    requiresClarification: false,
    reason: 'No explicit approval gate required for this action.'
  };
}

export function resolutionToRunOutcome(resolution: ApprovalResolution): 'resume' | 'replan' | 'cancel' {
  if (resolution === 'approve' || resolution === 'clarification_answer') {
    return 'resume';
  }

  if (resolution === 'request_change') {
    return 'replan';
  }

  return 'cancel';
}
