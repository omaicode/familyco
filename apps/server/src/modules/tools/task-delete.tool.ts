import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskDeleteSlashSpec: SlashCommandSpec = {
  command: '/delete-task',
  usage: '/delete-task {taskId} confirm',
  label: 'Delete a task',
  description: 'Hard-delete a task by id (requires confirm keyword).',
  insertValue: '/delete-task ',
  levels: ['L0'],
  auditAction: 'agent.chat.delete-task',
  buildArguments: (args) => {
    const [taskId, confirmation] = args.trim().split(/\s+/);
    return {
      taskId: taskId ?? '',
      confirm: confirmation === 'confirm'
    };
  }
};

export const taskDeleteTool: ServerToolDefinition = {
  name: 'task.delete',
  description: 'Hard-delete a task record by id.',
  slashSpec: taskDeleteSlashSpec,
  parameters: [
    { name: 'taskId', type: 'string', required: true, description: 'Task id to delete.' },
    { name: 'confirm', type: 'boolean', required: true, description: 'Explicit confirmation flag for destructive action.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService) {
      return unavailableTool('task.delete', 'task.delete requires taskService');
    }

    const taskId = asNonEmptyString(argumentsMap.taskId);
    const confirm = argumentsMap.confirm === true;
    if (!taskId) {
      return invalidArguments('task.delete', 'taskId is required');
    }

    if (!confirm) {
      return invalidArguments('task.delete', 'confirm=true is required for task.delete');
    }

    const deletedTask = await context.taskService.deleteTask(taskId);
    return {
      ok: true,
      toolName: 'task.delete',
      output: deletedTask
    };
  }
};
