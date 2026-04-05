export type AgentLevel = 'L0' | 'L1' | 'L2';
export type AgentStatus = 'active' | 'idle' | 'paused' | 'archived';

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
