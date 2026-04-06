import type { CreateTaskInput, ListTasksInput, Task, TaskStatus } from './task.entity.js';
import type { TaskRepository } from './task.repository.js';
import type { EventBus } from '../events/event-bus.js';

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['review', 'blocked', 'cancelled'],
  review: ['done', 'in_progress', 'cancelled'],
  done: [],
  blocked: ['in_progress', 'cancelled'],
  cancelled: []
};

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly eventBus?: EventBus
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const task = await this.repository.create(input);
    this.eventBus?.emit('task.created', {
      taskId: task.id,
      projectId: task.projectId
    });
    return task;
  }

  listTasks(filters: ListTasksInput = {}): Promise<Task[]> {
    return this.repository.list(filters);
  }

  listProjectTasks(projectId: string): Promise<Task[]> {
    return this.listTasks({ projectId });
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

    const updatedTask = await this.repository.updateStatus(taskId, status);
    this.eventBus?.emit('task.status.updated', {
      taskId: updatedTask.id,
      status: updatedTask.status
    });

    return updatedTask;
  }
}
