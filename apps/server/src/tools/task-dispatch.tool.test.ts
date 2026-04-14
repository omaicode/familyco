import assert from 'node:assert/strict';
import test from 'node:test';

import { taskDispatchTool } from './task-dispatch.tool.js';

test('task.dispatch accepts taskIds as array payload', async () => {
  const enqueued: Array<{ type: string; payload: Record<string, unknown> }> = [];

  const result = await taskDispatchTool.execute(
    {
      agentId: 'agent-1',
      taskIds: ['task-1', 'task-2']
    },
    {
      queueService: {
        enqueue: async (job: unknown) => {
          enqueued.push(job as { type: string; payload: Record<string, unknown> });
        }
      } as unknown as Parameters<typeof taskDispatchTool.execute>[1]['queueService'],
      taskService: {
        getTaskWithReadiness: async (taskId: string) => ({
          id: taskId,
          assigneeAgentId: 'agent-1',
          readiness: { ready: true, blockers: [] }
        })
      } as unknown as Parameters<typeof taskDispatchTool.execute>[1]['taskService'],
      executeTool: async () => ({ ok: true, toolName: 'noop' }),
      listTools: () => []
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.toolName, 'task.dispatch');
  assert.equal(enqueued.length, 2);
  assert.equal(enqueued[0]?.type, 'task.execute');
  assert.equal(enqueued[1]?.type, 'task.execute');
});
