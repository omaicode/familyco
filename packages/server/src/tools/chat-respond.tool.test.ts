import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveToolCallQueue } from './chat-respond.tool.js';

test('resolveToolCallQueue blocks planned calls while waiting for confirmation', () => {
  const queue = resolveToolCallQueue({
    requestedToolCalls: [],
    plannedToolCalls: [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }],
    plannedRequiresConfirmation: true
  });

  assert.deepEqual(queue, []);
});

test('resolveToolCallQueue keeps explicit requested calls', () => {
  const queue = resolveToolCallQueue({
    requestedToolCalls: [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }],
    plannedToolCalls: [{ toolName: 'task.create', arguments: { title: 'ignored' } }],
    plannedRequiresConfirmation: true
  });

  assert.deepEqual(queue, [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }]);
});

test('resolveToolCallQueue executes planned calls after confirmation', () => {
  const queue = resolveToolCallQueue({
    requestedToolCalls: [],
    plannedToolCalls: [{ toolName: 'task.create', arguments: { title: 'Run weekly review' } }],
    plannedRequiresConfirmation: false
  });

  assert.deepEqual(queue, [{ toolName: 'task.create', arguments: { title: 'Run weekly review' } }]);
});
