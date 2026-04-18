export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskStatusReadinessRule {
  type: 'task_status';
  taskId: string;
  status: TaskStatus;
  description?: string;
}

export type TaskReadinessRule = TaskStatusReadinessRule;

export interface TaskReadinessBlocker {
  code:
    | 'DEPENDENCY_CYCLE'
    | 'DEPENDENCY_MISSING'
    | 'DEPENDENCY_NOT_DONE'
    | 'RULE_CYCLE'
    | 'RULE_TASK_MISSING'
    | 'RULE_STATUS_MISMATCH'
    | 'RULE_UNSUPPORTED';
  message: string;
  taskId?: string;
  ruleType?: string;
  currentStatus?: TaskStatus;
  requiredStatus?: TaskStatus;
}

export interface TaskReadinessEvaluation {
  ready: boolean;
  blockers: TaskReadinessBlocker[];
  checkedDependencyCount: number;
  checkedRuleCount: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeAgentId: string | null;
  createdBy: string;
  dependsOnTaskIds: string[];
  readinessRules: TaskReadinessRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskWithReadiness extends Task {
  readiness: TaskReadinessEvaluation;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId: string;
  assigneeAgentId?: string | null;
  createdBy: string;
  priority?: TaskPriority;
  dependsOnTaskIds?: string[];
  readinessRules?: TaskReadinessRule[];
}

export interface UpdateTaskInput {
  title: string;
  description: string;
  projectId: string;
  assigneeAgentId?: string | null;
  createdBy: string;
  priority: TaskPriority;
  dependsOnTaskIds?: string[];
  readinessRules?: TaskReadinessRule[];
}

export interface ListTasksInput {
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeAgentId?: string;
  query?: string;
}

export interface BulkUpdateTasksInput {
  taskIds: string[];
  action: 'update_status' | 'update_priority';
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface TaskStatusUpdateContext {
  source?: 'agent' | 'human' | 'system';
  actorId?: string;
}
