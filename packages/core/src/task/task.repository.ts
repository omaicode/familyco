import type { CreateTaskInput, ListTasksInput, Task, TaskStatus } from './task.entity.js';

export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  list(filters?: ListTasksInput): Promise<Task[]>;
  listByProject(projectId: string): Promise<Task[]>;
  updateStatus(id: string, status: TaskStatus): Promise<Task>;
}
