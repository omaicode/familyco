import type { TaskStatus, ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskUpdateStatusSlashSpec: SlashCommandSpec = {
  command: '/update-task-status',
  usage: '/update-task-status {taskId} {status}',
  label: 'Update task status',
  description: 'Move a task to another valid status.',
  insertValue: '/update-task-status ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.update-task-status',
  buildArguments: (args) => {
    const [taskId, status] = args.trim().split(/\s+/);
    return { taskId: taskId ?? '', status: status ?? '' };
  }
};

export const taskUpdateStatusTool: ServerToolDefinition = {
  name: 'task.update-status',
  description: 'Update task status according to the allowed task transition matrix.',
  slashSpec: taskUpdateStatusSlashSpec,
  parameters: [
    { name: 'taskId', type: 'string', required: true, description: 'Target task id.' },
    {
      name: 'status',
      type: 'pending | in_progress | review | done | blocked | cancelled',
      required: true,
      description: 'Target status.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService) {
      return unavailableTool('task.update-status', 'task.update-status requires taskService');
    }

    const taskId = asNonEmptyString(argumentsMap.taskId);
    const status = asTaskStatus(argumentsMap.status);
    if (!taskId || !status) {
      return invalidArguments('task.update-status', 'taskId and valid status are required');
    }

    const task = await context.taskService.updateTaskStatus(taskId, status);
    return {
      ok: true,
      toolName: 'task.update-status',
      output: task
    };
  }
};

function asTaskStatus(value: unknown): TaskStatus | undefined {
  if (
    value === 'pending'
    || value === 'in_progress'
    || value === 'review'
    || value === 'done'
    || value === 'blocked'
    || value === 'cancelled'
  ) {
    return value;
  }

  return undefined;
}
