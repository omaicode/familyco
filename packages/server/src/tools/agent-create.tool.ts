import type { AgentLevel, ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const agentCreateSlashSpec: SlashCommandSpec = {
  command: '/create-agent',
  label: 'Create an agent',
  description: 'Spin up a new agent with a name, role, and department.',
  insertValue: '/create-agent ',
  levels: ['L0']
};

export const agentCreateTool: ServerToolDefinition = {
  name: 'agent.create',
  description:
    'Create a new AI agent in the hierarchy when explicitly requested. Use only when the agent decides a new autonomous agent is needed.',
  slashSpec: agentCreateSlashSpec,
  parameters: [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Human-readable agent name shown in the agent list.'
    },
    {
      name: 'role',
      type: 'string',
      required: true,
      description: 'Agent role or job title (e.g. "Marketing Manager").'
    },
    {
      name: 'department',
      type: 'string',
      required: true,
      description: 'Department or functional area the agent belongs to (e.g. "Marketing").'
    },
    {
      name: 'level',
      type: 'L0 | L1 | L2',
      required: false,
      description: 'Hierarchy level of the new agent. Defaults to L1 if omitted.'
    },
    {
      name: 'parentAgentId',
      type: 'string',
      required: false,
      description: 'Parent agent id or name. Omit to create a top-level agent.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.agentService) {
      return unavailableTool('agent.create', 'agent.create requires agentService');
    }

    const name = asNonEmptyString(argumentsMap.name);
    const role = asNonEmptyString(argumentsMap.role);
    const department = asNonEmptyString(argumentsMap.department);

    if (!name || !role || !department) {
      return {
        ok: false,
        toolName: 'agent.create',
        output: { error: 'name, role, and department are required to create an agent.' }
      };
    }

    const rawLevel = asNonEmptyString(argumentsMap.level);
    const level: AgentLevel = isAgentLevel(rawLevel) ? rawLevel : 'L1';

    const parentAgentId = await resolveParentAgentId({
      candidate: asNonEmptyString(argumentsMap.parentAgentId),
      agentService: context.agentService
    });

    const agent = await context.agentService.createAgent({
      name,
      role,
      department,
      level,
      parentAgentId: parentAgentId ?? null
    });

    return {
      ok: true,
      toolName: 'agent.create',
      output: agent
    };
  }
};

function isAgentLevel(value: string | undefined): value is AgentLevel {
  return value === 'L0' || value === 'L1' || value === 'L2';
}

async function resolveParentAgentId(input: {
  candidate?: string;
  agentService: NonNullable<import('./tool.types.js').ServerToolContext['agentService']>;
}): Promise<string | undefined> {
  if (!input.candidate) {
    return undefined;
  }

  try {
    const agent = await input.agentService.getAgentById(input.candidate);
    return agent.id;
  } catch {
    const normalized = input.candidate.trim().toLowerCase();
    const agents = await input.agentService.listAgents();
    const match = agents.find((agent) => {
      return [agent.id, agent.name, agent.role]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .some((value) => value.trim().toLowerCase() === normalized);
    });

    return match?.id;
  }
}
