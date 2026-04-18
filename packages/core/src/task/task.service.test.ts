import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskService } from './task.service.js';
import type {
  CreateTaskInput,
  ListTasksInput,
  Task,
  TaskPriority,
  TaskReadinessRule,
  TaskRepository,
  TaskStatus
} from './index.js';
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
    assigneeAgentId: 'agent-1',
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
    createdBy: 'agent-a',
    priority: 'medium'
  });

  const reviewTask = await service.createTask({
    title: 'Review launch assets',
    description: 'Check everything before publishing',
    projectId: 'project-b',
    assigneeAgentId: 'agent-b',
    createdBy: 'agent-b',
    priority: 'high'
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

  const byPriority = await service.listTasks({ priority: 'high' });
  assert.equal(byPriority.length, 1);
  assert.equal(byPriority[0]?.id, reviewTask.id);

  const bySearch = await service.listTasks({ query: 'launch' });
  assert.equal(bySearch.length, 2);
});

test('TaskService updates priority and supports bulk status changes', async () => {
  const repository = new InMemoryTaskRepositoryStub();
  const service = new TaskService(repository);

  const firstTask = await service.createTask({
    title: 'Prioritize roadmap',
    description: 'Focus the next sprint',
    projectId: 'project-1',
    assigneeAgentId: 'agent-1',
    createdBy: 'agent-1'
  });

  const secondTask = await service.createTask({
    title: 'Prepare founder review',
    description: 'Collect the changes for sign-off',
    projectId: 'project-1',
    assigneeAgentId: 'agent-1',
    createdBy: 'agent-1'
  });

  const reprioritized = await service.updateTaskPriority(firstTask.id, 'urgent');
  assert.equal(reprioritized.priority, 'urgent');

  await service.bulkUpdateTasks({
    taskIds: [firstTask.id, secondTask.id],
    action: 'update_status',
    status: 'in_progress'
  });

  const refreshed = await service.listTasks({ projectId: 'project-1' });
  assert.deepEqual(
    refreshed.map((task) => task.status),
    ['in_progress', 'in_progress']
  );
});

test('TaskService updates task details and deletes tasks safely', async () => {
  const repository = new InMemoryTaskRepositoryStub();
  const service = new TaskService(repository);

  const task = await service.createTask({
    title: 'Draft weekly review',
    description: 'Collect the open issues for the founder sync',
    projectId: 'project-1',
    createdBy: 'agent-1',
    assigneeAgentId: 'agent-1'
  });

  const updated = await service.updateTask(task.id, {
    title: 'Run weekly review',
    description: 'Summarize blockers and next actions for the founder sync',
    projectId: 'project-2',
    createdBy: 'agent-2',
    assigneeAgentId: 'agent-2',
    priority: 'high',
    dependsOnTaskIds: ['task-999'],
    readinessRules: [
      { type: 'task_status', taskId: 'task-3', status: 'done', description: 'Need final sign-off task done.' }
    ]
  });

  assert.equal(updated.title, 'Run weekly review');
  assert.equal(updated.projectId, 'project-2');
  assert.equal(updated.createdBy, 'agent-2');
  assert.equal(updated.assigneeAgentId, 'agent-2');
  assert.equal(updated.priority, 'high');
  assert.deepEqual(updated.dependsOnTaskIds, ['task-999']);
  assert.deepEqual(updated.readinessRules, [
    { type: 'task_status', taskId: 'task-3', status: 'done', description: 'Need final sign-off task done.' }
  ]);

  const deleted = await service.deleteTask(task.id);
  assert.equal(deleted.id, task.id);

  await assert.rejects(() => service.deleteTask(task.id), /TASK_NOT_FOUND/);
  const remaining = await service.listTasks();
  assert.equal(remaining.length, 0);
});

