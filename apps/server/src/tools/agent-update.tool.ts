import type { AgentStatus, ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, summarizeSlashDescription, unavailableTool } from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from '../modules/tools/tool.types.js';

export const agentUpdateSlashSpec: SlashCommandSpec = {
  command: '/update-agent',
  usage: '/update-agent {agentId} {new name}',
  label: 'Update an agent',
  description: 'Update agent profile fields such as name, role, department, status, and AI override.',
  insertValue: '/update-agent ',
  levels: ['L0'],
  auditAction: 'agent.chat.update-agent',
  buildArguments: (args) => {
    const [agentId, ...rest] = args.trim().split(/\s+/);
    return {
      agentId: agentId ?? '',
      name: summarizeSlashDescription(rest.join(' '), 'Updated agent')
    };
  }
};

export const agentUpdateTool: ServerToolDefinition = {
  name: 'agent.update',
  description: 'Update agent profile and runtime fields for an existing agent.',
  slashSpec: agentUpdateSlashSpec,
  parameters: [
    { name: 'agentId', type: 'string', required: true, description: 'Agent id or name.' },
    { name: 'name', type: 'string', required: false, description: 'Updated name.' },
    { name: 'role', type: 'string', required: false, description: 'Updated role.' },
    { name: 'department', type: 'string', required: false, description: 'Updated department.' },
    { name: 'status', type: 'active | idle | running | error | paused | terminated', required: false, description: 'Agent status.' },
    { name: 'aiAdapterId', type: 'openai | claude | null', required: false, description: 'Agent adapter override.' },
    { name: 'aiModel', type: 'string | null', required: false, description: 'Agent model override.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.agentService) {
      return unavailableTool('agent.update', 'agent.update requires agentService');
    }

    const agentIdOrName = asNonEmptyString(argumentsMap.agentId);
    if (!agentIdOrName) {
      return invalidArguments('agent.update', 'agentId is required');
    }

    const agents = await context.agentService.listAgents();
    const normalized = agentIdOrName.trim().toLowerCase();
    const existing = agents.find(
      (agent) =>
        agent.id.trim().toLowerCase() === normalized || agent.name.trim().toLowerCase() === normalized
    );
    if (!existing) {
      return invalidArguments('agent.update', `agent not found: ${agentIdOrName}`);
    }

    const updateInput = {
      name: asNonEmptyString(argumentsMap.name),
      role: asNonEmptyString(argumentsMap.role),
      department: asNonEmptyString(argumentsMap.department),
      status: asAgentStatus(argumentsMap.status),
      aiAdapterId: asAdapter(argumentsMap.aiAdapterId),
      aiModel: argumentsMap.aiModel === null ? null : asNonEmptyString(argumentsMap.aiModel)
    };

    if (Object.values(updateInput).every((value) => value === undefined)) {
      return invalidArguments('agent.update', 'at least one editable field is required');
    }

    const updatedAgent = await context.agentService.updateAgent(existing.id, updateInput);
    return {
      ok: true,
      toolName: 'agent.update',
      output: updatedAgent
    };
  }
};

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

function asAdapter(value: unknown): 'openai' | 'claude' | null | undefined {
  if (value === null) {
    return null;
  }

  if (value === 'openai' || value === 'claude') {
    return value;
  }

  return undefined;
}
