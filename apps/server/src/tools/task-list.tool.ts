import type { TaskPriority, TaskStatus, ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, parseKeyValueArgs, unavailableTool } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskListSlashSpec: SlashCommandSpec = {
  command: '/tasks',
  usage: '/tasks [status=...] [priority=...] [project=...] [assignee=...] [q=...]',
  label: 'List tasks',
  description: 'List tasks with optional filters.',
  insertValue: '/tasks ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.tasks',
  buildArguments: (args) => {
    const kv = parseKeyValueArgs(args);
    return {
      status: kv.status,
      priority: kv.priority,
      projectId: kv.project,
      assigneeAgentId: kv.assignee,
      query: kv.q
    };
  }
};

export const taskListTool: ServerToolDefinition = {
  name: 'task.list',
  description: 'List tasks with optional filters by status, priority, project, assignee, and search query.',
  slashSpec: taskListSlashSpec,
  parameters: [
    { name: 'status', type: 'pending | in_progress | review | done | blocked | cancelled', required: false, description: 'Task status filter.' },
    { name: 'priority', type: 'low | medium | high | urgent', required: false, description: 'Task priority filter.' },
    { name: 'projectId', type: 'string', required: false, description: 'Project id or project name.' },
    { name: 'assigneeAgentId', type: 'string', required: false, description: 'Assignee agent id or name.' },
    { name: 'query', type: 'string', required: false, description: 'Free-text query for title/description.' },
    { name: 'limit', type: 'number', required: false, description: 'Max results to return (default 20, max 100).' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService || !context.projectService || !context.agentService) {
      return unavailableTool('task.list', 'task.list requires task, project, and agent services');
    }

    const projectId = await resolveProjectReference({
      candidate: asNonEmptyString(argumentsMap.projectId),
      context
    });
    const assigneeAgentId = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.assigneeAgentId),
      context
    });

    const status = asTaskStatus(argumentsMap.status);
    const priority = asTaskPriority(argumentsMap.priority);
    const query = asNonEmptyString(argumentsMap.query) ?? asNonEmptyString(argumentsMap.q);
    const limit = Math.min(Math.max(Number(argumentsMap.limit) || 20, 1), 100);

    const tasks = await context.taskService.listTasks({
      projectId,
      assigneeAgentId: assigneeAgentId ?? undefined,
      status,
      priority,
      query
    });

    return {
      ok: true,
      toolName: 'task.list',
      output: {
        total: tasks.length,
        items: tasks.slice(0, limit)
      }
    };
  }
};

function asTaskStatus(value: unknown): TaskStatus | undefined {
  if (
    value === 'pending'
    || value === 'in_progress'
    || value === 'review'
    || value === 'done'
    || value === 'blocked'
    || value === 'cancelled'
  ) {
    return value;
  }

  return undefined;
}

function asTaskPriority(value: unknown): TaskPriority | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent' ? value : undefined;
}

async function resolveProjectReference(input: {
  candidate?: string;
  context: Parameters<ServerToolDefinition['execute']>[1];
}): Promise<string | undefined> {
  if (!input.candidate) {
    return undefined;
  }

  const normalized = input.candidate.trim().toLowerCase();
  const projects = await input.context.projectService!.listProjects();
  const matched = projects.find(
    (project) =>
      project.id.trim().toLowerCase() === normalized || project.name.trim().toLowerCase() === normalized
  );
  return matched?.id;
}

async function resolveAgentReference(input: {
  candidate?: string;
  context: Parameters<ServerToolDefinition['execute']>[1];
}): Promise<string | null> {
  if (!input.candidate) {
    return null;
  }

  const normalized = input.candidate.trim().toLowerCase();
  const agents = await input.context.agentService!.listAgents();
  const matched = agents.find((agent) =>
    [agent.id, agent.name, agent.role]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => value.trim().toLowerCase() === normalized)
  );
  return matched?.id ?? null;
}
