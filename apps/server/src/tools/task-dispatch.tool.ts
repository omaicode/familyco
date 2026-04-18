import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString } from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition } from '../modules/tools/tool.types.js';

export const taskDispatchTool: ServerToolDefinition = {
  name: 'task.dispatch',
  description: 'Dispatch one or more of your assigned tasks for immediate execution. Each task will run as a separate concurrent job. Use this during your heartbeat run after listing your tasks.',
  parameters: [
    {
      name: 'agentId',
      type: 'string',
      required: true,
      description: 'Your agent ID.'
    },
    {
      name: 'taskIds',
      type: 'array',
      required: false,
      items: { type: 'string' },
      description: 'Ordered list of task IDs to dispatch (highest priority first). A comma-separated string is also accepted for backward compatibility.'
    }
  ],

  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const agentId = asNonEmptyString(argumentsMap.agentId) ?? context.agentId;
    const taskIds = parseTaskIds(argumentsMap.taskIds);

    if (!agentId) {
      return { ok: false, toolName: 'task.dispatch', error: { code: 'MISSING_AGENT_ID', message: 'agentId is required' } };
    }

    if (taskIds.length === 0) {
      // No tasks to dispatch — return graceful success so the heartbeat doesn't log an error.
      return {
        ok: true,
        toolName: 'task.dispatch',
        output: {
          dispatched: [],
          skipped: [],
          dispatchedCount: 0,
          message: 'No tasks to dispatch.'
        }
      };
    }

    if (!context.queueService) {
      return { ok: false, toolName: 'task.dispatch', error: { code: 'SERVICE_UNAVAILABLE', message: 'queueService is not available' } };
    }

    if (!context.taskService) {
      return { ok: false, toolName: 'task.dispatch', error: { code: 'SERVICE_UNAVAILABLE', message: 'taskService is not available' } };
    }

    const dispatched: string[] = [];
    const skipped: string[] = [];
    const readinessBlocked: Array<{ taskId: string; blockers: string[] }> = [];

    for (const taskId of taskIds) {
      const task = await context.taskService.getTaskWithReadiness(taskId).catch(() => null);
      if (!task) {
        skipped.push(taskId);
        readinessBlocked.push({ taskId, blockers: ['Task not found.'] });
        continue;
      }

      if (task.assigneeAgentId !== agentId) {
        skipped.push(taskId);
        readinessBlocked.push({ taskId, blockers: ['Task is not assigned to this agent.'] });
        continue;
      }

      if (!task.readiness.ready) {
        skipped.push(taskId);
        readinessBlocked.push({
          taskId,
          blockers: task.readiness.blockers.map((blocker) => blocker.message)
        });
        continue;
      }

      try {
        await context.queueService.enqueue({
          type: 'task.execute',
          payload: { agentId, taskId }
        });
        dispatched.push(taskId);
      } catch {
        skipped.push(taskId);
      }
    }

    return {
      ok: true,
      toolName: 'task.dispatch',
      output: {
        dispatched,
        skipped,
        readinessBlocked,
        dispatchedCount: dispatched.length,
        message: `Dispatched ${dispatched.length} task(s) for execution. Skipped ${skipped.length} task(s).`
      }
    };
  }
};

function parseTaskIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asNonEmptyString(entry))
      .filter((entry): entry is string => typeof entry === 'string');
  }

  const raw = asNonEmptyString(value);
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
