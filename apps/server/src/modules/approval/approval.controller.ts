import type {
  AgentLevel,
  ApprovalRequest,
  ApprovalService,
  AuditService,
  InboxService,
  ProjectService,
  SettingsService,
  TaskPriority,
  TaskService,
  TaskStatus,
  AgentService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { resolveDefaultProjectId, resolveExecutiveAgentId } from '../shared/defaults.js';
import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import {
  createApprovalSchema,
  decideApprovalBodySchema,
  decideApprovalParamsSchema
} from './approval.schema.js';
import type {
  TaskSessionCheckpoint,
  TaskSessionRepository,
  TaskSessionStatus
} from '../../runtime/task-session.store.js';

export interface ApprovalModuleDeps {
  approvalService: ApprovalService;
  agentService: AgentService;
  projectService: ProjectService;
  settingsService: SettingsService;
  taskService: TaskService;
  auditService: AuditService;
  inboxService: InboxService;
  sessionStore?: TaskSessionRepository;
}

export function registerApprovalController(app: FastifyInstance, deps: ApprovalModuleDeps): void {
  app.get('/approvals', async (request) => {
    requireMinimumLevel(request, 'L1');
    const approvals = await deps.approvalService.listApprovalRequests();

    return Promise.all(
      approvals.map(async (approvalRequest) => {
        const taskId = resolveRelatedTaskId(approvalRequest);
        const taskTitle = taskId
          ? await deps.taskService.getTask(taskId).then((task) => task.title).catch(() => undefined)
          : undefined;

        return {
          ...approvalRequest,
          taskId: taskId ?? undefined,
          taskTitle,
          requestSummary: readApprovalSummary(approvalRequest)
        };
      })
    );
  });

  app.post('/approvals', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = createApprovalSchema.parse(request.body);
    const approvalRequest = await deps.approvalService.createApprovalRequest(body);
    await deps.auditService.write({
      actorId: body.actorId,
      action: 'approval.request.create',
      targetId: approvalRequest.id,
      payload: {
        approvalAction: body.action,
        targetId: body.targetId
      }
    });

    const relatedTaskId = resolveRelatedTaskId(approvalRequest);
    if (relatedTaskId) {
      await deps.auditService.write({
        actorId: body.actorId,
        action: 'approval.request.created',
        targetId: relatedTaskId,
        payload: {
          approvalId: approvalRequest.id,
          action: approvalRequest.action,
          summary: readApprovalSummary(approvalRequest)
        }
      });
    }

    await deps.inboxService.createMessage({
      recipientId: 'founder',
      senderId: body.actorId,
      type: 'approval',
      title: `Approval requested: ${body.action}`,
      body: readApprovalSummary(approvalRequest),
      payload: {
        approvalId: approvalRequest.id,
        action: body.action,
        targetId: body.targetId,
        taskId: relatedTaskId ?? undefined
      }
    });

    reply.code(201);
    return approvalRequest;
  });

  app.post('/approvals/:id/decision', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = decideApprovalParamsSchema.parse(request.params);
    const { status, note } = decideApprovalBodySchema.parse(request.body);
    const actorId = request.authContext?.subject ?? 'system';
    const approvalRequest = await deps.approvalService.decideApproval({ id, status });
    const executionResult =
      approvalRequest.status === 'approved'
        ? await executeApprovedAction(approvalRequest, deps)
        : null;

    const relatedTaskId = resolveRelatedTaskId(approvalRequest);

    // When an approval is granted for a task blocker, unblock the task so
    // the next heartbeat can pick it up and continue execution.
    if (approvalRequest.status === 'approved') {
      if (relatedTaskId) {
        const task = await deps.taskService.getTask(relatedTaskId).catch(() => null);
        if (task?.status === 'blocked') {
          await deps.taskService.updateTaskStatus(relatedTaskId, 'in_progress').catch(() => undefined);
        }
      }
    }

    if (relatedTaskId) {
      const checkpoint = await appendApprovalDecisionCheckpoint({
        approvalRequest,
        taskId: relatedTaskId,
        note,
        actorId,
        sessionStore: deps.sessionStore
      });

      if (checkpoint) {
        await deps.auditService.write({
          actorId,
          action: 'task.session.checkpoint',
          targetId: relatedTaskId,
          payload: {
            sessionId: checkpoint.sessionId,
            checkpointIndex: checkpoint.checkpointIndex,
            status: checkpoint.status,
            toolsUsed: checkpoint.lastToolNames,
            summary: checkpoint.summary
          }
        });
      }

      await deps.auditService.write({
        actorId,
        action: 'approval.request.decided',
        targetId: relatedTaskId,
        payload: {
          approvalId: approvalRequest.id,
          decision: approvalRequest.status,
          summary: readApprovalDecisionSummary(approvalRequest, note)
        }
      });
    }

    await deps.auditService.write({
      actorId,
      action: 'approval.request.decide',
      targetId: approvalRequest.id,
      payload: {
        status: approvalRequest.status,
        executedResourceId: executionResult?.resourceId ?? null,
        taskId: relatedTaskId,
        note: note ?? null
      }
    });

    await deps.inboxService.createMessage({
      recipientId: approvalRequest.actorId,
      senderId: request.authContext?.subject ?? 'founder',
      type: 'info',
      title: `Approval ${approvalRequest.status}`,
      body:
        executionResult?.message ??
        `Your approval request ${approvalRequest.id} is ${approvalRequest.status}.`,
      payload: {
        approvalId: approvalRequest.id,
        status: approvalRequest.status,
        executedResourceId: executionResult?.resourceId ?? null,
        taskId: relatedTaskId ?? undefined,
        note: note ?? undefined
      }
    });

    return approvalRequest;
  });
}

