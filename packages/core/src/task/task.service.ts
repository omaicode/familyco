import type {
  BulkUpdateTasksInput,
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput
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

  async getTask(taskId: string): Promise<Task> {
    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND:${taskId}`);
    }

    return task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    await this.getTask(taskId);

    const title = input.title.trim();
    const description = input.description.trim();

    if (!title) {
      throw new Error('TASK_TITLE_REQUIRED');
    }

    if (!description) {
      throw new Error('TASK_DESCRIPTION_REQUIRED');
    }

    const updatedTask = await this.repository.update(taskId, {
      title,
      description,
      projectId: input.projectId,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdBy: input.createdBy,
      priority: input.priority
    });

    this.eventBus?.emit('task.updated', {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId
    });

    return updatedTask;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const currentTask = await this.getTask(taskId);

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
    await this.getTask(taskId);

    const updatedTask = await this.repository.updatePriority(taskId, priority);
    this.eventBus?.emit('task.priority.updated', {
      taskId: updatedTask.id,
      priority: updatedTask.priority
    });

    return updatedTask;
  }

  async deleteTask(taskId: string): Promise<Task> {
    await this.getTask(taskId);
    const deletedTask = await this.repository.delete(taskId);

    this.eventBus?.emit('task.deleted', {
      taskId: deletedTask.id,
      projectId: deletedTask.projectId
    });

    return deletedTask;
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
