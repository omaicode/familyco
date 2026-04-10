import type { AgentService, ToolExecutionResult } from '@familyco/core';

import { resolveExecutiveAgentId } from '../modules/shared/defaults.js';
import { asNonEmptyString, summarizeSlashDescription, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const projectCreateSlashSpec: SlashCommandSpec = {
  command: '/create-project',
  label: 'Create a project',
  description: 'Spin up a new project workspace from a short description.',
  insertValue: '/create-project ',
  levels: ['L0'],
  auditAction: 'agent.chat.create-project',
  buildArguments: (args) => ({
    name: summarizeSlashDescription(args, 'Executive initiative'),
    description: args
  })
};

export const projectCreateTool: ServerToolDefinition = {
  name: 'project.create',
  description:
    'Create a project when the agent explicitly decides a new initiative or workspace should be opened.',
  slashSpec: projectCreateSlashSpec,
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
      description: 'Agent id or name that owns the project. Omit it when unknown to use the executive agent.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.projectService || !context.settingsService || !context.agentService) {
      return unavailableTool('project.create', 'project.create requires project, settings, and agent services');
    }

    const fallbackOwnerAgentId = await resolveExecutiveAgentId({
      agentService: context.agentService,
      settingsService: context.settingsService
    });
    const ownerAgentId = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.ownerAgentId),
      fallbackAgentId: fallbackOwnerAgentId,
      agentService: context.agentService
    });

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

async function resolveAgentReference(input: {
  candidate?: string;
  fallbackAgentId: string;
  agentService: AgentService;
}): Promise<string> {
  if (!input.candidate) {
    return input.fallbackAgentId;
  }

  try {
    const agent = await input.agentService.getAgentById(input.candidate);
    return agent.id;
  } catch {
    const normalizedCandidate = input.candidate.trim().toLowerCase();
    const agents = await input.agentService.listAgents();
    const matchedAgent = agents.find((agent) => {
      return [agent.id, agent.name, agent.role]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .some((value) => value.trim().toLowerCase() === normalizedCandidate);
    });

    return matchedAgent?.id ?? input.fallbackAgentId;
  }
}
