import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const projectReadSlashSpec: SlashCommandSpec = {
  command: '/project-info',
  usage: '/project-info {projectId-or-name}',
  label: 'Read project info',
  description: 'Get details of a single project by id or exact name.',
  insertValue: '/project-info ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.project-info',
  buildArguments: (args) => ({
    query: asNonEmptyString(args) ?? ''
  })
};

export const projectReadTool: ServerToolDefinition = {
  name: 'project.read',
  description: 'Read a single project by id or exact name and return its details.',
  slashSpec: projectReadSlashSpec,
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Project id or exact project name.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.projectService) {
      return unavailableTool('project.read', 'project.read requires projectService');
    }

    const query = asNonEmptyString(argumentsMap.query);
    if (!query) {
      return invalidArguments('project.read', 'query is required');
    }

    const normalized = query.trim().toLowerCase();
    const projects = await context.projectService.listProjects();
    const matched = projects.find(
      (project) =>
        project.id.trim().toLowerCase() === normalized || project.name.trim().toLowerCase() === normalized
    );

    if (!matched) {
      return invalidArguments('project.read', `project not found: ${query}`);
    }

    return {
      ok: true,
      toolName: 'project.read',
      output: matched
    };
  }
};
