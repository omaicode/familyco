import type { AgentLevel, AgentStatus, ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, parseKeyValueArgs, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const agentListSlashSpec: SlashCommandSpec = {
  command: '/agents',
  usage: '/agents [level=...] [parent=...] [q=...]',
  label: 'List agents',
  description: 'List agents with optional filters.',
  insertValue: '/agents ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.agents',
  buildArguments: (args) => {
    const kv = parseKeyValueArgs(args);
    return {
      level: kv.level,
      parentAgentId: kv.parent,
      query: kv.q
    };
  }
};

export const agentListTool: ServerToolDefinition = {
  name: 'agent.list',
  description: 'List agents with optional filters by level, parent, and keyword.',
  slashSpec: agentListSlashSpec,
  parameters: [
    { name: 'level', type: 'L0 | L1 | L2', required: false, description: 'Agent level filter.' },
    { name: 'parentAgentId', type: 'string', required: false, description: 'Parent agent id or name.' },
    { name: 'query', type: 'string', required: false, description: 'Keyword filter for name/role/department.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.agentService) {
      return unavailableTool('agent.list', 'agent.list requires agentService');
    }

    const level = asAgentLevel(argumentsMap.level);
    const parentAgentId = await resolveParentAgentId({
      candidate: asNonEmptyString(argumentsMap.parentAgentId),
      context
    });
    const query = asNonEmptyString(argumentsMap.query) ?? asNonEmptyString(argumentsMap.q);
    const normalizedQuery = query?.toLowerCase();

    const agents = await context.agentService.listAgents();
    const filtered = agents.filter((agent) => {
      if (level && agent.level !== level) {
        return false;
      }

      if (parentAgentId && agent.parentAgentId !== parentAgentId) {
        return false;
      }

      if (normalizedQuery) {
        const haystack = [
          agent.id,
          agent.name,
          agent.role,
          agent.department
        ]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .map((value) => value.trim().toLowerCase());

        return haystack.some((value) => value.includes(normalizedQuery));
      }

      return true;
    });

    return {
      ok: true,
      toolName: 'agent.list',
      output: {
        total: filtered.length,
        items: filtered
      }
    };
  }
};

function asAgentLevel(value: unknown): AgentLevel | undefined {
  if (value === 'L0' || value === 'L1' || value === 'L2') {
    return value;
  }

  return undefined;
}

function asAgentStatus(value: unknown): AgentStatus | undefined {
  if (
    value === 'active'
    || value === 'idle'
    || value === 'running'
    || value === 'error'
    || value === 'paused'
    || value === 'terminated'
  ) {
    return value;
  }

  return undefined;
}

async function resolveParentAgentId(input: {
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
