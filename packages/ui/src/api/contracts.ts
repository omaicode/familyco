import type { UIApiClient } from './client.js';

export interface AgentListItem {
  id: string;
  name: string;
  role: string;
  level: 'L0' | 'L1' | 'L2';
  department: string;
  status: 'active' | 'idle' | 'running' | 'error' | 'paused' | 'terminated' | 'archived';
  parentAgentId: string | null;
  aiAdapterId: string | null;
  aiModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatMessage {
  id: string;
  sessionId: string;
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
    attachments?: ChatAttachmentItem[];
    editedFromMessageId?: string;
    supersedesMessageId?: string;
    supersededByMessageId?: string;
    [key: string]: unknown;
  };
}

export interface AgentChatSession {
  id: string;
  agentId: string;
  founderId: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ChatAttachmentKind = 'file' | 'audio';

export interface ChatAttachmentReference {
  id: string;
}

export interface ChatAttachmentItem {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  mediaType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
  transcript?: string;
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
  dependsOnTaskIds: string[];
  readinessRules: TaskReadinessRule[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatusReadinessRule {
  type: 'task_status';
  taskId: string;
  status: TaskListItem['status'];
  description?: string;
}

export type TaskReadinessRule = TaskStatusReadinessRule;

export interface ApprovalListItem {
  id: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  taskId?: string;
  taskTitle?: string;
  requestSummary?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
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

export interface DashboardSidebarCounts {
  agents: number;
  projects: number;
  tasks: number;
  pendingApprovals: number;
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
export type ResumeAgentResult = AgentListItem | AgentActionApprovalResponse;
export type ArchiveAgentResult = AgentListItem | AgentActionApprovalResponse;

export interface DeleteAgentPayload {
  agentId: string;
}

export interface DeleteAgentSuccessResponse {
  deletedAgentIds: string[];
  deletedProjectIds: string[];
  deletedTaskIds: string[];
  deletedApprovalIds: string[];
  fallbackAgentId: string;
  reassignedTaskCount: number;
  reassignedProjectCount: number;
  reassignedChildAgentCount: number;
}

export type DeleteAgentResult = DeleteAgentSuccessResponse | AgentActionApprovalResponse;

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
  dependsOnTaskIds?: string[];
  readinessRules?: TaskReadinessRule[];
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
  dependsOnTaskIds?: string[];
  readinessRules?: TaskReadinessRule[];
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

export type TaskActivityKind =
  | 'comment'
  | 'session.checkpoint'
  | 'approval.created'
  | 'approval.decided'
  | 'status.changed'
  | 'assigned';

export interface TaskActivityItem {
  id: string;
  kind: TaskActivityKind;
  taskId: string;
  actorId: string;
  actorLabel: string;
  /** Human-readable summary of this activity entry */
  summary: string;
  /** Full body if kind === 'comment' */
  body?: string;
  /** Checkpoint index if kind === 'session.checkpoint' */
  checkpointIndex?: number;
  /** Session status if kind === 'session.checkpoint' */
  sessionStatus?: string;
  /** Approval decision if kind === 'approval.decided' */
  approvalDecision?: 'approved' | 'rejected';
  /** Approval request id (if available) for approval-related entries */
  approvalId?: string;
  /** Requested action name for approval-created entries */
  approvalAction?: string;
  /** Founder/decision note for approval-decided entries */
  decisionNote?: string;
  /** Checkpoint tool names used in the last run step */
  toolsUsed?: string[];
  /** Optional detailed summary generated by server audit payload */
  detailSummary?: string;
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

export interface ResumeAgentPayload {
  agentId: string;
}

export interface ArchiveAgentPayload {
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
    sessionId?: string;
    projectId?: string;
    taskId?: string;
    toolCall?: ChatToolRequest;
    toolCalls?: ChatToolRequest[];
    attachments?: ChatAttachmentReference[];
    editedFromMessageId?: string;
    supersedesMessageId?: string;
  };
}

export interface UploadAgentChatAttachmentPayload {
  agentId: string;
  file: Blob;
  filename: string;
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
  session: AgentChatSession;
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

export interface RespondInboxMessagePayload {
  id: string;
  responseText: string;
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

export interface SlashCommandItem {
  command: string;
  label: string;
  description: string;
  insertValue: string;
  levels: string[];
}

export interface GetAgentChatQuery {
  sessionId?: string;
  limit?: number;
  before?: string;
}

export interface ListAgentChatSessionsQuery {
  limit?: number;
}

export interface CreateAgentChatSessionPayload {
  agentId: string;
  title?: string;
}

export interface BudgetReportTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export interface BudgetReportByAdapter {
  adapterId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export interface BudgetReportDailyEntry {
  date: string;
  totalTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export interface BudgetReportBudgetStatus {
  monthlyLimitUSD: number | null;
  alertThresholdPercent: number;
  enforceMode: 'block' | 'warn' | 'off';
  usedPercent: number | null;
}

export interface BudgetReport {
  period: { from: string; to: string };
  totals: BudgetReportTotals;
  budget: BudgetReportBudgetStatus;
  byAdapter: BudgetReportByAdapter[];
  dailyBreakdown: BudgetReportDailyEntry[];
  byModel: Array<{
    model: string;
    provider: string;
    totalTokens: number;
    estimatedCostUSD: number;
    requestCount: number;
  }>;
  byRun: Array<{
    runId: string;
    totalTokens: number;
    estimatedCostUSD: number;
    requestCount: number;
  }>;
  byWeek: Array<{
    bucket: string;
    totalTokens: number;
    estimatedCostUSD: number;
    requestCount: number;
  }>;
  byMonth: Array<{
    bucket: string;
    totalTokens: number;
    estimatedCostUSD: number;
    requestCount: number;
  }>;
  topCostlyAgents: Array<{
    entityId: string;
    totalTokens: number;
    estimatedCostUSD: number;
    requestCount: number;
  }>;
  topCostlyProjects: Array<{
    entityId: string;
    totalTokens: number;
    estimatedCostUSD: number;
    requestCount: number;
  }>;
}

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  version: string | null;
  tags: string[];
  path: string;
  source: 'local';
  enabled: boolean;
}

export interface InvalidSkillItem {
  id: string;
  path: string;
  reason: string;
}

export interface SkillsListResponse {
  items: SkillListItem[];
  invalidSkills: InvalidSkillItem[];
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

export type PluginCapabilityKind =
  | 'tool'
  | 'skill'
  | 'model-provider'
  | 'web-fetch'
  | 'web-search';

export interface PluginCapabilityDescriptor {
  kind: PluginCapabilityKind;
  name: string;
  description: string;
  adapterId?: string;
}

export type PluginState = 'discovered' | 'enabled' | 'disabled' | 'error';
export type PluginApprovalMode = 'auto' | 'suggest-only' | 'require-review';

export interface PluginListItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string | null;
  tags: string[];
  path: string;
  entry: string;
  capabilities: PluginCapabilityDescriptor[];
  state: PluginState;
  approvalMode: PluginApprovalMode;
  checksum: string;
  errorMessage: string | null;
  discoveredAt: string;
  updatedAt: string;
  /** True when this is a built-in default plugin that is always active and cannot be disabled. */
  isDefault?: boolean;
}

export interface PluginsListResponse {
  items: PluginListItem[];
}

export interface PluginDiscoverResult {
  added: number;
  updated: number;
  unchanged: number;
  errors: Array<{ path: string; reason: string }>;
}

export interface FamilyCoApiContracts {

  listAgents: () => Promise<AgentListItem[]>;
  listAgentChildren: (agentId: string) => Promise<AgentListItem[]>;
  getAgentPath: (agentId: string) => Promise<AgentListItem[]>;
  listAgentChatSessions: (agentId: string, query?: ListAgentChatSessionsQuery) => Promise<AgentChatSession[]>;
  createAgentChatSession: (payload: CreateAgentChatSessionPayload) => Promise<AgentChatSession>;
  getAgentChat: (agentId: string, query?: GetAgentChatQuery) => Promise<AgentChatMessage[]>;
  getAgentSlashCommands: (agentId: string) => Promise<SlashCommandItem[]>;
  sendAgentChat: (payload: SendAgentChatPayload) => Promise<SendAgentChatResult>;
  uploadAgentChatAttachment: (payload: UploadAgentChatAttachmentPayload) => Promise<ChatAttachmentItem>;
  createAgent: (payload: CreateAgentPayload) => Promise<CreateAgentResult>;
  pauseAgent: (payload: PauseAgentPayload) => Promise<PauseAgentResult>;
  resumeAgent: (payload: ResumeAgentPayload) => Promise<ResumeAgentResult>;
  archiveAgent: (payload: ArchiveAgentPayload) => Promise<ArchiveAgentResult>;
  deleteAgent: (payload: DeleteAgentPayload) => Promise<DeleteAgentResult>;
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
  listTaskActivity: (taskId: string) => Promise<TaskActivityItem[]>;
  listApprovals: () => Promise<ApprovalListItem[]>;
  decideApproval: (payload: DecideApprovalPayload) => Promise<ApprovalListItem>;
  listInbox: (recipientId: string) => Promise<InboxMessageItem[]>;
  readInboxMessage: (payload: ReadInboxMessagePayload) => Promise<InboxMessageItem>;
  archiveInboxMessage: (payload: ArchiveInboxMessagePayload) => Promise<InboxMessageItem>;
  requestInboxChange: (payload: RespondInboxMessagePayload) => Promise<InboxMessageItem>;
  answerInboxClarification: (payload: RespondInboxMessagePayload) => Promise<InboxMessageItem>;
  listSettings: () => Promise<SettingItem[]>;
  upsertSetting: (payload: UpsertSettingPayload) => Promise<SettingItem>;
  triggerHeartbeat: () => Promise<{ triggered: boolean; message: string }>;
  testProviderAdapter: (payload: TestAdapterPayload) => Promise<AdapterTestResult>;
  initializeSetup: (payload: InitializeSetupPayload) => Promise<{
    companyName: string;
    companyDescription: string;
    executiveAgent: AgentListItem;
    defaultProject: ProjectListItem | null;
  }>;
  getDashboardSummary: (projectId?: string) => Promise<DashboardSummary>;
  getDashboardSidebarCounts: () => Promise<DashboardSidebarCounts>;
  listAudit: (query?: ListAuditPayload) => Promise<AuditListItem[]>;
  getBudgetReport: () => Promise<BudgetReport>;
  listSkills: () => Promise<SkillsListResponse>;
  getSkill: (skillId: string) => Promise<SkillListItem>;
  enableSkill: (skillId: string) => Promise<SkillListItem>;
  disableSkill: (skillId: string) => Promise<SkillListItem>;
  listPlugins: () => Promise<PluginsListResponse>;
  getPlugin: (pluginId: string) => Promise<PluginListItem>;
  discoverPlugins: () => Promise<PluginDiscoverResult>;
  enablePlugin: (pluginId: string) => Promise<PluginListItem>;
  disablePlugin: (pluginId: string) => Promise<PluginListItem>;
  updatePluginApproval: (pluginId: string, approvalMode: PluginApprovalMode) => Promise<PluginListItem>;
}

export const createFamilyCoApiContracts = (client: UIApiClient): FamilyCoApiContracts => ({
  listAgents: () => client.get<AgentListItem[]>('/api/v1/agents'),
  listAgentChildren: (agentId) => client.get<AgentListItem[]>(`/api/v1/agents/${agentId}/children`),
  getAgentPath: (agentId) => client.get<AgentListItem[]>(`/api/v1/agents/${agentId}/path`),
  listAgentChatSessions: (agentId, query = {}) => {
    const params = new URLSearchParams();
    if (typeof query.limit === 'number') {
      params.set('limit', String(query.limit));
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return client.get<AgentChatSession[]>(`/api/v1/agents/${agentId}/chat/sessions${suffix}`);
  },
  createAgentChatSession: (payload) =>
    client.post<AgentChatSession, { title?: string }>(`/api/v1/agents/${payload.agentId}/chat/sessions`, {
      ...(payload.title ? { title: payload.title } : {})
    }),
  getAgentChat: (agentId, query = {}) => {
    const params = new URLSearchParams();
    if (query.sessionId) {
      params.set('sessionId', query.sessionId);
    }
    if (typeof query.limit === 'number') {
      params.set('limit', String(query.limit));
    }
    if (query.before) {
      params.set('before', query.before);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return client.get<AgentChatMessage[]>(`/api/v1/agents/${agentId}/chat${suffix}`);
  },
  getAgentSlashCommands: (agentId) =>
    client.get<SlashCommandItem[]>(`/api/v1/agents/${agentId}/slash-commands`),
  sendAgentChat: (payload) =>
    client.post<SendAgentChatResult, Omit<SendAgentChatPayload, 'agentId'>>(
      `/api/v1/agents/${payload.agentId}/chat`,
      {
        message: payload.message,
        meta: payload.meta
      }
    ),
  uploadAgentChatAttachment: async (payload) => {
    const formData = new FormData();
    formData.append('file', payload.file, payload.filename);
    return client.post<ChatAttachmentItem>(`/api/v1/agents/${payload.agentId}/chat/attachments`, formData);
  },
  createAgent: (payload) => client.post<CreateAgentResult, CreateAgentPayload>('/api/v1/agents', payload),
  pauseAgent: (payload) => client.post<PauseAgentResult>(`/api/v1/agents/${payload.agentId}/pause`),
  resumeAgent: (payload) => client.post<ResumeAgentResult>(`/api/v1/agents/${payload.agentId}/resume`),
  archiveAgent: (payload) => client.post<ArchiveAgentResult>(`/api/v1/agents/${payload.agentId}/archive`),
  deleteAgent: (payload) => client.delete<DeleteAgentResult>(`/api/v1/agents/${payload.agentId}`),
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
  listTaskActivity: (taskId) => client.get<TaskActivityItem[]>(`/api/v1/tasks/${taskId}/activity`),
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
  requestInboxChange: (payload) =>
    client.post<InboxMessageItem, { responseText: string }>(`/api/v1/inbox/${payload.id}/request-change`, {
      responseText: payload.responseText
    }),
  answerInboxClarification: (payload) =>
    client.post<InboxMessageItem, { responseText: string }>(`/api/v1/inbox/${payload.id}/clarification`, {
      responseText: payload.responseText
    }),
  listSettings: () => client.get<SettingItem[]>('/api/v1/settings'),
  upsertSetting: (payload) => client.post<SettingItem, UpsertSettingPayload>('/api/v1/settings', payload),
  triggerHeartbeat: () => client.post<{ triggered: boolean; message: string }>('/api/v1/engine/heartbeat/trigger'),
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
  getDashboardSidebarCounts: () => client.get<DashboardSidebarCounts>('/api/v1/dashboard/sidebar-counts'),
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
  },
  getBudgetReport: () => client.get<BudgetReport>('/api/v1/budget/report'),
  listSkills: () => client.get<SkillsListResponse>('/api/v1/skills'),
  getSkill: (skillId) => client.get<SkillListItem>(`/api/v1/skills/${skillId}`),
  enableSkill: (skillId) => client.post<SkillListItem>(`/api/v1/skills/${skillId}/enable`),
  disableSkill: (skillId) => client.post<SkillListItem>(`/api/v1/skills/${skillId}/disable`),
  listPlugins: () => client.get<PluginsListResponse>('/api/v1/plugins'),
  getPlugin: (pluginId) => client.get<PluginListItem>(`/api/v1/plugins/${pluginId}`),
  discoverPlugins: () => client.post<PluginDiscoverResult>('/api/v1/plugins/discover'),
  enablePlugin: (pluginId) => client.post<PluginListItem>(`/api/v1/plugins/${pluginId}/enable`),
  disablePlugin: (pluginId) => client.post<PluginListItem>(`/api/v1/plugins/${pluginId}/disable`),
  updatePluginApproval: (pluginId, approvalMode) =>
    client.patch<PluginListItem>(`/api/v1/plugins/${pluginId}/approval`, { approvalMode })
});
