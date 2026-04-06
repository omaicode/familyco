import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskService } from './task.service.js';
import type { CreateTaskInput, ListTasksInput, Task, TaskRepository, TaskStatus } from './index.js';
import { EventBus } from '../events/event-bus.js';

test('TaskService validates transitions and emits task events', async () => {
  const repository = new InMemoryTaskRepositoryStub();
  const eventBus = new EventBus();
  const service = new TaskService(repository, eventBus);

  const eventLog: Array<{ event: string; payload: unknown }> = [];
  eventBus.on('task.created', (payload) => {
    eventLog.push({ event: 'task.created', payload });
  });
  eventBus.on('task.status.updated', (payload) => {
    eventLog.push({ event: 'task.status.updated', payload });
  });

  const task = await service.createTask({
    title: 'Write report',
    description: 'Prepare status report',
    projectId: 'project-1',
    createdBy: 'agent-1'
  });

  const updated = await service.updateTaskStatus(task.id, 'in_progress');
  assert.equal(updated.status, 'in_progress');

  await assert.rejects(
    () => service.updateTaskStatus(task.id, 'done'),
    /TASK_INVALID_STATUS:in_progress->done/
  );

  assert.deepEqual(eventLog, [
    {
      event: 'task.created',
      payload: {
        taskId: task.id,
        projectId: task.projectId
      }
    },
    {
      event: 'task.status.updated',
      payload: {
        taskId: task.id,
        status: 'in_progress'
      }
    }
  ]);
});

test('TaskService can list tasks with cross-project filters', async () => {
  const repository = new InMemoryTaskRepositoryStub();
  const service = new TaskService(repository);

  const draftTask = await service.createTask({
    title: 'Draft launch brief',
    description: 'Prepare scope and guardrails',
    projectId: 'project-a',
    assigneeAgentId: 'agent-a',
    createdBy: 'agent-a'
  });

  const reviewTask = await service.createTask({
    title: 'Review launch assets',
    description: 'Check everything before publishing',
    projectId: 'project-b',
    assigneeAgentId: 'agent-b',
    createdBy: 'agent-b'
  });

  await service.updateTaskStatus(draftTask.id, 'in_progress');
  await service.updateTaskStatus(reviewTask.id, 'in_progress');
  await service.updateTaskStatus(reviewTask.id, 'review');

  const reviewOnly = await service.listTasks({ status: 'review' });
  assert.equal(reviewOnly.length, 1);
  assert.equal(reviewOnly[0]?.id, reviewTask.id);

  const byProject = await service.listTasks({ projectId: 'project-a' });
  assert.equal(byProject.length, 1);
  assert.equal(byProject[0]?.id, draftTask.id);

  const byAssignee = await service.listTasks({ assigneeAgentId: 'agent-b' });
  assert.equal(byAssignee.length, 1);
  assert.equal(byAssignee[0]?.id, reviewTask.id);

  const bySearch = await service.listTasks({ query: 'launch' });
  assert.equal(bySearch.length, 2);
});

class InMemoryTaskRepositoryStub implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const task: Task = {
      id: `task-${this.tasks.size + 1}`,
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

  async list(filters: ListTasksInput = {}): Promise<Task[]> {
    const query = filters.query?.trim().toLowerCase();

    return Array.from(this.tasks.values()).filter((task) => {
      if (filters.projectId && task.projectId !== filters.projectId) {
        return false;
      }

      if (filters.status && task.status !== filters.status) {
        return false;
      }

      if (filters.assigneeAgentId && task.assigneeAgentId !== filters.assigneeAgentId) {
        return false;
      }

      if (query) {
        return `${task.title} ${task.description}`.toLowerCase().includes(query);
      }

      return true;
    });
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return this.list({ projectId });
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updated: Task = {
      ...existing,
      status,
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    };
    this.tasks.set(id, updated);
    return updated;
  }
}