interface ApprovalExecutionResult {
  resourceId?: string;
  message: string;
}

interface AppendApprovalDecisionCheckpointInput {
  approvalRequest: ApprovalRequest;
  taskId: string;
  note?: string;
  actorId: string;
  sessionStore?: TaskSessionRepository;
}

async function appendApprovalDecisionCheckpoint(
  input: AppendApprovalDecisionCheckpointInput
): Promise<TaskSessionCheckpoint | null> {
  if (!input.sessionStore) {
    return null;
  }

  const now = new Date().toISOString();
  const existing = await input.sessionStore.load(input.taskId).catch(() => null);
  const baseCheckpoint: TaskSessionCheckpoint = existing ?? {
    taskId: input.taskId,
    agentId: input.approvalRequest.actorId,
    sessionId: randomUUID(),
    checkpointIndex: 0,
    status: 'active',
    summary: '',
    lastToolNames: [],
    toolResults: [],
    startedAt: now,
    updatedAt: now
  };

  const decisionStatus: TaskSessionStatus =
    input.approvalRequest.status === 'approved' ? 'active' : 'waiting_for_input';
  const decisionSummary = readApprovalDecisionSummary(input.approvalRequest, input.note, input.actorId);
  const mergedSummary = [baseCheckpoint.summary.trim(), decisionSummary]
    .filter((entry) => entry.length > 0)
    .join('\n');
  const nextToolNames = Array.from(new Set([...baseCheckpoint.lastToolNames, 'approval.decision']));
  const nextToolResults = [
    ...baseCheckpoint.toolResults,
    {
      toolName: 'approval.decision',
      ok: input.approvalRequest.status === 'approved',
      output: input.approvalRequest.status === 'approved' ? decisionSummary : undefined,
      error: input.approvalRequest.status === 'rejected' ? decisionSummary : undefined
    }
  ];

  const nextCheckpoint: TaskSessionCheckpoint = {
    ...baseCheckpoint,
    checkpointIndex: baseCheckpoint.checkpointIndex + 1,
    status: decisionStatus,
    summary: mergedSummary.slice(0, 2_000),
    lastToolNames: nextToolNames,
    toolResults: nextToolResults,
    updatedAt: now
  };

  await input.sessionStore.save(nextCheckpoint);
  return nextCheckpoint;
}

