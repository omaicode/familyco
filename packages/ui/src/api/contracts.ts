import type { UIApiClient } from './client.js';

export interface AgentListItem {
  id: string;
  name: string;
  role: string;
  level: 'L0' | 'L1' | 'L2';
  department: string;
  status: 'active' | 'idle' | 'paused' | 'archived';
  parentAgentId: string | null;
}

export interface TaskListItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'review' | 'done' | 'blocked' | 'cancelled';
  assigneeAgentId: string | null;
  projectId: string;
  createdBy: string;
}

export interface ApprovalListItem {
  id: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AuditListItem {
  id: string;
  action: string;
  actorType: 'founder' | 'agent' | 'system';
  actorId: string;
  createdAt: string;
}

export interface CreateAgentPayload {
  name: string;
  role: string;
  level: 'L0' | 'L1' | 'L2';
  department: string;
  parentAgentId?: string | null;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  projectId: string;
  assigneeAgentId?: string | null;
  createdBy: string;
}

export interface DecideApprovalPayload {
  approvalId: string;
  status: 'approved' | 'rejected';
  note?: string;
}

export interface UpdateTaskStatusPayload {
  taskId: string;
  status: 'pending' | 'in_progress' | 'review' | 'done' | 'blocked' | 'cancelled';
}

export interface PauseAgentPayload {
  agentId: string;
}

export interface FamilyCoApiContracts {
  listAgents: () => Promise<AgentListItem[]>;
  createAgent: (payload: CreateAgentPayload) => Promise<AgentListItem>;
  pauseAgent: (payload: PauseAgentPayload) => Promise<AgentListItem>;
  listTasks: (projectId: string) => Promise<TaskListItem[]>;
  createTask: (payload: CreateTaskPayload) => Promise<TaskListItem>;
  updateTaskStatus: (payload: UpdateTaskStatusPayload) => Promise<TaskListItem>;
  listApprovals: () => Promise<ApprovalListItem[]>;
  decideApproval: (payload: DecideApprovalPayload) => Promise<ApprovalListItem>;
  listAudit: (limit?: number) => Promise<AuditListItem[]>;
}

export const createFamilyCoApiContracts = (client: UIApiClient): FamilyCoApiContracts => ({
  listAgents: () => client.get<AgentListItem[]>('/api/v1/agents'),
  createAgent: (payload) => client.post<AgentListItem, CreateAgentPayload>('/api/v1/agents', payload),
  pauseAgent: (payload) => client.post<AgentListItem>(`/api/v1/agents/${payload.agentId}/pause`),
  listTasks: (projectId) => client.get<TaskListItem[]>(`/api/v1/tasks?projectId=${projectId}`),
  createTask: (payload) => client.post<TaskListItem, CreateTaskPayload>('/api/v1/tasks', payload),
  updateTaskStatus: (payload) =>
    client.post<TaskListItem, Omit<UpdateTaskStatusPayload, 'taskId'>>(
      `/api/v1/tasks/${payload.taskId}/status`,
      {
        status: payload.status
      }
    ),
  listApprovals: () => client.get<ApprovalListItem[]>('/api/v1/approvals'),
  decideApproval: (payload) =>
    client.post<ApprovalListItem, Omit<DecideApprovalPayload, 'approvalId'>>(
      `/api/v1/approvals/${payload.approvalId}/decision`,
      {
        status: payload.status,
        note: payload.note
      }
    ),
  listAudit: (limit = 30) => client.get<AuditListItem[]>(`/api/v1/audit?limit=${limit}`)
});
