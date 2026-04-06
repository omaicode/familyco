import type {
  BulkUpdateTasksInput,
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskStatus
} from './task.entity.js';
import type { TaskRepository } from './task.repository.js';
import type { EventBus } from '../events/event-bus.js';

const DEFAULT_PRIORITY: TaskPriority = 'medium';

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
    const task = await this.repository.create({
      ...input,
      priority: input.priority ?? DEFAULT_PRIORITY
    });
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

  async updateTaskPriority(taskId: string, priority: TaskPriority): Promise<Task> {
    const currentTask = await this.repository.findById(taskId);
    if (!currentTask) {
      throw new Error(`TASK_NOT_FOUND:${taskId}`);
    }

    const updatedTask = await this.repository.updatePriority(taskId, priority);
    this.eventBus?.emit('task.priority.updated', {
      taskId: updatedTask.id,
      priority: updatedTask.priority
    });

    return updatedTask;
  }

  async bulkUpdateTasks(input: BulkUpdateTasksInput): Promise<Task[]> {
    const taskIds = Array.from(new Set(input.taskIds));
    if (taskIds.length === 0) {
      throw new Error('TASK_BULK_EMPTY');
    }

    if (input.action === 'update_status') {
      if (!input.status) {
        throw new Error('TASK_BULK_STATUS_REQUIRED');
      }

      return Promise.all(taskIds.map(async (taskId) => this.updateTaskStatus(taskId, input.status!)));
    }

    if (!input.priority) {
      throw new Error('TASK_BULK_PRIORITY_REQUIRED');
    }

    return Promise.all(taskIds.map(async (taskId) => this.updateTaskPriority(taskId, input.priority!)));
  }
}
