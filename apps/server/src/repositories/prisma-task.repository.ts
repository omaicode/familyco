import {
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskReadinessRule,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput,
  normalizeTaskDependencyIds,
  normalizeTaskReadinessRules
} from '@familyco/core';
import type { PrismaClient } from '@familyco/db';

const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'in_progress',
  'review',
  'done',
  'blocked',
  'cancelled'
];

const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: 'pending',
        priority: input.priority ?? 'medium',
        projectId: input.projectId,
        assigneeAgentId: input.assigneeAgentId ?? null,
        createdBy: input.createdBy,
        dependsOnTaskIds: normalizeTaskDependencyIds(input.dependsOnTaskIds),
        readinessRules: normalizeTaskReadinessRules(input.readinessRules)
      } as never
    });

    return toTask(task as unknown as Parameters<typeof toTask>[0]);
  }

  async findById(id: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id }
    });

    return task ? toTask(task as unknown as Parameters<typeof toTask>[0]) : null;
  }

  async list(filters: ListTasksInput = {}): Promise<Task[]> {
    const query = filters.query?.trim();
    const tasks = await this.prisma.task.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.assigneeAgentId ? { assigneeAgentId: filters.assigneeAgentId } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { description: { contains: query } }
              ]
            }
          : {})
      } as never,
      orderBy: { updatedAt: 'desc' }
    });

    return tasks.map((task) => toTask(task as unknown as Parameters<typeof toTask>[0]));
  }

  async count(filters: ListTasksInput & { excludeStatuses?: TaskStatus[] } = {}): Promise<number> {
    const query = filters.query?.trim();

    if (filters.status && filters.excludeStatuses?.includes(filters.status)) {
      return 0;
    }

    return this.prisma.task.count({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(!filters.status && filters.excludeStatuses?.length
          ? {
              status: {
                notIn: filters.excludeStatuses
              }
            }
          : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.assigneeAgentId ? { assigneeAgentId: filters.assigneeAgentId } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { description: { contains: query } }
              ]
            }
          : {})
      } as never
    });
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return this.list({ projectId });
  }

  async reassignAgent(previousAgentId: string, nextAgentId: string): Promise<Task[]> {
    const affectedTasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { assigneeAgentId: previousAgentId },
          { createdBy: previousAgentId }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (affectedTasks.length === 0) {
      return [];
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { assigneeAgentId: previousAgentId },
        data: {
          assigneeAgentId: nextAgentId
        } as never
      }),
      this.prisma.task.updateMany({
        where: { createdBy: previousAgentId },
        data: {
          createdBy: nextAgentId
        } as never
      })
    ]);

    const updatedTasks = await this.prisma.task.findMany({
      where: {
        id: {
          in: affectedTasks.map((task) => task.id)
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return updatedTasks.map((task) => toTask(task as unknown as Parameters<typeof toTask>[0]));
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        projectId: input.projectId,
        assigneeAgentId: input.assigneeAgentId ?? null,
        createdBy: input.createdBy,
        priority: input.priority,
        dependsOnTaskIds: normalizeTaskDependencyIds(input.dependsOnTaskIds),
        readinessRules: normalizeTaskReadinessRules(input.readinessRules)
      } as never
    });

    return toTask(task as unknown as Parameters<typeof toTask>[0]);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status
      }
    });

    return toTask(task as unknown as Parameters<typeof toTask>[0]);
  }

  async updatePriority(id: string, priority: TaskPriority): Promise<Task> {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        priority
      } as never
    });

    return toTask(task as unknown as Parameters<typeof toTask>[0]);
  }

  async delete(id: string): Promise<Task> {
    const task = await this.prisma.task.delete({
      where: { id }
    });

    return toTask(task as unknown as Parameters<typeof toTask>[0]);
  }
}

function toTask(task: {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: string;
  assigneeAgentId: string | null;
  createdBy: string;
  dependsOnTaskIds: unknown;
  readinessRules: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Task {
  if (!TASK_STATUSES.includes(task.status as TaskStatus)) {
    throw new Error(`TASK_STATUS_INVALID:${task.status}`);
  }

  if (!TASK_PRIORITIES.includes(task.priority as TaskPriority)) {
    throw new Error(`TASK_PRIORITY_INVALID:${task.priority}`);
  }

  return {
    ...task,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    dependsOnTaskIds: parseDependencyIds(task.dependsOnTaskIds),
    readinessRules: parseReadinessRules(task.readinessRules)
  };
}

function parseDependencyIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeTaskDependencyIds(value.filter((item): item is string => typeof item === 'string'));
}

function parseReadinessRules(value: unknown): TaskReadinessRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rawRules: TaskReadinessRule[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    if (record.type !== 'task_status' || typeof record.taskId !== 'string') {
      continue;
    }

    rawRules.push({
      type: 'task_status',
      taskId: record.taskId,
      status: record.status as TaskStatus,
      ...(typeof record.description === 'string' ? { description: record.description } : {})
    });
  }

  return normalizeTaskReadinessRules(rawRules);
}
