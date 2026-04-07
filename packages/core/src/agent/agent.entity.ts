export type AgentLevel = 'L0' | 'L1' | 'L2';
export type AgentStatus = 'active' | 'idle' | 'running' | 'error' | 'paused' | 'terminated';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  level: AgentLevel;
  department: string;
  status: AgentStatus;
  parentAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
}
