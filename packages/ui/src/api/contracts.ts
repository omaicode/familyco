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

export interface InboxMessageItem {
  id: string;
  recipientId: string;
  senderId: string;
  type: 'approval' | 'report' | 'alert' | 'info';
  title: string;
  body: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
}

export interface SettingItem {
  key: string;
  value: unknown;
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

export interface UpdateAgentParentPayload {
  agentId: string;
  parentAgentId: string | null;
}

export interface InitializeSetupPayload {
  companyName: string;
  departments: string[];
}

export interface ReadInboxMessagePayload {
  id: string;
}

export interface ArchiveInboxMessagePayload {
  id: string;
}

export interface UpsertSettingPayload {
  key: string;
  value: unknown;
}

export interface FamilyCoApiContracts {
  listAgents: () => Promise<AgentListItem[]>;
  listAgentChildren: (agentId: string) => Promise<AgentListItem[]>;
  getAgentPath: (agentId: string) => Promise<AgentListItem[]>;
  createAgent: (payload: CreateAgentPayload) => Promise<AgentListItem>;
  pauseAgent: (payload: PauseAgentPayload) => Promise<AgentListItem>;
  updateAgentParent: (payload: UpdateAgentParentPayload) => Promise<AgentListItem>;
  listTasks: (projectId: string) => Promise<TaskListItem[]>;
  createTask: (payload: CreateTaskPayload) => Promise<TaskListItem>;
  updateTaskStatus: (payload: UpdateTaskStatusPayload) => Promise<TaskListItem>;
  listApprovals: () => Promise<ApprovalListItem[]>;
  decideApproval: (payload: DecideApprovalPayload) => Promise<ApprovalListItem>;
  listInbox: (recipientId: string) => Promise<InboxMessageItem[]>;
  readInboxMessage: (payload: ReadInboxMessagePayload) => Promise<InboxMessageItem>;
  archiveInboxMessage: (payload: ArchiveInboxMessagePayload) => Promise<InboxMessageItem>;
  listSettings: () => Promise<SettingItem[]>;
  upsertSetting: (payload: UpsertSettingPayload) => Promise<SettingItem>;
  initializeSetup: (payload: InitializeSetupPayload) => Promise<{
    companyName: string;
    executiveAgent: AgentListItem;
    departmentAgents: AgentListItem[];
  }>;
  listAudit: (limit?: number) => Promise<AuditListItem[]>;
}

export const createFamilyCoApiContracts = (client: UIApiClient): FamilyCoApiContracts => ({
  listAgents: () => client.get<AgentListItem[]>('/api/v1/agents'),
  listAgentChildren: (agentId) => client.get<AgentListItem[]>(`/api/v1/agents/${agentId}/children`),
  getAgentPath: (agentId) => client.get<AgentListItem[]>(`/api/v1/agents/${agentId}/path`),
  createAgent: (payload) => client.post<AgentListItem, CreateAgentPayload>('/api/v1/agents', payload),
  pauseAgent: (payload) => client.post<AgentListItem>(`/api/v1/agents/${payload.agentId}/pause`),
  updateAgentParent: (payload) =>
    client.patch<AgentListItem, { parentAgentId: string | null }>(
      `/api/v1/agents/${payload.agentId}/parent`,
      {
        parentAgentId: payload.parentAgentId
      }
    ),
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
  listInbox: (recipientId) => client.get<InboxMessageItem[]>(`/api/v1/inbox?recipientId=${recipientId}`),
  readInboxMessage: (payload) => client.post<InboxMessageItem>(`/api/v1/inbox/${payload.id}/read`),
  archiveInboxMessage: (payload) => client.post<InboxMessageItem>(`/api/v1/inbox/${payload.id}/archive`),
  listSettings: () => client.get<SettingItem[]>('/api/v1/settings'),
  upsertSetting: (payload) => client.post<SettingItem, UpsertSettingPayload>('/api/v1/settings', payload),
  initializeSetup: (payload) =>
    client.post<
      {
        companyName: string;
        executiveAgent: AgentListItem;
        departmentAgents: AgentListItem[];
      },
      InitializeSetupPayload
    >('/api/v1/setup/initialize', payload),
  listAudit: (limit = 30) => client.get<AuditListItem[]>(`/api/v1/audit?limit=${limit}`)
});
