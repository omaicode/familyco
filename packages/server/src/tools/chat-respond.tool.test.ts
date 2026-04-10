import assert from 'node:assert/strict';
import test from 'node:test';

import { parseConversationHistory, resolveToolCallQueue } from './chat-respond.tool.js';

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

test('parseConversationHistory keeps toolCalls from prior messages', () => {
  const history = parseConversationHistory([
    {
      senderId: 'agent-l0',
      body: 'Created project.',
      toolCalls: [
        { toolName: 'project.create', ok: true, summary: 'Project created' },
        { toolName: 'task.create', ok: false, summary: 'Task failed', error: { message: 'INVALID_PROJECT' } }
      ]
    }
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0]?.toolCalls?.length, 2);
  assert.equal(history[0]?.toolCalls?.[0]?.toolName, 'project.create');
  assert.equal(history[0]?.toolCalls?.[1]?.error?.message, 'INVALID_PROJECT');
});
