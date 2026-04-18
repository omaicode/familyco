import {
  ApprovalGuard,
  type AgentService,
  type ApprovalService,
  type AuditRecord,
  type AuditService,
  type EventBus,
  type ProjectService,
  type QueueService,
  type SettingsService,
  type TaskService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { resolveDefaultProjectId, resolveExecutiveAgentId } from '../shared/defaults.js';
import {
  bulkUpdateTasksSchema,
  createTaskCommentBodySchema,
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskBodySchema,
  updateTaskPriorityBodySchema,
  updateTaskPriorityParamsSchema,
  updateTaskStatusBodySchema,
  updateTaskStatusParamsSchema
} from './task.schema.js';

export interface TaskModuleDeps {
  taskService: TaskService;
  agentService: AgentService;
  projectService: ProjectService;
  settingsService: SettingsService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
  queueService: QueueService;
  eventBus?: EventBus;
}

export function registerTaskController(app: FastifyInstance, deps: TaskModuleDeps): void {
  app.get('/tasks', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { projectId, status, priority, assigneeAgentId, q } = listTasksQuerySchema.parse(request.query);
    return deps.taskService.listTasks({
      projectId,
      status,
      priority,
      assigneeAgentId,
      query: q
    });
  });

  app.get('/tasks/:id', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    return deps.taskService.getTask(id);
  });

  app.post('/tasks', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = createTaskSchema.parse(request.body);
    const executiveAgentId = await resolveExecutiveAgentId({
      agentService: deps.agentService,
      settingsService: deps.settingsService
    });
    const projectId =
      body.projectId ??
      (await resolveDefaultProjectId({
        agentService: deps.agentService,
        projectService: deps.projectService,
        settingsService: deps.settingsService
      }));
    const normalizedInput = {
      title: body.title,
      description: body.description,
      projectId,
      assigneeAgentId: body.assigneeAgentId ?? body.assignedToId ?? executiveAgentId,
      createdBy: body.createdBy ?? executiveAgentId,
      priority: body.priority,
      dependsOnTaskIds: body.dependsOnTaskIds,
      readinessRules: body.readinessRules
    };

    try {
      await deps.projectService.getProjectById(normalizedInput.projectId);
    } catch {
      reply.code(404);
      return {
        statusCode: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.'
      };
    }

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.create',
      targetId: normalizedInput.projectId,
      payload: {
        ...normalizedInput,
        dependsOnTaskIds: body.dependsOnTaskIds,
        readinessRules: body.readinessRules,
        dueAt: body.dueAt
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? normalizedInput.createdBy,
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'task.create'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const task = await deps.taskService.createTask(normalizedInput);
    await deps.auditService.write({
      actorId: normalizedInput.createdBy,
      action: 'task.create',
      targetId: task.id,
      payload: {
        projectId: task.projectId,
        priority: task.priority,
        assigneeAgentId: task.assigneeAgentId,
        dependsOnTaskIds: task.dependsOnTaskIds,
        readinessRules: task.readinessRules,
        dueAt: body.dueAt
      }
    });

    await enqueueTaskExecutionIfReady(deps, task);

    reply.code(201);
    return task;
  });

  app.patch('/tasks/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    const body = updateTaskBodySchema.parse(request.body);
    const executiveAgentId = await resolveExecutiveAgentId({
      agentService: deps.agentService,
      settingsService: deps.settingsService
    });
    const normalizedInput = {
      ...body,
      assigneeAgentId: body.assigneeAgentId ?? executiveAgentId
    };

    try {
      await deps.projectService.getProjectById(normalizedInput.projectId);
    } catch {
      reply.code(404);
      return {
        statusCode: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.'
      };
    }

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.update',
      targetId: id,
      payload: normalizedInput
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const updatedTask = await deps.taskService.updateTask(id, normalizedInput);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? normalizedInput.createdBy,
      action: 'task.update',
      targetId: updatedTask.id,
      payload: {
        title: updatedTask.title,
        projectId: updatedTask.projectId,
        priority: updatedTask.priority,
        assigneeAgentId: updatedTask.assigneeAgentId,
        dependsOnTaskIds: updatedTask.dependsOnTaskIds,
        readinessRules: updatedTask.readinessRules
      }
    });

    await enqueueTaskExecutionIfReady(deps, updatedTask);

    return updatedTask;
  });

  app.get('/tasks/:id/comments', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    await deps.taskService.getTask(id);

    const records = await deps.auditService.list({
      action: 'task.comment.added',
      targetId: id,
      limit: 100
    });

    return records
      .map(toTaskComment)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  });

  app.post('/tasks/:id/comments', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    const body = createTaskCommentBodySchema.parse(request.body);
    await deps.taskService.getTask(id);

    const comment = await deps.auditService.write({
      actorId: body.authorId,
      action: 'task.comment.added',
      targetId: id,
      payload: {
        body: body.body,
        authorType: body.authorType,
        authorLabel: body.authorLabel ?? body.authorId
      }
    });

    deps.eventBus?.emit('task.comment.added', {
      taskId: id,
      authorId: body.authorId,
      authorType: body.authorType,
      authorLabel: body.authorLabel ?? body.authorId,
      body: body.body,
      commentId: comment.id
    });

    reply.code(201);
    return toTaskComment(comment);
  });

  app.get('/tasks/:id/activity', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);
    await deps.taskService.getTask(id);

    const ACTIVITY_ACTIONS = [
      'task.comment.added',
      'task.session.checkpoint',
      'approval.request.create',
      'approval.request.created',
      'approval.request.decide',
      'approval.request.decided',
      'task.status.changed',
      'task.assigned'
    ];

    const allRecords = await Promise.all(
      ACTIVITY_ACTIONS.map((action) =>
        deps.auditService.list({ action, targetId: id, limit: 200 })
      )
    );

    const merged = allRecords
      .flat()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return merged.map(toTaskActivity);
  });

  app.delete('/tasks/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = taskIdParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.delete',
      targetId: id,
      payload: {
        taskId: id
      }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const deletedTask = await deps.taskService.deleteTask(id);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.delete',
      targetId: deletedTask.id,
      payload: {
        projectId: deletedTask.projectId,
        title: deletedTask.title
      }
    });

    return {
      id: deletedTask.id
    };
  });

  app.post('/tasks/bulk', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = bulkUpdateTasksSchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.bulk.update',
      targetId: body.taskIds.join(','),
      payload: body
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const updatedTasks = await deps.taskService.bulkUpdateTasks(body);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.bulk.update',
      targetId: body.taskIds.join(','),
      payload: body
    });

    return updatedTasks;
  });

  app.post('/tasks/:id/status', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = updateTaskStatusParamsSchema.parse(request.params);
    const { status } = updateTaskStatusBodySchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.status.update',
      targetId: id,
      payload: {
        status
      }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const updatedTask = await deps.taskService.updateTaskStatus(id, status, {
      source: 'human',
      actorId: request.authContext?.subject ?? 'founder'
    });
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.status.update',
      targetId: updatedTask.id,
      payload: {
        status: updatedTask.status
      }
    });

    if (
      (status === 'in_progress' || status === 'pending') &&
      updatedTask.assigneeAgentId
    ) {
      await enqueueTaskExecutionIfReady(deps, updatedTask);
    }

    return updatedTask;
  });

  app.post('/tasks/:id/priority', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = updateTaskPriorityParamsSchema.parse(request.params);
    const { priority } = updateTaskPriorityBodySchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'task.priority.update',
      targetId: id,
      payload: {
        priority
      }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const updatedTask = await deps.taskService.updateTaskPriority(id, priority);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'task.priority.update',
      targetId: updatedTask.id,
      payload: {
        priority: updatedTask.priority
      }
    });

    return updatedTask;
  });
}

