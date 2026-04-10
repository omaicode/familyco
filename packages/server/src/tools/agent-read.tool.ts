import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const agentReadSlashSpec: SlashCommandSpec = {
  command: '/agent-info',
  usage: '/agent-info {agentId-or-name}',
  label: 'Read agent info',
  description: 'Get details of a single agent by id or exact name.',
  insertValue: '/agent-info ',
  levels: ['L0', 'L1'],
  auditAction: 'agent.chat.agent-info',
  buildArguments: (args) => ({
    query: asNonEmptyString(args) ?? ''
  })
};

export const agentReadTool: ServerToolDefinition = {
  name: 'agent.read',
  description: 'Read a single agent by id or exact name and return its details.',
  slashSpec: agentReadSlashSpec,
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Agent id or exact agent name.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.agentService) {
      return unavailableTool('agent.read', 'agent.read requires agentService');
    }

    const query = asNonEmptyString(argumentsMap.query);
    if (!query) {
      return invalidArguments('agent.read', 'query is required');
    }

    const normalized = query.trim().toLowerCase();
    const agents = await context.agentService.listAgents();
    const matched = agents.find((agent) =>
      [agent.id, agent.name]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .some((value) => value.trim().toLowerCase() === normalized)
    );

    if (!matched) {
      return invalidArguments('agent.read', `agent not found: ${query}`);
    }

    return {
      ok: true,
      toolName: 'agent.read',
      output: matched
    };
  }
};
