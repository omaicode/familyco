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
