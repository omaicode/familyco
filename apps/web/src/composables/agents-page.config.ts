import type { AgentListItem } from '@familyco/ui';

export type AgentLevel = AgentListItem['level'];
export type AgentStatus = AgentListItem['status'];
export type LevelFilter = 'all' | AgentLevel;
export type StatusFilter = 'all' | AgentStatus;
export type CreateTemplateId = 'executive' | 'lead' | 'specialist';
export type AgentApprovalResponse = {
  approvalRequired: true;
  approvalRequestId: string;
  reason?: string;
};
export type AgentActionResult = AgentListItem | AgentApprovalResponse;
export type AgentDeleteActionResult = {
  deletedAgentIds: string[];
  deletedProjectIds: string[];
  deletedTaskIds: string[];
  deletedApprovalIds: string[];
  fallbackAgentId: string;
  reassignedTaskCount: number;
  reassignedProjectCount: number;
  reassignedChildAgentCount: number;
} | AgentApprovalResponse;
type AgentApprovalResult = AgentActionResult | AgentDeleteActionResult;

const LEVEL_ORDER: Record<AgentLevel, number> = { L0: 0, L1: 1, L2: 2 };
const STATUS_ORDER: Record<AgentStatus, number> = {
  active: 0,
  idle: 1,
  running: 2,
  error: 3,
  paused: 4,
  archived: 5,
  terminated: 6
};

export const AGENT_STATUS_META: Record<
  AgentStatus,
  {
    label: string;
    description: string;
  }
> = {
  active: {
    label: 'Active',
    description: 'Ready to receive the next heartbeat.'
  },
  idle: {
    label: 'Idle',
    description: 'Sleeping between heartbeat bursts with context restored on wake.'
  },
  running: {
    label: 'Running',
    description: 'A heartbeat is currently in progress.'
  },
  error: {
    label: 'Error',
    description: 'The last heartbeat failed and should be reviewed.'
  },
  paused: {
    label: 'Paused',
    description: 'Manually paused or stopped by budget guardrails.'
  },
  archived: {
    label: 'Archived',
    description: 'Hidden from active operations but retained for reporting history.'
  },
  terminated: {
    label: 'Terminated',
    description: 'Permanently deactivated and kept for audit history only.'
  }
};

export const HEALTHY_AGENT_STATUSES: AgentStatus[] = ['active', 'idle', 'running'];
export const HEARTBEAT_READY_STATUSES: AgentStatus[] = ['active', 'idle'];
export const ATTENTION_AGENT_STATUSES: AgentStatus[] = ['error', 'paused', 'archived'];
export const PAUSABLE_AGENT_STATUSES: AgentStatus[] = ['active', 'idle', 'running', 'error'];
export const RESUMABLE_AGENT_STATUSES: AgentStatus[] = ['paused', 'archived'];
export const ARCHIVABLE_AGENT_STATUSES: AgentStatus[] = ['active', 'idle', 'running', 'paused', 'error'];

export const TEMPLATE_PRESETS: Record<
  CreateTemplateId,
  {
    title: string;
    description: string;
    draft: {
      name: string;
      role: string;
      level: AgentLevel;
      department: string;
    };
  }
> = {
  executive: {
    title: 'Executive',
    description: 'Set up the L0 command layer for approvals and cross-team delegation.',
    draft: {
      name: 'Chief of Staff',
      role: 'Executive Agent',
      level: 'L0',
      department: 'Executive'
    }
  },
  lead: {
    title: 'Department lead',
    description: 'Create an L1 owner for planning and team coordination.',
    draft: {
      name: 'Operations Lead',
      role: 'Department Lead',
      level: 'L1',
      department: 'Operations'
    }
  },
  specialist: {
    title: 'Specialist',
    description: 'Add a focused L2 operator for repeatable delivery work.',
    draft: {
      name: 'Research Specialist',
      role: 'Specialist Agent',
      level: 'L2',
      department: 'Research'
    }
  }
};

export const templateCards = (Object.entries(TEMPLATE_PRESETS) as Array<[
  CreateTemplateId,
  (typeof TEMPLATE_PRESETS)[CreateTemplateId]
]>).map(([id, template]) => ({
  id,
  title: template.title,
  description: template.description
}));

export const AUTONOMY_GUIDE: Record<
  AgentLevel,
  {
    label: string;
    description: string;
    note: string;
  }
> = {
  L0: {
    label: 'Executive governance',
    description: 'Best for company-wide planning, hiring proposals, and decisions that need Founder approval.',
    note: 'Default pattern: suggest-only with the Founder, auto-delegate to department leads.'
  },
  L1: {
    label: 'Department control',
    description: 'Good for planning and coordinating work across one function without losing oversight.',
    note: 'Default pattern: suggest-only for strategic changes, auto for internal coordination.'
  },
  L2: {
    label: 'Execution lane',
    description: 'Optimized for fast delivery on scoped tasks with clear ownership and guardrails.',
    note: 'Default pattern: auto for internal work, require review for external side effects.'
  }
};

export const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const sortAgents = (items: AgentListItem[]): AgentListItem[] =>
  [...items].sort((left, right) => {
    const levelOrder = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];
    if (levelOrder !== 0) {
      return levelOrder;
    }

    const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusOrder !== 0) {
      return statusOrder;
    }

    return left.name.localeCompare(right.name);
  });

export const isApprovalResponse = (result: AgentApprovalResult): result is AgentApprovalResponse =>
  'approvalRequired' in result;
