export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
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
}
