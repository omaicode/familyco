import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryMemoryService } from './memory.service.js';

test('InMemoryMemoryService stores and returns recent entries per agent', async () => {
  const memory = new InMemoryMemoryService();

  await memory.add({
    agentId: 'agent-1',
    role: 'input',
    content: 'first'
  });

  await memory.add({
    agentId: 'agent-1',
    role: 'tool_output',
    content: 'second'
  });

  await memory.add({
    agentId: 'agent-1',
    role: 'system',
    content: 'third'
  });

  const recentTwo = await memory.listRecent('agent-1', 2);
  assert.equal(recentTwo.length, 2);
  assert.equal(recentTwo[0]?.content, 'second');
  assert.equal(recentTwo[1]?.content, 'third');

  const otherAgent = await memory.listRecent('agent-2', 10);
  assert.deepEqual(otherAgent, []);

  await memory.clear('agent-1');
  const afterClear = await memory.listRecent('agent-1', 10);
  assert.deepEqual(afterClear, []);
});
