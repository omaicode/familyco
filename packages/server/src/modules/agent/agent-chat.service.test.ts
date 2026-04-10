import assert from 'node:assert/strict';
import test from 'node:test';

import { chunkReply } from './agent-chat.service.js';

test('chunkReply preserves markdown newlines', () => {
  const reply = '# Weekly Plan\n\n1. Sync roadmap\n2. Ship onboarding polish\n\n- Owner: Ops\n- ETA: Friday';
  const chunks = chunkReply(reply);
  const rebuilt = chunks.join('');

  assert.equal(rebuilt, reply);
  assert.equal(rebuilt.includes('\n\n1. Sync roadmap'), true);
  assert.equal(rebuilt.includes('\n- Owner: Ops'), true);
});
