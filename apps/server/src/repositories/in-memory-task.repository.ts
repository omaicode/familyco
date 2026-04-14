import { randomUUID } from 'node:crypto';

import type {
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskReadinessRule,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput
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
      dependsOnTaskIds: input.dependsOnTaskIds ?? [],
      readinessRules: cloneReadinessRules(input.readinessRules ?? []),
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

  async reassignAgent(previousAgentId: string, nextAgentId: string): Promise<Task[]> {
    const updatedTasks: Task[] = [];

    for (const task of this.tasks.values()) {
      if (task.assigneeAgentId !== previousAgentId && task.createdBy !== previousAgentId) {
        continue;
      }

      const updatedTask: Task = {
        ...task,
        assigneeAgentId: task.assigneeAgentId === previousAgentId ? nextAgentId : task.assigneeAgentId,
        createdBy: task.createdBy === previousAgentId ? nextAgentId : task.createdBy,
        updatedAt: new Date()
      };

      this.tasks.set(task.id, updatedTask);
      updatedTasks.push(updatedTask);
    }

    return updatedTasks;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updatedTask: Task = {
      ...task,
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdBy: input.createdBy,
      priority: input.priority,
      dependsOnTaskIds: input.dependsOnTaskIds ?? task.dependsOnTaskIds,
      readinessRules: cloneReadinessRules(input.readinessRules ?? task.readinessRules),
      updatedAt: new Date()
    };

    this.tasks.set(id, updatedTask);
    return updatedTask;
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

  async delete(id: string): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    this.tasks.delete(id);
    return task;
  }
}

function cloneReadinessRules(rules: TaskReadinessRule[]): TaskReadinessRule[] {
  return rules.map((rule) => ({ ...rule }));
}
