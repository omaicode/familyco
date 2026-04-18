import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, parseKeyValueArgs, unavailableTool } from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from '../modules/tools/tool.types.js';

export const projectListSlashSpec: SlashCommandSpec = {
  command: '/projects',
  usage: '/projects [owner=...] [q=...]',
  label: 'List projects',
  description: 'List projects with optional owner and keyword filters.',
  insertValue: '/projects ',
  levels: ['L0', 'L1'],
  auditAction: 'agent.chat.projects',
  buildArguments: (args) => {
    const kv = parseKeyValueArgs(args);
    return {
      ownerAgentId: kv.owner,
      query: kv.q
    };
  }
};

export const projectListTool: ServerToolDefinition = {
  name: 'project.list',
  description: 'List projects with optional filters by owner and keyword.',
  slashSpec: projectListSlashSpec,
  parameters: [
    { name: 'ownerAgentId', type: 'string', required: false, description: 'Owner agent id or name.' },
    { name: 'query', type: 'string', required: false, description: 'Keyword filter for project name/description.' },
    { name: 'limit', type: 'number', required: false, description: 'Max results to return (default 20, max 100).' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.projectService || !context.agentService) {
      return unavailableTool('project.list', 'project.list requires projectService and agentService');
    }

    const ownerAgentId = await resolveOwnerAgentId({
      candidate: asNonEmptyString(argumentsMap.ownerAgentId),
      context
    });
    const query = asNonEmptyString(argumentsMap.query) ?? asNonEmptyString(argumentsMap.q);
    const limit = Math.min(Math.max(Number(argumentsMap.limit) || 20, 1), 100);

    const projects = await context.projectService.listProjects();
    const filtered = projects.filter((project) => {
      if (ownerAgentId && project.ownerAgentId !== ownerAgentId) {
        return false;
      }

      if (query) {
        const normalizedQuery = query.trim().toLowerCase();
        return (
          project.name.trim().toLowerCase().includes(normalizedQuery)
          || project.description.trim().toLowerCase().includes(normalizedQuery)
        );
      }

      return true;
    });

    return {
      ok: true,
      toolName: 'project.list',
      output: {
        total: filtered.length,
        items: filtered.slice(0, limit)
      }
    };
  }
};

async function resolveOwnerAgentId(input: {
  candidate?: string;
  context: Parameters<ServerToolDefinition['execute']>[1];
}): Promise<string | undefined> {
  if (!input.candidate) {
    return undefined;
  }

  const normalized = input.candidate.trim().toLowerCase();
  const agents = await input.context.agentService!.listAgents();
  const matched = agents.find((agent) =>
    [agent.id, agent.name, agent.role]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => value.trim().toLowerCase() === normalized)
  );

  return matched?.id;
}
