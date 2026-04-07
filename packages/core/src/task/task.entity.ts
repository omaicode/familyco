export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeAgentId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  projectId: string;
  assigneeAgentId?: string | null;
  createdBy: string;
  priority?: TaskPriority;
}

export interface UpdateTaskInput {
  title: string;
  description: string;
  projectId: string;
  assigneeAgentId?: string | null;
  createdBy: string;
  priority: TaskPriority;
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
