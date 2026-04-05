import type { CreateTaskInput, Task, TaskStatus } from './task.entity.js';
import type { TaskRepository } from './task.repository.js';

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['review', 'blocked', 'cancelled'],
  review: ['done', 'in_progress', 'cancelled'],
  done: [],
  blocked: ['in_progress', 'cancelled'],
  cancelled: []
};

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  createTask(input: CreateTaskInput): Promise<Task> {
    return this.repository.create(input);
  }

  listProjectTasks(projectId: string): Promise<Task[]> {
    return this.repository.listByProject(projectId);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const currentTask = await this.repository.findById(taskId);
    if (!currentTask) {
      throw new Error(`TASK_NOT_FOUND:${taskId}`);
    }

    const allowedStatuses = ALLOWED_TRANSITIONS[currentTask.status];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`TASK_INVALID_STATUS:${currentTask.status}->${status}`);
    }

    return this.repository.updateStatus(taskId, status);
  }
}