async function executeApprovedAction(
  approvalRequest: ApprovalRequest,
  deps: ApprovalModuleDeps
): Promise<ApprovalExecutionResult | null> {
  const payload = approvalRequest.payload ?? {};

  switch (approvalRequest.action) {
    case 'create_agent':
    case 'agent.create': {
      const level = readAgentLevel(payload, 'level');
      const name = readString(payload, 'name');
      const role = readString(payload, 'role');
      const department = readString(payload, 'department');
      const parentAgentId = readNullableString(payload, 'parentAgentId');

      if (!level || !name || !role || !department) {
        return null;
      }

      const createdAgent = await deps.agentService.createFromApproval({
        name,
        role,
        level,
        department,
        parentAgentId: level === 'L0' ? null : parentAgentId
      });

      return {
        resourceId: createdAgent.id,
        message: `${createdAgent.name} has been created and added to the agent hierarchy.`
      };
    }

    case 'agent.pause': {
      if (!approvalRequest.targetId) {
        return null;
      }

      const pausedAgent = await deps.agentService.pauseAgent(approvalRequest.targetId);
      return {
        resourceId: pausedAgent.id,
        message: `${pausedAgent.name} is now paused.`
      };
    }

    case 'project.create': {
      const name = readString(payload, 'name');
      const description = readString(payload, 'description');
      const ownerAgentId = readString(payload, 'ownerAgentId');
      const parentProjectId = readNullableString(payload, 'parentProjectId');

      if (!name || !description || !ownerAgentId) {
        return null;
      }

      const createdProject = await deps.projectService.createProject({
        name,
        description,
        ownerAgentId,
        parentProjectId
      });

      return {
        resourceId: createdProject.id,
        message: `Project ${createdProject.name} has been created.`
      };
    }

    case 'project.update': {
      const name = readString(payload, 'name');
      const description = readString(payload, 'description');
      const ownerAgentId = readString(payload, 'ownerAgentId');
      const parentProjectId = readNullableString(payload, 'parentProjectId');

      if (!approvalRequest.targetId || !name || !description || !ownerAgentId) {
        return null;
      }

      const updatedProject = await deps.projectService.updateProject(approvalRequest.targetId, {
        name,
        description,
        ownerAgentId,
        parentProjectId
      });

      return {
        resourceId: updatedProject.id,
        message: `Project ${updatedProject.name} has been updated.`
      };
    }

    case 'project.delete': {
      if (!approvalRequest.targetId) {
        return null;
      }

      const deletedProject = await deps.projectService.deleteProject(approvalRequest.targetId);
      return {
        resourceId: deletedProject.id,
        message: `Project ${deletedProject.name} has been deleted.`
      };
    }

    case 'task.create': {
      const title = readString(payload, 'title');
      const description = readString(payload, 'description');
      const executiveAgentId = await resolveExecutiveAgentId({
        agentService: deps.agentService,
        settingsService: deps.settingsService
      });
      const projectId =
        readString(payload, 'projectId') ??
        (await resolveDefaultProjectId({
          agentService: deps.agentService,
          projectService: deps.projectService,
          settingsService: deps.settingsService
        }));
      const assigneeAgentId = readNullableString(payload, 'assigneeAgentId') ?? executiveAgentId;
      const createdBy = readString(payload, 'createdBy') ?? executiveAgentId;
      const priority = readTaskPriority(payload, 'priority');

      if (!title || !description) {
        return null;
      }

      const createdTask = await deps.taskService.createTask({
        title,
        description,
        projectId,
        assigneeAgentId,
        createdBy,
        priority: priority ?? undefined
      });

      return {
        resourceId: createdTask.id,
        message: `Task ${createdTask.title} has been created and queued for the assigned agent.`
      };
    }

    case 'task.status.update': {
      const status = readTaskStatus(payload, 'status');
      if (!approvalRequest.targetId || !status) {
        return null;
      }

      const updatedTask = await deps.taskService.updateTaskStatus(approvalRequest.targetId, status);
      return {
        resourceId: updatedTask.id,
        message: `Task ${updatedTask.title} moved to ${updatedTask.status}.`
      };
    }

    case 'task.priority.update': {
      const priority = readTaskPriority(payload, 'priority');
      if (!approvalRequest.targetId || !priority) {
        return null;
      }

      const updatedTask = await deps.taskService.updateTaskPriority(approvalRequest.targetId, priority);
      return {
        resourceId: updatedTask.id,
        message: `Task ${updatedTask.title} priority is now ${updatedTask.priority}.`
      };
    }

    case 'task.bulk.update': {
      const taskIds = readStringArray(payload, 'taskIds');
      const action = readString(payload, 'action');
      const status = readTaskStatus(payload, 'status');
      const priority = readTaskPriority(payload, 'priority');

      if (taskIds.length === 0 || (action !== 'update_status' && action !== 'update_priority')) {
        return null;
      }

      await deps.taskService.bulkUpdateTasks({
        taskIds,
        action,
        status: status ?? undefined,
        priority: priority ?? undefined
      });

      return {
        message: `${taskIds.length} queued task updates have been applied.`
      };
    }

    default:
      return null;
  }
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === null) {
    return null;
  }

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function readAgentLevel(payload: Record<string, unknown>, key: string): AgentLevel | null {
  const value = payload[key];
  return value === 'L0' || value === 'L1' || value === 'L2' ? value : null;
}

