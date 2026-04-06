import type { CreateTaskInput, ListTasksInput, Task, TaskRepository, TaskStatus } from '@familyco/core';
import type { PrismaClient } from '@prisma/client';

const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'in_progress',
  'review',
  'done',
  'blocked',
  'cancelled'
];

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: 'pending',
        projectId: input.projectId,
        assigneeAgentId: input.assigneeAgentId ?? null,
        createdBy: input.createdBy
      }
    });

    return toTask(task);
  }

  async findById(id: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id }
    });

    return task ? toTask(task) : null;
  }

  async list(filters: ListTasksInput = {}): Promise<Task[]> {
    const query = filters.query?.trim();
    const tasks = await this.prisma.task.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.assigneeAgentId ? { assigneeAgentId: filters.assigneeAgentId } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { description: { contains: query } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: 'desc' }
    });

    return tasks.map(toTask);
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return this.list({ projectId });
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status
      }
    });

    return toTask(task);
  }
}

function toTask(task: {
  id: string;
  title: string;
  description: string;
  status: string;
  projectId: string;
  assigneeAgentId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Task {
  if (!TASK_STATUSES.includes(task.status as TaskStatus)) {
    throw new Error(`TASK_STATUS_INVALID:${task.status}`);
  }

  return {
    ...task,
    status: task.status as TaskStatus
  };
}
