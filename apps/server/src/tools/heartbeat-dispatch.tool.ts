import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString } from './tool.helpers.js';
import type { ServerToolDefinition } from './tool.types.js';

export const heartbeatDispatchTool: ServerToolDefinition = {
  name: 'heartbeat.dispatch',
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
      type: 'string',
      required: true,
      description: 'Comma-separated list of task IDs to dispatch, in execution order (highest priority first).'
    }
  ],

  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const agentId = asNonEmptyString(argumentsMap.agentId) ?? context.agentId;
    const raw = asNonEmptyString(argumentsMap.taskIds);

    if (!agentId) {
      return { ok: false, toolName: 'heartbeat.dispatch', error: { code: 'MISSING_AGENT_ID', message: 'agentId is required' } };
    }

    if (!raw) {
      return { ok: false, toolName: 'heartbeat.dispatch', error: { code: 'MISSING_TASK_IDS', message: 'taskIds is required' } };
    }

    if (!context.queueService) {
      return { ok: false, toolName: 'heartbeat.dispatch', error: { code: 'SERVICE_UNAVAILABLE', message: 'queueService is not available' } };
    }

    const taskIds = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (taskIds.length === 0) {
      return { ok: false, toolName: 'heartbeat.dispatch', error: { code: 'EMPTY_TASK_IDS', message: 'No valid task IDs provided' } };
    }

    const dispatched: string[] = [];
    const skipped: string[] = [];

    for (const taskId of taskIds) {
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
      toolName: 'heartbeat.dispatch',
      output: {
        dispatched,
        skipped,
        dispatchedCount: dispatched.length,
        message: `Dispatched ${dispatched.length} task(s) for execution.`
      }
    };
  }
};