function readTaskStatus(payload: Record<string, unknown>, key: string): TaskStatus | null {
  const value = payload[key];
  return value === 'pending' ||
    value === 'in_progress' ||
    value === 'review' ||
    value === 'done' ||
    value === 'blocked' ||
    value === 'cancelled'
    ? value
    : null;
}

function readTaskPriority(payload: Record<string, unknown>, key: string): TaskPriority | null {
  const value = payload[key];
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent'
    ? value
    : null;
}

function resolveRelatedTaskId(approvalRequest: ApprovalRequest): string | null {
  const payloadTaskId = readString(approvalRequest.payload ?? {}, 'taskId');
  if (payloadTaskId) {
    return payloadTaskId;
  }

  if (approvalRequest.action.startsWith('task.') && approvalRequest.targetId) {
    return approvalRequest.targetId;
  }

  return null;
}

function readApprovalSummary(approvalRequest: ApprovalRequest): string {
  const payload = approvalRequest.payload ?? {};
  const reason = readString(payload, 'reason') ?? readString(payload, 'note');
  const taskId = resolveRelatedTaskId(approvalRequest);

  if (reason && taskId) {
    return `${reason} (Task: ${taskId})`;
  }

  if (reason) {
    return reason;
  }

  if (taskId) {
    return `Approval requested for task ${taskId}.`;
  }

  if (approvalRequest.targetId) {
    return `Approval requested for ${approvalRequest.action} on ${approvalRequest.targetId}.`;
  }

  return `Approval requested for ${approvalRequest.action}.`;
}

function readApprovalDecisionSummary(
  approvalRequest: ApprovalRequest,
  note?: string,
  actorId?: string
): string {
  const taskId = resolveRelatedTaskId(approvalRequest);
  const actorSuffix = actorId ? ` by ${actorId}` : '';
  const taskSuffix = taskId ? ` for task ${taskId}` : '';
  const noteSuffix = note && note.trim().length > 0 ? ` Note: ${note.trim()}` : '';
  return `Approval ${approvalRequest.status}${taskSuffix}${actorSuffix}.${noteSuffix}`.trim();
}
