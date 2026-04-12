export type AgentLevel = 'L0' | 'L1' | 'L2';
export type AgentStatus = 'active' | 'idle' | 'running' | 'error' | 'paused' | 'terminated' | 'archived';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  level: AgentLevel;
  department: string;
  status: AgentStatus;
  parentAgentId: string | null;
  aiAdapterId: string | null;
  aiModel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDeleteResult {
  deletedAgentIds: string[];
  deletedProjectIds: string[];
  deletedTaskIds: string[];
  deletedApprovalIds: string[];
  fallbackAgentId: string;
  reassignedTaskCount: number;
  reassignedProjectCount: number;
  reassignedChildAgentCount: number;
}

export interface CreateAgentInput {
  name: string;
  role: string;
  level: AgentLevel;
  department: string;
  parentAgentId?: string | null;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  department?: string;
  status?: AgentStatus;
  aiAdapterId?: string | null;
  aiModel?: string | null;
}
