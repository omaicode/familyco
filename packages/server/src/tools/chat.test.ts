import assert from 'node:assert/strict';
import test from 'node:test';

import { parseChatResponse } from './chat.js';

test('parseChatResponse preserves markdown line breaks in plain text fallback', () => {
  const source = '# Weekly Plan\n\n1. Kickoff\n2. Review';
  const parsed = parseChatResponse(source, [], []);

  assert.equal(parsed.reply, source);
});

test('parseChatResponse preserves markdown line breaks in JSON reply field', () => {
  const source = '{"reply":"# Weekly Plan\\n\\n1. Kickoff\\n2. Review","toolCalls":[],"requiresConfirmation":false}';
  const parsed = parseChatResponse(source, [], []);

  assert.equal(parsed.reply, '# Weekly Plan\n\n1. Kickoff\n2. Review');
});

test('parseChatResponse keeps reply empty when adapter only returns tool calls', () => {
  const parsed = parseChatResponse('', [
    {
      name: 'task.create',
      description: 'Create task',
      parameters: []
    }
  ], [
    {
      name: 'task.create',
      arguments: { title: 'Prepare weekly report' }
    }
  ]);

  assert.equal(parsed.reply, '');
  assert.equal(parsed.toolCalls.length, 1);
});
