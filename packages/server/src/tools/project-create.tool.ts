import type { ToolExecutionResult } from '@familyco/core';

import { resolveExecutiveAgentId } from '../modules/shared/defaults.js';
import { asNonEmptyString, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition } from './tool.types.js';

export const projectCreateTool: ServerToolDefinition = {
  name: 'project.create',
  description:
    'Create a project when the agent explicitly decides a new initiative or workspace should be opened.',
  parameters: [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Human-readable project name.'
    },
    {
      name: 'description',
      type: 'string',
      required: true,
      description: 'Purpose and scope of the project.'
    },
    {
      name: 'ownerAgentId',
      type: 'string',
      required: false,
      description: 'Agent id that owns the project. Defaults to the executive agent.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.projectService || !context.settingsService || !context.agentService) {
      return unavailableTool('project.create', 'project.create requires project, settings, and agent services');
    }

    const ownerAgentId =
      asNonEmptyString(argumentsMap.ownerAgentId) ??
      (await resolveExecutiveAgentId({
        agentService: context.agentService,
        settingsService: context.settingsService
      }));

    const project = await context.projectService.createProject({
      name: asNonEmptyString(argumentsMap.name) ?? 'Executive Initiative',
      description:
        asNonEmptyString(argumentsMap.description) ??
        'Project created from the executive tool execution flow.',
      ownerAgentId
    });

    return {
      ok: true,
      toolName: 'project.create',
      output: project
    };
  }
};
