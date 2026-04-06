import type { ToolExecutionResult } from '@familyco/core';

import { resolveDefaultProjectId, resolveExecutiveAgentId } from '../modules/shared/defaults.js';
import { asNonEmptyString, asTaskPriority, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition } from './tool.types.js';

export const taskCreateTool: ServerToolDefinition = {
  name: 'task.create',
  description:
    'Create a tracked task in FamilyCo when the agent explicitly decides the request should become executable work.',
  parameters: [
    {
      name: 'title',
      type: 'string',
      required: true,
      description: 'Short task title shown in the task list.'
    },
    {
      name: 'description',
      type: 'string',
      required: true,
      description: 'Detailed execution notes or acceptance criteria for the task.'
    },
    {
      name: 'projectId',
      type: 'string',
      required: false,
      description: 'Optional target project. Defaults to the executive queue when omitted.'
    },
    {
      name: 'assigneeAgentId',
      type: 'string',
      required: false,
      description: 'Agent who should own the task. Defaults to the executive agent.'
    },
    {
      name: 'createdBy',
      type: 'string',
      required: false,
      description: 'Agent id recorded as the creator of the task.'
    },
    {
      name: 'priority',
      type: 'low | medium | high | urgent',
      required: false,
      description: 'Optional priority level for sorting and escalation.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService || !context.projectService || !context.settingsService || !context.agentService) {
      return unavailableTool('task.create', 'task.create requires task, project, settings, and agent services');
    }

    const title = asNonEmptyString(argumentsMap.title) ?? 'Executive follow-up';
    const description = asNonEmptyString(argumentsMap.description) ?? title;
    const assigneeAgentId =
      asNonEmptyString(argumentsMap.assigneeAgentId) ??
      (await resolveExecutiveAgentId({
        agentService: context.agentService,
        settingsService: context.settingsService
      }));
    const projectId =
      asNonEmptyString(argumentsMap.projectId) ??
      (await resolveDefaultProjectId({
        agentService: context.agentService,
        projectService: context.projectService,
        settingsService: context.settingsService
      }));

    const task = await context.taskService.createTask({
      title,
      description,
      projectId,
      assigneeAgentId,
      createdBy: asNonEmptyString(argumentsMap.createdBy) ?? assigneeAgentId,
      priority: asTaskPriority(argumentsMap.priority)
    });

    return {
      ok: true,
      toolName: 'task.create',
      output: task
    };
  }
};
