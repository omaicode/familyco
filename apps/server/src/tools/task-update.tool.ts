import type { TaskPriority, ToolExecutionResult } from '@familyco/core';

import {
  asNonEmptyString,
  asStringArray,
  asTaskReadinessRules,
  asTextString,
  invalidArguments,
  summarizeSlashDescription,
  unavailableTool
} from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskUpdateSlashSpec: SlashCommandSpec = {
  command: '/update-task',
  usage: '/update-task {taskId} {new title}',
  label: 'Update a task',
  description: 'Update task title and optional fields for an existing task.',
  insertValue: '/update-task ',
  levels: ['L0', 'L1'],
  auditAction: 'agent.chat.update-task',
  buildArguments: (args) => {
    const [taskId, ...rest] = args.trim().split(/\s+/);
    return {
      taskId: taskId ?? '',
      title: summarizeSlashDescription(rest.join(' '), 'Updated task')
    };
  }
};

export const taskUpdateTool: ServerToolDefinition = {
  name: 'task.update',
  description: 'Update an existing task by id with revised title, description, assignee, project, creator, priority, dependencies, or readiness rules.',
  slashSpec: taskUpdateSlashSpec,
  parameters: [
    { name: 'taskId', type: 'string', required: true, description: 'Target task id.' },
    { name: 'title', type: 'string', required: false, description: 'Updated task title.' },
    { name: 'description', type: 'string', required: false, description: 'Updated task description.' },
    { name: 'projectId', type: 'string', required: false, description: 'Project id or project name.' },
    { name: 'assigneeAgentId', type: 'string', required: false, description: 'Assignee agent id or name.' },
    { name: 'createdBy', type: 'string', required: false, description: 'Creator agent id or name.' },
    { name: 'priority', type: 'low | medium | high | urgent', required: false, description: 'Task priority.' },
    { name: 'dependsOnTaskIds', type: 'string[]', required: false, description: 'Task IDs that must be complete before this task is ready.' },
    { name: 'readinessRules', type: 'TaskReadinessRule[]', required: false, description: 'Machine-readable readiness rules, for example task_status checks on other tasks.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.taskService || !context.projectService || !context.agentService) {
      return unavailableTool('task.update', 'task.update requires task, project, and agent services');
    }

    const taskId = asNonEmptyString(argumentsMap.taskId);
    if (!taskId) {
      return invalidArguments('task.update', 'taskId is required');
    }

    const existingTask = await context.taskService.getTask(taskId);
    if(!existingTask) {
      return {
        ok: false,
        toolName: 'task.update',
        error: {
          code: 'task_not_found',
          message: `No task found with id ${taskId}.`
        }
      };
    }
    
    const title = asNonEmptyString(argumentsMap.title) ?? existingTask.title;
    const description = asTextString(argumentsMap.description) ?? existingTask.description;
    const projectId = await resolveProjectReference({
      candidate: asNonEmptyString(argumentsMap.projectId),
      fallbackProjectId: existingTask.projectId,
      context
    });
    const assigneeAgentId = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.assigneeAgentId),
      fallbackAgentId: existingTask.assigneeAgentId,
      context
    });
    const createdBy = await resolveAgentReference({
      candidate: asNonEmptyString(argumentsMap.createdBy),
      fallbackAgentId: existingTask.createdBy,
      context
    });
    const priority = asTaskPriority(argumentsMap.priority) ?? existingTask.priority;
    const dependsOnTaskIds = asStringArray(argumentsMap.dependsOnTaskIds);
    const readinessRules = asTaskReadinessRules(argumentsMap.readinessRules);

    if (argumentsMap.dependsOnTaskIds !== undefined && dependsOnTaskIds === undefined) {
      return invalidArguments('task.update', 'dependsOnTaskIds must be a string array or comma-separated string');
    }

    if (argumentsMap.readinessRules !== undefined && readinessRules === undefined) {
      return invalidArguments('task.update', 'readinessRules must be a JSON array of supported readiness rules');
    }

    const task = await context.taskService.updateTask(taskId, {
      title,
      description,
      projectId,
      assigneeAgentId,
      createdBy: createdBy ?? existingTask.createdBy,
      priority,
      dependsOnTaskIds,
      readinessRules
    });

    if(!task) {
      return {
        ok: false,
        toolName: 'task.update',
        error: {
          code: 'task_update_failed',
          message: `Failed to update task with id ${taskId}.`
        }
      };
    }

    return {
      ok: true,
      toolName: 'task.update',
      output: {
        title: task.title,
        projectId: task.projectId,
        assigneeAgentId: task.assigneeAgentId,
        createdBy: task.createdBy,
        priority: task.priority,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt           
      }
    };
  }
};

function asTaskPriority(value: unknown): TaskPriority | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent' ? value : undefined;
}

async function resolveProjectReference(input: {
  candidate?: string;
  fallbackProjectId: string;
  context: Parameters<ServerToolDefinition['execute']>[1];
}): Promise<string> {
  if (!input.candidate) {
    return input.fallbackProjectId;
  }

  const projects = await input.context.projectService!.listProjects();
  const normalized = input.candidate.trim().toLowerCase();
  const matched = projects.find(
    (project) =>
      project.id.trim().toLowerCase() === normalized || project.name.trim().toLowerCase() === normalized
  );

  return matched?.id ?? input.fallbackProjectId;
}

async function resolveAgentReference(input: {
  candidate?: string;
  fallbackAgentId: string | null;
  context: Parameters<ServerToolDefinition['execute']>[1];
}): Promise<string | null> {
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
