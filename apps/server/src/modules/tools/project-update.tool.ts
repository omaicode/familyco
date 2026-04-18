import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, asTextString, summarizeSlashDescription, unavailableTool, invalidArguments } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const projectUpdateSlashSpec: SlashCommandSpec = {
  command: '/update-project',
  usage: '/update-project {projectId} {new name}',
  label: 'Update a project',
  description: 'Update project name, description, owner, and parent.',
  insertValue: '/update-project ',
  levels: ['L0'],
  auditAction: 'agent.chat.update-project',
  buildArguments: (args) => {
    const [projectId, ...rest] = args.trim().split(/\s+/);
    return {
      projectId: projectId ?? '',
      name: summarizeSlashDescription(rest.join(' '), 'Updated project')
    };
  }
};

export const projectUpdateTool: ServerToolDefinition = {
  name: 'project.update',
  description: 'Update an existing project by id (or name lookup) with revised fields.',
  slashSpec: projectUpdateSlashSpec,
  parameters: [
    { name: 'projectId', type: 'string', required: true, description: 'Project id or project name.' },
    { name: 'name', type: 'string', required: false, description: 'Updated project name.' },
    { name: 'description', type: 'string', required: false, description: 'Updated project description.' },
    { name: 'ownerAgentId', type: 'string', required: false, description: 'Owner agent id or name.' },
    { name: 'parentProjectId', type: 'string | null', required: false, description: 'Parent project id or name. Use null to clear.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.projectService || !context.agentService) {
      return unavailableTool('project.update', 'project.update requires projectService and agentService');
    }

    const projectIdOrName = asNonEmptyString(argumentsMap.projectId);
    if (!projectIdOrName) {
      return invalidArguments('project.update', 'projectId is required');
    }

    const projects = await context.projectService.listProjects();
    const project = resolveProjectByIdOrName(projects, projectIdOrName);
    if (!project) {
      return invalidArguments('project.update', `project not found: ${projectIdOrName}`);
    }

    const ownerAgentId = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.ownerAgentId),
      fallbackAgentId: project.ownerAgentId,
      context
    });
    const parentProjectId = resolveParentProjectId({
      candidate: argumentsMap.parentProjectId,
      fallbackParentProjectId: project.parentProjectId,
      projects
    });

    const updated = await context.projectService.updateProject(project.id, {
      name: asNonEmptyString(argumentsMap.name) ?? project.name,
      description: asTextString(argumentsMap.description) ?? project.description,
      ownerAgentId,
      parentProjectId
    });

    return {
      ok: true,
      toolName: 'project.update',
      output: updated
    };
  }
};

function resolveProjectByIdOrName<T extends { id: string; name: string }>(
  projects: T[],
  candidate: string
): T | undefined {
  const normalized = candidate.trim().toLowerCase();
  return projects.find(
    (project) =>
      project.id.trim().toLowerCase() === normalized || project.name.trim().toLowerCase() === normalized
  );
}

async function resolveAgentReference(input: {
  candidate?: string;
  fallbackAgentId: string;
  context: Parameters<ServerToolDefinition['execute']>[1];
}): Promise<string> {
  if (!input.candidate) {
    return input.fallbackAgentId;
  }

  const normalized = input.candidate.trim().toLowerCase();
  const agents = await input.context.agentService!.listAgents();
  const matched = agents.find((agent) =>
    [agent.id, agent.name, agent.role]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => value.trim().toLowerCase() === normalized)
  );

  return matched?.id ?? input.fallbackAgentId;
}

function resolveParentProjectId(input: {
  candidate: unknown;
  fallbackParentProjectId: string | null;
  projects: Array<{ id: string; name: string }>;
}): string | null {
  if (input.candidate === null) {
    return null;
  }

  const parentCandidate = asNonEmptyString(input.candidate);
  if (!parentCandidate) {
    return input.fallbackParentProjectId;
  }

  const normalized = parentCandidate.trim().toLowerCase();
  const matched = input.projects.find(
    (project) =>
      project.id.trim().toLowerCase() === normalized || project.name.trim().toLowerCase() === normalized
  );
  return matched?.id ?? input.fallbackParentProjectId;
}
