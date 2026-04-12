import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryQueueService } from './in-memory-queue.service.js';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

test('in-memory queue handles jobs concurrently per lane', async () => {
  const queue = new InMemoryQueueService({
    agentRunConcurrency: 3,
    toolExecuteConcurrency: 4
  });

  let agentInFlight = 0;
  let toolInFlight = 0;
  let maxAgentInFlight = 0;
  let maxToolInFlight = 0;

  queue.setHandlers({
    onAgentRun: async () => {
      agentInFlight += 1;
      maxAgentInFlight = Math.max(maxAgentInFlight, agentInFlight);
      await sleep(40);
      agentInFlight -= 1;
      return { ok: true };
    },
    onToolExecute: async () => {
      toolInFlight += 1;
      maxToolInFlight = Math.max(maxToolInFlight, toolInFlight);
      await sleep(30);
      toolInFlight -= 1;
      return { ok: true };
    }
  });

  for (let i = 0; i < 12; i += 1) {
    await queue.enqueue({
      type: 'agent.run',
      payload: {
        request: {
          agentId: `agent-${i}`,
          approvalMode: 'auto',
          action: 'heartbeat.tick',
          toolName: 'task.log',
          toolArguments: { i },
          input: `run-${i}`
        }
      }
    });

    await queue.enqueue({
      type: 'tool.execute',
      payload: {
        input: {
          toolName: 'task.log',
          arguments: { i }
        }
      }
    });
  }

  await queue.close();

  assert.ok(maxAgentInFlight > 1, 'agent lane should execute concurrently');
  assert.ok(maxToolInFlight > 1, 'tool lane should execute concurrently');
  assert.ok(maxAgentInFlight <= 3, 'agent lane should respect concurrency limit');
  assert.ok(maxToolInFlight <= 4, 'tool lane should respect concurrency limit');
});
