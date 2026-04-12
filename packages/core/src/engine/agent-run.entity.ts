export type AgentRunTriggerType =
  | 'founder_chat'
  | 'task_execution'
  | 'retry'
  | 'approval_resume'
  | 'schedule';

export type AgentRunState =
  | 'queued'
  | 'planning'
  | 'waiting_approval'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentRun {
  id: string;
  companyId?: string;
  rootAgentId: string;
  parentRunId: string | null;
  triggerType: AgentRunTriggerType;
  state: AgentRunState;
  inputSummary: string;
  outputSummary: string | null;
  linkedProjectId: string | null;
  linkedTaskId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentRunInput {
  companyId?: string;
  rootAgentId: string;
  parentRunId?: string | null;
  triggerType: AgentRunTriggerType;
  state?: AgentRunState;
  inputSummary: string;
  linkedProjectId?: string | null;
  linkedTaskId?: string | null;
}

export interface UpdateAgentRunStateInput {
  state: AgentRunState;
  outputSummary?: string | null;
}
