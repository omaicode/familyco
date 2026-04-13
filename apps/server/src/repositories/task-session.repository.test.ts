import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryTaskSessionRepository } from '../repositories/in-memory-task-session.repository.js';
import type { TaskSessionCheckpoint } from '../runtime/task-session.store.js';

const BASE: TaskSessionCheckpoint = {
  taskId: 'task-1',
  agentId: 'agent-1',
  sessionId: 'sess-abc',
  checkpointIndex: 0,
  status: 'active',
  summary: 'Started work.',
  lastToolNames: ['file.search', 'task.update-status'],
  toolResults: [{ toolName: 'file.search', ok: true, output: 'Found 2 files' }],
  startedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:01:00.000Z'
};

test('InMemoryTaskSessionRepository: load returns null when nothing saved', async () => {
  const repo = new InMemoryTaskSessionRepository();
  const result = await repo.load('unknown-task');
  assert.equal(result, null);
});

test('InMemoryTaskSessionRepository: save and load round-trips correctly', async () => {
  const repo = new InMemoryTaskSessionRepository();
  await repo.save(BASE);
  const loaded = await repo.load('task-1');

  assert.ok(loaded !== null);
  assert.equal(loaded.taskId, 'task-1');
  assert.equal(loaded.agentId, 'agent-1');
  assert.equal(loaded.sessionId, 'sess-abc');
  assert.equal(loaded.checkpointIndex, 0);
  assert.equal(loaded.status, 'active');
  assert.equal(loaded.summary, 'Started work.');
  assert.deepEqual(loaded.lastToolNames, ['file.search', 'task.update-status']);
});

test('InMemoryTaskSessionRepository: save overwrites existing checkpoint', async () => {
  const repo = new InMemoryTaskSessionRepository();
  await repo.save(BASE);
  await repo.save({ ...BASE, checkpointIndex: 1, status: 'completed', summary: 'Done.' });

  const loaded = await repo.load('task-1');
  assert.ok(loaded !== null);
  assert.equal(loaded.checkpointIndex, 1);
  assert.equal(loaded.status, 'completed');
  assert.equal(loaded.summary, 'Done.');
});

test('InMemoryTaskSessionRepository: clear removes the checkpoint', async () => {
  const repo = new InMemoryTaskSessionRepository();
  await repo.save(BASE);
  await repo.clear('task-1');
  const loaded = await repo.load('task-1');
  assert.equal(loaded, null);
});

test('InMemoryTaskSessionRepository: save is isolated per taskId', async () => {
  const repo = new InMemoryTaskSessionRepository();
  await repo.save(BASE);
  await repo.save({ ...BASE, taskId: 'task-2', agentId: 'agent-2', sessionId: 'sess-xyz' });

  const first = await repo.load('task-1');
  const second = await repo.load('task-2');

  assert.equal(first?.agentId, 'agent-1');
  assert.equal(second?.agentId, 'agent-2');
});
