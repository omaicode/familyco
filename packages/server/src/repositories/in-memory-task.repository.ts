import { randomUUID } from 'node:crypto';

import type {
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskRepository,
  TaskStatus
} from '@familyco/core';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: 'pending',
      priority: input.priority ?? 'medium',
      projectId: input.projectId,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(filters: ListTasksInput = {}): Promise<Task[]> {
    const query = filters.query?.trim().toLowerCase();

    return Array.from(this.tasks.values())
      .filter((task) => {
        if (filters.projectId && task.projectId !== filters.projectId) {
          return false;
        }

        if (filters.status && task.status !== filters.status) {
          return false;
        }

        if (filters.priority && task.priority !== filters.priority) {
          return false;
        }

        if (filters.assigneeAgentId && task.assigneeAgentId !== filters.assigneeAgentId) {
          return false;
        }

        if (query) {
          const haystack = `${task.title} ${task.description}`.toLowerCase();
          return haystack.includes(query);
        }

        return true;
      })
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return this.list({ projectId });
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updatedTask: Task = {
      ...task,
      status,
      updatedAt: new Date()
    };

    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async updatePriority(id: string, priority: TaskPriority): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updatedTask: Task = {
      ...task,
      priority,
      updatedAt: new Date()
    };

    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
}