test('TaskService exposes readiness evaluation and readiness-enriched task views', async () => {
  const repository = new InMemoryTaskRepositoryStub();
  const service = new TaskService(repository);

  const prerequisite = await service.createTask({
    title: 'Prepare dependency',
    description: 'Finish setup first',
    projectId: 'project-1',
    assigneeAgentId: 'agent-1',
    createdBy: 'agent-1'
  });

  const gated = await service.createTask({
    title: 'Run dependent work',
    description: 'Can only start after prerequisite is done',
    projectId: 'project-1',
    assigneeAgentId: 'agent-1',
    createdBy: 'agent-1',
    dependsOnTaskIds: [prerequisite.id],
    readinessRules: [
      { type: 'task_status', taskId: prerequisite.id, status: 'done', description: 'Dependency must be completed.' }
    ]
  });

  const initialReadiness = await service.evaluateTaskReadiness(gated.id);
  assert.equal(initialReadiness.ready, false);
  assert.equal(initialReadiness.blockers.length, 2);

  await service.updateTaskStatus(prerequisite.id, 'in_progress');
  await service.updateTaskStatus(prerequisite.id, 'review');
  await service.updateTaskStatus(prerequisite.id, 'done');

  const readinessAfterDone = await service.evaluateTaskReadiness(gated.id);
  assert.equal(readinessAfterDone.ready, true);
  assert.equal(readinessAfterDone.blockers.length, 0);

  const taskWithReadiness = await service.getTaskWithReadiness(gated.id);
  assert.equal(taskWithReadiness.readiness.ready, true);

  const tasksWithReadiness = await service.listTasksWithReadiness({ projectId: 'project-1' });
  const enriched = tasksWithReadiness.find((task) => task.id === gated.id);
  assert.equal(enriched?.readiness.ready, true);
});

test('TaskService rejects self dependency and self-referential readiness rules', async () => {
  const repository = new InMemoryTaskRepositoryStub();
  const service = new TaskService(repository);

  const task = await service.createTask({
    title: 'Review architecture',
    description: 'Inspect current architecture constraints',
    projectId: 'project-1',
    assigneeAgentId: 'agent-1',
    createdBy: 'agent-1'
  });

  await assert.rejects(
    () =>
      service.updateTask(task.id, {
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        createdBy: task.createdBy,
        assigneeAgentId: task.assigneeAgentId,
        priority: task.priority,
        dependsOnTaskIds: [task.id]
      }),
    /TASK_DEPENDS_ON_SELF/
  );

  await assert.rejects(
    () =>
      service.updateTask(task.id, {
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        createdBy: task.createdBy,
        assigneeAgentId: task.assigneeAgentId,
        priority: task.priority,
        readinessRules: [{ type: 'task_status', taskId: task.id, status: 'done' }]
      }),
    /TASK_READINESS_RULE_SELF_REFERENCE/
  );
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

    return Array.from(this.tasks.values()).filter((task) => {
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
        return `${task.title} ${task.description}`.toLowerCase().includes(query);
      }

      return true;
    });
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

      const updated: Task = {
        ...task,
        assigneeAgentId: task.assigneeAgentId === previousAgentId ? nextAgentId : task.assigneeAgentId,
        createdBy: task.createdBy === previousAgentId ? nextAgentId : task.createdBy,
        updatedAt: new Date('2026-01-02T00:00:00.000Z')
      };
      this.tasks.set(task.id, updated);
      updatedTasks.push(updated);
    }

    return updatedTasks;
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

  async updatePriority(id: string, priority: TaskPriority): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updated: Task = {
      ...existing,
      priority,
      updatedAt: new Date('2026-01-02T12:00:00.000Z')
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async update(id: string, input: {
    title: string;
    description: string;
    projectId: string;
    assigneeAgentId?: string | null;
    createdBy: string;
    priority: TaskPriority;
    dependsOnTaskIds?: string[];
    readinessRules?: TaskReadinessRule[];
  }): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updated: Task = {
      ...existing,
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdBy: input.createdBy,
      priority: input.priority,
      dependsOnTaskIds: input.dependsOnTaskIds ?? existing.dependsOnTaskIds,
      readinessRules: cloneReadinessRules(input.readinessRules ?? existing.readinessRules),
      updatedAt: new Date('2026-01-03T12:00:00.000Z')
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    this.tasks.delete(id);
    return existing;
  }
}

function cloneReadinessRules(rules: TaskReadinessRule[]): TaskReadinessRule[] {
  return rules.map((rule) => ({ ...rule }));
}
