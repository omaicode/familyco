import type {
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput
} from './task.entity.js';

export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  list(filters?: ListTasksInput): Promise<Task[]>;
  listByProject(projectId: string): Promise<Task[]>;
  reassignAgent(previousAgentId: string, nextAgentId: string): Promise<Task[]>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
  updateStatus(id: string, status: TaskStatus): Promise<Task>;
  updatePriority(id: string, priority: TaskPriority): Promise<Task>;
  delete(id: string): Promise<Task>;
}
