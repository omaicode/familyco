import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const agentDeleteSlashSpec: SlashCommandSpec = {
  command: '/delete-agent',
  usage: '/delete-agent {agentId} confirm',
  label: 'Delete an agent',
  description: 'Hard-delete an agent and related data (requires confirm keyword).',
  insertValue: '/delete-agent ',
  levels: ['L0'],
  auditAction: 'agent.chat.delete-agent',
  buildArguments: (args) => {
    const [agentId, confirmation] = args.trim().split(/\s+/);
    return {
      agentId: agentId ?? '',
      confirm: confirmation === 'confirm'
    };
  }
};

export const agentDeleteTool: ServerToolDefinition = {
  name: 'agent.delete',
  description: 'Hard-delete an agent with cascading cleanup for related approvals, tasks, and owned projects.',
  slashSpec: agentDeleteSlashSpec,
  parameters: [
    { name: 'agentId', type: 'string', required: true, description: 'Agent id or name.' },
    { name: 'confirm', type: 'boolean', required: true, description: 'Explicit confirmation flag for destructive action.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.agentService) {
      return unavailableTool('agent.delete', 'agent.delete requires agentService');
    }

    const agentIdOrName = asNonEmptyString(argumentsMap.agentId);
    const confirm = argumentsMap.confirm === true;
    if (!agentIdOrName) {
      return invalidArguments('agent.delete', 'agentId is required');
    }

    if (!confirm) {
      return invalidArguments('agent.delete', 'confirm=true is required for agent.delete');
    }

    const agents = await context.agentService.listAgents();
    const normalized = agentIdOrName.trim().toLowerCase();
    const target = agents.find(
      (agent) =>
        agent.id.trim().toLowerCase() === normalized || agent.name.trim().toLowerCase() === normalized
    );
    if (!target) {
      return invalidArguments('agent.delete', `agent not found: ${agentIdOrName}`);
    }

    const result = await context.agentService.deleteAgent(target.id);
    return {
      ok: true,
      toolName: 'agent.delete',
      output: result
    };
  }
};
