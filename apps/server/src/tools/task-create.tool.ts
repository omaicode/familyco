import type { AgentService, ProjectService, ToolExecutionResult } from '@familyco/core';

import { resolveDefaultProjectId, resolveExecutiveAgentId } from '../modules/shared/defaults.js';
import {
  asNonEmptyString,
  asStringArray,
  asTaskPriority,
  asTaskReadinessRules,
  asTextString,
  invalidArguments,
  summarizeSlashDescription,
  unavailableTool
} from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskCreateSlashSpec: SlashCommandSpec = {
  command: '/create-task',
  label: 'Create a task',
  description: 'Open a new task directly from the executive chat lane.',
  insertValue: '/create-task ',
  levels: ['L0', 'L1'],
  auditAction: 'agent.chat.create-task',
  buildArguments: (args) => ({
    title: summarizeSlashDescription(args, 'Executive follow-up'),
    description: args
  })
};

export const taskCreateTool: ServerToolDefinition = {
  name: 'task.create',
  description:
    'Create a tracked task in FamilyCo when the agent explicitly decides the request should become executable work.',
  slashSpec: taskCreateSlashSpec,
  parameters: [
    {
      name: 'title',
      type: 'string',
      required: true,
      description: 'Short task title shown in the task list.'
    },
    {
      name: 'description',
      type: 'string',
      required: true,
      description: 'Detailed execution notes or acceptance criteria for the task.'
    },
    {
      name: 'projectId',
      type: 'string',
      required: false,
      description: 'Optional target project id or name. Omit it when unknown to use the executive queue.'
    },
    {
      name: 'assigneeAgentId',
      type: 'string',
      required: false,
      description: 'Agent id or name that should own the task. Omit it when unknown to use the executive agent.'
    },
    {
      name: 'createdBy',
      type: 'string',
      required: false,
      description: 'Optional creator agent id or name. Defaults to the resolved assignee.'
    },
    {
      name: 'priority',
      type: 'low | medium | high | urgent',
      required: false,
      description: 'Optional priority level for sorting and escalation.'
    },
    {
      name: 'dependsOnTaskIds',
      type: 'string[]',
      required: false,
      description: 'Optional list of task IDs that must be done before this task is ready.'
    },
    {
      name: 'readinessRules',
      type: 'TaskReadinessRule[]',
      required: false,
      description: 'Optional machine-readable readiness rules, for example task_status requirements on other task IDs.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService || !context.projectService || !context.settingsService || !context.agentService) {
      return unavailableTool('task.create', 'task.create requires task, project, settings, and agent services');
    }

    const title = asNonEmptyString(argumentsMap.title) ?? 'Executive follow-up';
    const description = asTextString(argumentsMap.description) ?? title;
    const fallbackAgentId = await resolveExecutiveAgentId({
      agentService: context.agentService,
      settingsService: context.settingsService
    });
    const fallbackProjectId = await resolveDefaultProjectId({
      agentService: context.agentService,
      projectService: context.projectService,
      settingsService: context.settingsService
    });
    const assigneeAgentId = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.assigneeAgentId),
      fallbackAgentId,
      agentService: context.agentService
    });
    const projectId = await resolveProjectReference({
      candidate: asNonEmptyString(argumentsMap.projectId),
      fallbackProjectId,
      projectService: context.projectService
    });
    const createdBy = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.createdBy),
      fallbackAgentId: assigneeAgentId,
      agentService: context.agentService
    });
    const dependsOnTaskIds = asStringArray(argumentsMap.dependsOnTaskIds);
    const readinessRules = asTaskReadinessRules(argumentsMap.readinessRules);

    if (argumentsMap.dependsOnTaskIds !== undefined && dependsOnTaskIds === undefined) {
      return invalidArguments('task.create', 'dependsOnTaskIds must be a string array or comma-separated string');
    }

    if (argumentsMap.readinessRules !== undefined && readinessRules === undefined) {
      return invalidArguments('task.create', 'readinessRules must be a JSON array of supported readiness rules');
    }

    const task = await context.taskService.createTask({
      title,
      description,
      projectId,
      assigneeAgentId,
      createdBy,
      priority: asTaskPriority(argumentsMap.priority),
      dependsOnTaskIds,
      readinessRules
    });

    return {
      ok: true,
      toolName: 'task.create',
      output: task
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
    const normalizedCandidate = normalizeLookup(input.candidate);
    const agents = await input.agentService.listAgents();
    const matchedAgent = agents.find((agent) => {
      return [agent.id, agent.name, agent.role]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .some((value) => normalizeLookup(value) === normalizedCandidate);
    });

    return matchedAgent?.id ?? input.fallbackAgentId;
  }
}

async function resolveProjectReference(input: {
  candidate?: string;
  fallbackProjectId: string;
  projectService: ProjectService;
}): Promise<string> {
  if (!input.candidate) {
    return input.fallbackProjectId;
  }

  const normalizedCandidate = normalizeLookup(input.candidate);
  const projects = await input.projectService.listProjects();
  const matchedProject = projects.find((project) => {
    return normalizeLookup(project.id) === normalizedCandidate || normalizeLookup(project.name) === normalizedCandidate;
  });

  return matchedProject?.id ?? input.fallbackProjectId;
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}
