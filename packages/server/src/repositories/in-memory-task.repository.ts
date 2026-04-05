import { randomUUID } from 'node:crypto';

import type { CreateTaskInput, Task, TaskRepository, TaskStatus } from '@familyco/core';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: 'pending',
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

  async listByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => task.projectId === projectId);
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
}
