import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskReadSlashSpec: SlashCommandSpec = {
  command: '/task-info',
  usage: '/task-info {taskId-or-title}',
  label: 'Read task info',
  description: 'Get details of a single task by id or exact title.',
  insertValue: '/task-info ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.task-info',
  buildArguments: (args) => ({
    query: asNonEmptyString(args) ?? ''
  })
};

export const taskReadTool: ServerToolDefinition = {
  name: 'task.read',
  description: 'Read a single task by id or exact title and return its latest details, including dependency and readiness metadata.',
  slashSpec: taskReadSlashSpec,
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Task id or exact task title.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService) {
      return unavailableTool('task.read', 'task.read requires taskService');
    }

    const query = asNonEmptyString(argumentsMap.query);
    if (!query) {
      return invalidArguments('task.read', 'query is required');
    }

    try {
      const taskById = await context.taskService.getTaskWithReadiness(query);
      return {
        ok: true,
        toolName: 'task.read',
        output: taskById
      };
    } catch {
      const tasks = await context.taskService.listTasksWithReadiness({ query });
      const exactTitleMatch = tasks.find((task) => task.title.trim().toLowerCase() === query.trim().toLowerCase());
      if (!exactTitleMatch) {
        return invalidArguments('task.read', `task not found: ${query}`);
      }

      return {
        ok: true,
        toolName: 'task.read',
        output: exactTitleMatch
      };
    }
  }
};
