import type {
  BulkUpdateTasksInput,
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskReadinessEvaluation,
  TaskStatusUpdateContext,
  TaskStatus,
  TaskWithReadiness,
  UpdateTaskInput
} from './task.entity.js';
import type { TaskRepository } from './task.repository.js';
import type { EventBus } from '../events/event-bus.js';
import {
  evaluateTaskReadiness,
  normalizeTaskDependencyIds,
  normalizeTaskReadinessRules
} from './task-readiness.js';

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
    const title = input.title.trim();
    const description = input.description.trim();
    const projectId = input.projectId.trim();
    const assigneeAgentId = input.assigneeAgentId?.trim();

    if (!title) {
      throw new Error('TASK_TITLE_REQUIRED');
    }

    if (!description) {
      throw new Error('TASK_DESCRIPTION_REQUIRED');
    }

    if (!projectId) {
      throw new Error('TASK_PROJECT_REQUIRED');
    }

    if (!assigneeAgentId) {
      throw new Error('TASK_ASSIGNEE_REQUIRED');
    }

    const task = await this.repository.create({
      ...input,
      title,
      description,
      projectId,
      assigneeAgentId,
      dependsOnTaskIds: normalizeTaskDependencyIds(input.dependsOnTaskIds),
      readinessRules: normalizeTaskReadinessRules(input.readinessRules),
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

  async countTasks(filters: CountTasksInput = {}): Promise<number> {
    if (hasCountRepository(this.repository)) {
      return this.repository.count(filters);
    }

    const { excludeStatuses = [], ...listFilters } = filters;
    const tasks = await this.repository.list(listFilters);

    if (excludeStatuses.length === 0) {
      return tasks.length;
    }

    const excluded = new Set<TaskStatus>(excludeStatuses);
    return tasks.filter((task) => !excluded.has(task.status)).length;
  }

  async listTasksWithReadiness(filters: ListTasksInput = {}): Promise<TaskWithReadiness[]> {
    const [tasks, relatedTasks] = await Promise.all([
      this.repository.list(filters),
      this.repository.list()
    ]);

    return tasks.map((task) => ({
      ...task,
      readiness: evaluateTaskReadiness({ task, relatedTasks })
    }));
  }

  async getTask(taskId: string): Promise<Task> {
    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND:${taskId}`);
    }

    return task;
  }

  async getTaskWithReadiness(taskId: string): Promise<TaskWithReadiness> {
    const [task, relatedTasks] = await Promise.all([
      this.getTask(taskId),
      this.repository.list()
    ]);

    return {
      ...task,
      readiness: evaluateTaskReadiness({ task, relatedTasks })
    };
  }

  async evaluateTaskReadiness(taskId: string): Promise<TaskReadinessEvaluation> {
    const task = await this.getTask(taskId);
    const relatedTasks = await this.repository.list();
    return evaluateTaskReadiness({ task, relatedTasks });
  }

  async evaluateTaskReadinessForTask(task: Task, relatedTasks?: Task[]): Promise<TaskReadinessEvaluation> {
    const related = relatedTasks ?? (await this.repository.list());
    return evaluateTaskReadiness({ task, relatedTasks: related });
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const currentTask = await this.getTask(taskId);

    const title = input.title.trim();
    const description = input.description.trim();
    const projectId = input.projectId.trim();
    const assigneeAgentId = input.assigneeAgentId?.trim() ?? currentTask.assigneeAgentId?.trim();

    if (!title) {
      throw new Error('TASK_TITLE_REQUIRED');
    }

    if (!description) {
      throw new Error('TASK_DESCRIPTION_REQUIRED');
    }

    if (!projectId) {
      throw new Error('TASK_PROJECT_REQUIRED');
    }

    if (!assigneeAgentId) {
      throw new Error('TASK_ASSIGNEE_REQUIRED');
    }

    const dependsOnTaskIds = normalizeTaskDependencyIds(input.dependsOnTaskIds ?? currentTask.dependsOnTaskIds);
    const readinessRules = normalizeTaskReadinessRules(input.readinessRules ?? currentTask.readinessRules);

    if (dependsOnTaskIds.includes(taskId)) {
      throw new Error(`TASK_DEPENDS_ON_SELF:${taskId}`);
    }

    if (readinessRules.some((rule) => rule.taskId === taskId)) {
      throw new Error(`TASK_READINESS_RULE_SELF_REFERENCE:${taskId}`);
    }

    const updatedTask = await this.repository.update(taskId, {
      title,
      description,
      projectId,
      assigneeAgentId,
      createdBy: input.createdBy,
      priority: input.priority,
      dependsOnTaskIds,
      readinessRules
    });

    this.eventBus?.emit('task.updated', {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId
    });

    return updatedTask;
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    context?: TaskStatusUpdateContext
  ): Promise<Task> {
    const currentTask = await this.getTask(taskId);

    // Idempotent: already in the requested status — return as-is without error.
    if (currentTask.status === status) {
      return currentTask;
    }

    const allowedStatuses = ALLOWED_TRANSITIONS[currentTask.status];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`TASK_INVALID_STATUS:${currentTask.status}->${status}`);
    }

    const updatedTask = await this.repository.updateStatus(taskId, status);
    this.eventBus?.emit('task.status.updated', {
      taskId: updatedTask.id,
      status: updatedTask.status,
      ...(context?.source ? { source: context.source } : {}),
      ...(context?.actorId ? { actorId: context.actorId } : {})
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

export interface CountTasksInput extends ListTasksInput {
  excludeStatuses?: TaskStatus[];
}

interface CountCapableTaskRepository extends TaskRepository {
  count(filters?: CountTasksInput): Promise<number>;
}

function hasCountRepository(repository: TaskRepository): repository is CountCapableTaskRepository {
  return typeof (repository as { count?: unknown }).count === 'function';
}
