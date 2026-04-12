import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const projectDeleteSlashSpec: SlashCommandSpec = {
  command: '/delete-project',
  usage: '/delete-project {projectId} confirm',
  label: 'Delete a project',
  description: 'Hard-delete a project by id (requires confirm keyword).',
  insertValue: '/delete-project ',
  levels: ['L0'],
  auditAction: 'agent.chat.delete-project',
  buildArguments: (args) => {
    const [projectId, confirmation] = args.trim().split(/\s+/);
    return {
      projectId: projectId ?? '',
      confirm: confirmation === 'confirm'
    };
  }
};

export const projectDeleteTool: ServerToolDefinition = {
  name: 'project.delete',
  description: 'Hard-delete an existing project (project must be empty under current repository rules).',
  slashSpec: projectDeleteSlashSpec,
  parameters: [
    { name: 'projectId', type: 'string', required: true, description: 'Project id or project name.' },
    { name: 'confirm', type: 'boolean', required: true, description: 'Explicit confirmation flag for destructive action.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.projectService) {
      return unavailableTool('project.delete', 'project.delete requires projectService');
    }

    const projectIdOrName = asNonEmptyString(argumentsMap.projectId);
    const confirm = argumentsMap.confirm === true;
    if (!projectIdOrName) {
      return invalidArguments('project.delete', 'projectId is required');
    }

    if (!confirm) {
      return invalidArguments('project.delete', 'confirm=true is required for project.delete');
    }

    const projects = await context.projectService.listProjects();
    const normalized = projectIdOrName.trim().toLowerCase();
    const project = projects.find(
      (item) => item.id.trim().toLowerCase() === normalized || item.name.trim().toLowerCase() === normalized
    );
    if (!project) {
      return invalidArguments('project.delete', `project not found: ${projectIdOrName}`);
    }

    const deletedProject = await context.projectService.deleteProject(project.id);
    return {
      ok: true,
      toolName: 'project.delete',
      output: deletedProject
    };
  }
};
