import type { UIApiClient } from './client.js';

export interface AgentListItem {
  id: string;
  name: string;
  role: string;
  level: 'L0' | 'L1' | 'L2';
  department: string;
  status: 'active' | 'idle' | 'running' | 'error' | 'paused' | 'terminated';
  parentAgentId: string | null;
  aiAdapterId: string | null;
  aiModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'approval' | 'report' | 'alert' | 'info';
  title: string;
  body: string;
  createdAt: string;
  direction: 'founder_to_agent' | 'agent_to_founder';
  payload?: {
    taskId?: string;
    projectId?: string;
    toolCalls?: ChatToolCallItem[];
    [key: string]: unknown;
  };
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  ownerAgentId: string;
  parentProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'review' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeAgentId: string | null;
  projectId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  actorId: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardSummary {
  metrics: {
    activeAgents: number;
    tasksToday: number;
    blockedTasks: number;
    blockedRatio: number;
    pendingApprovals: number;
    approvalLatencyMinutes: number;
    throughputDoneLast24h: number;
    tokenUsageToday: number;
  };
  recentTasks: Array<{
    id: string;
    title: string;
    status: TaskListItem['status'];
    projectId: string;
    updatedAt: string;
  }>;
  pendingApprovals: ApprovalListItem[];
  latestAudit: AuditListItem[];
}

export interface ListAuditPayload {
  actorId?: string;
  action?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateAgentPayload {
  name: string;
  role: string;
  level: 'L0' | 'L1' | 'L2';
  department: string;
  parentAgentId?: string | null;
}

export interface AgentActionApprovalResponse {
  approvalRequired: true;
  approvalRequestId: string;
  reason?: string;
}

export type CreateAgentResult = AgentListItem | AgentActionApprovalResponse;
export type PauseAgentResult = AgentListItem | AgentActionApprovalResponse;

export interface CreateProjectPayload {
  name: string;
  description: string;
  ownerAgentId: string;
  parentProjectId?: string | null;
}

export interface UpdateProjectPayload {
  projectId: string;
  name: string;
  description: string;
  ownerAgentId: string;
  parentProjectId?: string | null;
}

export interface DeleteProjectPayload {
  projectId: string;
}

export interface ProjectActionApprovalResponse {
  approvalRequired: true;
  approvalRequestId: string;
  reason?: string;
}

export interface DeleteProjectSuccessResponse {
  id: string;
}

export type CreateProjectResult = ProjectListItem | ProjectActionApprovalResponse;
export type UpdateProjectResult = ProjectListItem | ProjectActionApprovalResponse;
export type DeleteProjectResult = DeleteProjectSuccessResponse | ProjectActionApprovalResponse;

export interface CreateTaskPayload {
  title: string;
  description: string;
  projectId?: string;
  assigneeAgentId?: string | null;
  assignedToId?: string | null;
  createdBy?: string;
  priority?: TaskListItem['priority'];
  dueAt?: string;
}

export interface TaskApprovalResponse {
  approvalRequired: true;
  approvalRequestId: string;
  reason?: string;
}

export interface UpdateTaskPayload {
  taskId: string;
  title: string;
  description: string;
  projectId: string;
  assigneeAgentId?: string | null;
  createdBy: string;
  priority: TaskListItem['priority'];
}

export interface DeleteTaskPayload {
  taskId: string;
}

export interface DeleteTaskSuccessResponse {
  id: string;
}

export interface TaskCommentItem {
  id: string;
  taskId: string;
  body: string;
  authorId: string;
  authorType: 'agent' | 'human';
  authorLabel: string;
  createdAt: string;
}

export interface CreateTaskCommentPayload {
  taskId: string;
  body: string;
  authorId: string;
  authorType: TaskCommentItem['authorType'];
  authorLabel?: string;
}

export type CreateTaskResult = TaskListItem | TaskApprovalResponse;
export type UpdateTaskResult = TaskListItem | TaskApprovalResponse;
export type UpdateTaskStatusResult = TaskListItem | TaskApprovalResponse;
export type UpdateTaskPriorityResult = TaskListItem | TaskApprovalResponse;
export type BulkUpdateTasksResult = TaskListItem[] | TaskApprovalResponse;
export type DeleteTaskResult = DeleteTaskSuccessResponse | TaskApprovalResponse;

export interface ListTasksQuery {
  projectId?: string;
  status?: TaskListItem['status'];
  priority?: TaskListItem['priority'];
  assigneeAgentId?: string;
  q?: string;
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

export interface UpdateTaskPriorityPayload {
  taskId: string;
  priority: TaskListItem['priority'];
}

export interface BulkUpdateTasksPayload {
  taskIds: string[];
  action: 'update_status' | 'update_priority';
  status?: TaskListItem['status'];
  priority?: TaskListItem['priority'];
}

export interface PauseAgentPayload {
  agentId: string;
}

export interface UpdateAgentPayload {
  agentId: string;
  name: string;
  role: string;
  department: string;
  status: AgentListItem['status'];
  aiAdapterId?: string | null;
  aiModel?: string | null;
}

export interface UpdateAgentParentPayload {
  agentId: string;
  parentAgentId: string | null;
}

export interface InitializeSetupPayload {
  companyName: string;
  companyDescription?: string;
}

export interface ChatToolRequest {
  toolName: string;
  arguments?: Record<string, unknown>;
}

export interface SendAgentChatPayload {
  agentId: string;
  message: string;
  meta?: {
    projectId?: string;
    taskId?: string;
    toolCall?: ChatToolRequest;
    toolCalls?: ChatToolRequest[];
  };
}

export interface ChatToolCallItem {
  toolName: string;
  ok: boolean;
  summary: string;
  error?: {
    code?: string;
    message?: string;
  };
  output?: unknown;
}

export interface SendAgentChatResult {
  founderMessage: AgentChatMessage;
  replyMessage: AgentChatMessage;
  reply: string;
  task?: TaskListItem | null;
  project?: ProjectListItem | null;
  toolCalls?: ChatToolCallItem[];
}

export interface ReadInboxMessagePayload {
  id: string;
}

export interface ArchiveInboxMessagePayload {
  id: string;
}

export interface TestAdapterPayload {
  adapterId: string;
  apiKey: string;
  model?: string;
}

export interface AdapterTestResult {
  ok: boolean;
  latencyMs: number;
  model?: string;
  error?: string;
}

export interface UpsertSettingPayload {
  key: string;
  value: unknown;
}

export interface GetAgentChatQuery {
  limit?: number;
  before?: string;
}

export interface FamilyCoApiContracts {
  listAgents: () => Promise<AgentListItem[]>;
  listAgentChildren: (agentId: string) => Promise<AgentListItem[]>;
  getAgentPath: (agentId: string) => Promise<AgentListItem[]>;
  getAgentChat: (agentId: string, query?: GetAgentChatQuery) => Promise<AgentChatMessage[]>;
  sendAgentChat: (payload: SendAgentChatPayload) => Promise<SendAgentChatResult>;
  createAgent: (payload: CreateAgentPayload) => Promise<CreateAgentResult>;
  pauseAgent: (payload: PauseAgentPayload) => Promise<PauseAgentResult>;
  updateAgent: (payload: UpdateAgentPayload) => Promise<AgentListItem>;
  updateAgentParent: (payload: UpdateAgentParentPayload) => Promise<AgentListItem>;
  listProjects: () => Promise<ProjectListItem[]>;
  createProject: (payload: CreateProjectPayload) => Promise<CreateProjectResult>;
  updateProject: (payload: UpdateProjectPayload) => Promise<UpdateProjectResult>;
  deleteProject: (payload: DeleteProjectPayload) => Promise<DeleteProjectResult>;
  listTasks: (query?: ListTasksQuery) => Promise<TaskListItem[]>;
  createTask: (payload: CreateTaskPayload) => Promise<CreateTaskResult>;
  updateTask: (payload: UpdateTaskPayload) => Promise<UpdateTaskResult>;
  updateTaskStatus: (payload: UpdateTaskStatusPayload) => Promise<UpdateTaskStatusResult>;
  updateTaskPriority: (payload: UpdateTaskPriorityPayload) => Promise<UpdateTaskPriorityResult>;
  bulkUpdateTasks: (payload: BulkUpdateTasksPayload) => Promise<BulkUpdateTasksResult>;
  deleteTask: (payload: DeleteTaskPayload) => Promise<DeleteTaskResult>;
  listTaskComments: (taskId: string) => Promise<TaskCommentItem[]>;
  createTaskComment: (payload: CreateTaskCommentPayload) => Promise<TaskCommentItem>;
  listApprovals: () => Promise<ApprovalListItem[]>;
  decideApproval: (payload: DecideApprovalPayload) => Promise<ApprovalListItem>;
  listInbox: (recipientId: string) => Promise<InboxMessageItem[]>;
  readInboxMessage: (payload: ReadInboxMessagePayload) => Promise<InboxMessageItem>;
  archiveInboxMessage: (payload: ArchiveInboxMessagePayload) => Promise<InboxMessageItem>;
  listSettings: () => Promise<SettingItem[]>;
  upsertSetting: (payload: UpsertSettingPayload) => Promise<SettingItem>;
  testProviderAdapter: (payload: TestAdapterPayload) => Promise<AdapterTestResult>;
  initializeSetup: (payload: InitializeSetupPayload) => Promise<{
    companyName: string;
    companyDescription: string;
    executiveAgent: AgentListItem;
    defaultProject: ProjectListItem | null;
  }>;
  getDashboardSummary: (projectId?: string) => Promise<DashboardSummary>;
  listAudit: (query?: ListAuditPayload) => Promise<AuditListItem[]>;
}

export const createFamilyCoApiContracts = (client: UIApiClient): FamilyCoApiContracts => ({
  listAgents: () => client.get<AgentListItem[]>('/api/v1/agents'),
  listAgentChildren: (agentId) => client.get<AgentListItem[]>(`/api/v1/agents/${agentId}/children`),
  getAgentPath: (agentId) => client.get<AgentListItem[]>(`/api/v1/agents/${agentId}/path`),
  getAgentChat: (agentId, query = {}) => {
    const params = new URLSearchParams();
    if (typeof query.limit === 'number') {
      params.set('limit', String(query.limit));
    }
    if (query.before) {
      params.set('before', query.before);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return client.get<AgentChatMessage[]>(`/api/v1/agents/${agentId}/chat${suffix}`);
  },
  sendAgentChat: (payload) =>
    client.post<SendAgentChatResult, Omit<SendAgentChatPayload, 'agentId'>>(
      `/api/v1/agents/${payload.agentId}/chat`,
      {
        message: payload.message,
        meta: payload.meta
      }
    ),
  createAgent: (payload) => client.post<CreateAgentResult, CreateAgentPayload>('/api/v1/agents', payload),
  pauseAgent: (payload) => client.post<PauseAgentResult>(`/api/v1/agents/${payload.agentId}/pause`),
  updateAgent: (payload) =>
    client.patch<AgentListItem, Omit<UpdateAgentPayload, 'agentId'>>(`/api/v1/agents/${payload.agentId}`, {
      name: payload.name,
      role: payload.role,
      department: payload.department,
      status: payload.status,
      aiAdapterId: payload.aiAdapterId,
      aiModel: payload.aiModel
    }),
  updateAgentParent: (payload) =>
    client.patch<AgentListItem, { parentAgentId: string | null }>(
      `/api/v1/agents/${payload.agentId}/parent`,
      {
        parentAgentId: payload.parentAgentId
      }
    ),
  listProjects: () => client.get<ProjectListItem[]>('/api/v1/projects'),
  createProject: (payload) => client.post<CreateProjectResult, CreateProjectPayload>('/api/v1/projects', payload),
  updateProject: (payload) =>
    client.patch<UpdateProjectResult, Omit<UpdateProjectPayload, 'projectId'>>(`/api/v1/projects/${payload.projectId}`, {
      name: payload.name,
      description: payload.description,
      ownerAgentId: payload.ownerAgentId,
      parentProjectId: payload.parentProjectId ?? null
    }),
  deleteProject: (payload) => client.delete<DeleteProjectResult>(`/api/v1/projects/${payload.projectId}`),
  listTasks: (query = {}) => {
    const params = new URLSearchParams();
    if (query.projectId) {
      params.set('projectId', query.projectId);
    }
    if (query.status) {
      params.set('status', query.status);
    }
    if (query.priority) {
      params.set('priority', query.priority);
    }
    if (query.assigneeAgentId) {
      params.set('assigneeAgentId', query.assigneeAgentId);
    }
    if (query.q) {
      params.set('q', query.q);
    }

    const suffix = params.toString();
    return client.get<TaskListItem[]>(suffix ? `/api/v1/tasks?${suffix}` : '/api/v1/tasks');
  },
  createTask: (payload) => client.post<CreateTaskResult, CreateTaskPayload>('/api/v1/tasks', payload),
  updateTask: (payload) =>
    client.patch<UpdateTaskResult, Omit<UpdateTaskPayload, 'taskId'>>(`/api/v1/tasks/${payload.taskId}`, {
      title: payload.title,
      description: payload.description,
      projectId: payload.projectId,
      assigneeAgentId: payload.assigneeAgentId ?? null,
      createdBy: payload.createdBy,
      priority: payload.priority
    }),
  updateTaskStatus: (payload) =>
    client.post<UpdateTaskStatusResult, Omit<UpdateTaskStatusPayload, 'taskId'>>(
      `/api/v1/tasks/${payload.taskId}/status`,
      {
        status: payload.status
      }
    ),
  updateTaskPriority: (payload) =>
    client.post<UpdateTaskPriorityResult, Omit<UpdateTaskPriorityPayload, 'taskId'>>(
      `/api/v1/tasks/${payload.taskId}/priority`,
      {
        priority: payload.priority
      }
    ),
  bulkUpdateTasks: (payload) => client.post<BulkUpdateTasksResult, BulkUpdateTasksPayload>('/api/v1/tasks/bulk', payload),
  deleteTask: (payload) => client.delete<DeleteTaskResult>(`/api/v1/tasks/${payload.taskId}`),
  listTaskComments: (taskId) => client.get<TaskCommentItem[]>(`/api/v1/tasks/${taskId}/comments`),
  createTaskComment: (payload) =>
    client.post<TaskCommentItem, Omit<CreateTaskCommentPayload, 'taskId'>>(`/api/v1/tasks/${payload.taskId}/comments`, {
      body: payload.body,
      authorId: payload.authorId,
      authorType: payload.authorType,
      authorLabel: payload.authorLabel
    }),
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
  testProviderAdapter: (payload) =>
    client.post<AdapterTestResult, TestAdapterPayload>('/api/v1/provider/test', payload),
  initializeSetup: (payload) =>
    client.post<
      {
        companyName: string;
        companyDescription: string;
        executiveAgent: AgentListItem;
        defaultProject: ProjectListItem | null;
      },
      InitializeSetupPayload
    >('/api/v1/setup/initialize', payload),
  getDashboardSummary: (projectId) =>
    client.get<DashboardSummary>(
      projectId
        ? `/api/v1/dashboard/summary?projectId=${encodeURIComponent(projectId)}`
        : '/api/v1/dashboard/summary'
    ),
  listAudit: (query = {}) => {
    const params = new URLSearchParams();
    if (query.actorId) {
      params.set('actorId', query.actorId);
    }
    if (query.action) {
      params.set('action', query.action);
    }
    if (query.targetId) {
      params.set('targetId', query.targetId);
    }
    if (typeof query.limit === 'number') {
      params.set('limit', String(query.limit));
    }
    if (typeof query.offset === 'number') {
      params.set('offset', String(query.offset));
    }

    const queryString = params.toString();
    return client.get<AuditListItem[]>(`/api/v1/audit${queryString ? `?${queryString}` : ''}`);
  }
});