async function enqueueTaskExecutionIfReady(
  deps: TaskModuleDeps,
  task: Awaited<ReturnType<TaskService['getTask']>>
): Promise<void> {
  if (!task.assigneeAgentId) {
    return;
  }

  const readiness = await deps.taskService.evaluateTaskReadiness(task.id).catch(() => null);
  if (!readiness?.ready) {
    return;
  }

  await deps.queueService.enqueue({
    type: 'task.execute',
    payload: { agentId: task.assigneeAgentId }
  }).catch(() => undefined);
}

function toTaskComment(record: AuditRecord) {
  const payload = record.payload ?? {};
  const body = typeof payload.body === 'string' ? payload.body : '';
  const authorType = payload.authorType === 'agent' ? 'agent' : 'human';
  const authorLabel = typeof payload.authorLabel === 'string' && payload.authorLabel.length > 0
    ? payload.authorLabel
    : record.actorId;

  return {
    id: record.id,
    taskId: record.targetId ?? '',
    body,
    authorId: record.actorId,
    authorType,
    authorLabel,
    createdAt: record.createdAt.toISOString()
  };
}

function toTaskActivity(record: AuditRecord) {
  const payload = record.payload ?? {};
  const taskId = record.targetId ?? '';
  const actorLabel = typeof payload.actorLabel === 'string' && payload.actorLabel.length > 0
    ? payload.actorLabel
    : record.actorId;

  let kind: string;
  let summary: string;
  let extra: Record<string, unknown> = {};

  switch (record.action) {
    case 'task.comment.added': {
      const body = typeof payload.body === 'string' ? payload.body : '';
      kind = 'comment';
      summary = body;
      extra = { body };
      break;
    }
    case 'task.session.checkpoint': {
      const status = typeof payload.status === 'string' ? payload.status : 'active';
      const index = typeof payload.checkpointIndex === 'number' ? payload.checkpointIndex : 0;
      const sess = typeof payload.summary === 'string' ? payload.summary : '';
      const toolsUsed = Array.isArray(payload.toolsUsed)
        ? payload.toolsUsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
      const workspaceArtifacts = parseTaskWorkspaceArtifacts(payload.workspaceArtifacts);
      kind = 'session.checkpoint';
      summary = sess.length > 0 ? sess : `Checkpoint #${index} — ${status}`;
      extra = {
        checkpointIndex: index,
        sessionStatus: status,
        toolsUsed,
        ...(workspaceArtifacts.length > 0 ? { workspaceArtifacts } : {})
      };
      break;
    }
    case 'approval.request.create':
    case 'approval.request.created': {
      const action = typeof payload.action === 'string'
        ? payload.action
        : typeof payload.approvalAction === 'string'
          ? payload.approvalAction
          : '';
      const approvalId = typeof payload.approvalId === 'string'
        ? payload.approvalId
        : typeof payload.requestId === 'string'
          ? payload.requestId
          : typeof record.targetId === 'string' && record.targetId.length > 0 && record.targetId !== taskId
            ? record.targetId
            : undefined;
      const detailSummary = typeof payload.summary === 'string' ? payload.summary : undefined;
      kind = 'approval.created';
      summary = detailSummary ?? (action.length > 0 ? `Approval requested: ${action}` : 'Approval requested');
      extra = {
        approvalAction: action || undefined,
        approvalId,
        detailSummary
      };
      break;
    }
    case 'approval.request.decide':
    case 'approval.request.decided': {
      const decision = payload.decision === 'approved' || payload.decision === 'rejected'
        ? payload.decision
        : payload.status === 'approved' || payload.status === 'rejected'
          ? payload.status
        : undefined;
      const approvalId = typeof payload.approvalId === 'string'
        ? payload.approvalId
        : typeof record.targetId === 'string' && record.targetId.length > 0 && record.targetId !== taskId
          ? record.targetId
          : undefined;
      const detailSummary = typeof payload.summary === 'string' ? payload.summary : undefined;
      const decisionNote = typeof payload.note === 'string'
        ? payload.note
        : typeof payload.reason === 'string'
          ? payload.reason
          : undefined;
      kind = 'approval.decided';
      summary = detailSummary ?? (decision ? `Approval ${decision}` : 'Approval decided');
      extra = {
        approvalDecision: decision,
        approvalId,
        decisionNote,
        detailSummary
      };
      break;
    }
    case 'task.status.changed': {
      const from = typeof payload.from === 'string' ? payload.from : '';
      const to = typeof payload.to === 'string' ? payload.to : '';
      kind = 'status.changed';
      summary = from && to ? `Status: ${from} → ${to}` : 'Status changed';
      break;
    }
    case 'task.assigned': {
      const assignee = typeof payload.assigneeId === 'string' ? payload.assigneeId : '';
      kind = 'assigned';
      summary = assignee ? `Assigned to ${assignee}` : 'Task assigned';
      break;
    }
    default:
      kind = 'comment';
      summary = record.action;
  }

  return {
    id: record.id,
    kind,
    taskId,
    actorId: record.actorId,
    actorLabel,
    summary,
    createdAt: record.createdAt.toISOString(),
    ...extra
  };
}

function parseTaskWorkspaceArtifacts(input: unknown): Array<{
  path: string;
  action: 'created' | 'updated';
  contentPreview?: string;
  contentTruncated?: boolean;
}> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }

    const path = typeof entry.path === 'string' ? entry.path.trim() : '';
    const action = entry.action === 'updated' ? 'updated' : entry.action === 'created' ? 'created' : null;
    if (!path || action === null) {
      return [];
    }

    const contentPreview = typeof entry.contentPreview === 'string' && entry.contentPreview.length > 0
      ? entry.contentPreview
      : undefined;
    const contentTruncated = entry.contentTruncated === true ? true : undefined;

    return [{
      path,
      action,
      ...(contentPreview ? { contentPreview } : {}),
      ...(contentTruncated ? { contentTruncated } : {})
    }];
  });
}
