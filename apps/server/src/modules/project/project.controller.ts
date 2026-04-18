import { ApprovalGuard, type ApprovalService, type AuditService, type ProjectService, type SettingsService, type TaskService } from '@familyco/core';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { createProjectSchema, projectParamsSchema, updateProjectSchema } from './project.schema.js';
import { ensureProjectWorkspaceDir } from './workspace-dir.js';

export interface ProjectModuleDeps {
  projectService: ProjectService;
  taskService: TaskService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
  settingsService: SettingsService;
}

export function registerProjectController(app: FastifyInstance, deps: ProjectModuleDeps): void {
  app.get('/projects', async (request) => {
    requireMinimumLevel(request, 'L1');
    return deps.projectService.listProjects();
  });

  app.get('/projects/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = projectParamsSchema.parse(request.params);

    try {
      return await deps.projectService.getProjectById(id);
    } catch (error) {
      return sendProjectError(reply, error);
    }
  });

  app.post('/projects', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = createProjectSchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'project.create',
      targetId: body.parentProjectId ?? undefined,
      payload: {
        name: body.name,
        description: body.description,
        ownerAgentId: body.ownerAgentId,
        parentProjectId: body.parentProjectId ?? null
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'project.create'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const project = await deps.projectService.createProject(body);

    const workspaceSetting = await deps.settingsService.get('workspace.path').catch(() => null);
    const dirPath = await ensureProjectWorkspaceDir(
      typeof workspaceSetting?.value === 'string' ? workspaceSetting.value : null,
      project.name
    ).catch(() => null);

    if (dirPath) {
      await deps.projectService.setProjectDirPath(project.id, dirPath).catch(() => undefined);
      project.dirPath = dirPath;
    }

    await deps.auditService.write({
      actorId: body.ownerAgentId,
      action: 'project.create',
      targetId: project.id,
      payload: {
        parentProjectId: project.parentProjectId
      }
    });

    reply.code(201);
    return project;
  });

  app.patch('/projects/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = projectParamsSchema.parse(request.params);
    const body = updateProjectSchema.parse(request.body);

    if (body.parentProjectId === id) {
      reply.code(400);
      return {
        statusCode: 400,
        code: 'PROJECT_INVALID_PARENT',
        message: 'A project cannot be its own parent.'
      };
    }

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'project.update',
      targetId: id,
      payload: {
        ...body,
        parentProjectId: body.parentProjectId ?? null
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'project.update',
          projectId: id
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    try {
      const project = await deps.projectService.updateProject(id, body);
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? body.ownerAgentId,
        action: 'project.update',
        targetId: project.id,
        payload: {
          ownerAgentId: project.ownerAgentId,
          parentProjectId: project.parentProjectId
        }
      });

      return project;
    } catch (error) {
      return sendProjectError(reply, error);
    }
  });

  app.delete('/projects/:id', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const { id } = projectParamsSchema.parse(request.params);

    const storedDefaultProjectId = await deps.settingsService.get('defaults.projectId').catch(() => null);
    if (storedDefaultProjectId?.value === id) {
      reply.code(400);
      return {
        statusCode: 400,
        code: 'PROJECT_DELETE_DEFAULT_FORBIDDEN',
        message: 'The default project cannot be deleted.'
      };
    }

    const [projects, linkedTasks] = await Promise.all([
      deps.projectService.listProjects(),
      deps.taskService.listProjectTasks(id)
    ]);
    const targetProject = projects.find((project) => project.id === id);

    if (!targetProject) {
      reply.code(404);
      return {
        statusCode: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.'
      };
    }

    const hasChildren = projects.some((project) => project.parentProjectId === id);
    if (linkedTasks.length > 0 || hasChildren) {
      reply.code(400);
      return {
        statusCode: 400,
        code: 'PROJECT_NOT_EMPTY',
        message: 'Only empty projects without sub-projects can be deleted.'
      };
    }

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'project.delete',
      targetId: id,
      payload: {
        projectId: id
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'project.delete',
          projectId: id
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    try {
      const deletedProject = await deps.projectService.deleteProject(id);
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'project.delete',
        targetId: deletedProject.id,
        payload: {
          name: deletedProject.name
        }
      });

      return { id: deletedProject.id };
    } catch (error) {
      return sendProjectError(reply, error);
    }
  });
}

function sendProjectError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
    reply.code(404);
    return {
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found.'
    };
  }

  if (error instanceof Error && error.message === 'PROJECT_NOT_EMPTY') {
    reply.code(400);
    return {
      statusCode: 400,
      code: 'PROJECT_NOT_EMPTY',
      message: 'Only empty projects without sub-projects can be deleted.'
    };
  }

  if (error instanceof Error && error.message === 'PROJECT_INVALID_PARENT') {
    reply.code(400);
    return {
      statusCode: 400,
      code: 'PROJECT_INVALID_PARENT',
      message: 'A project cannot be its own parent.'
    };
  }

  throw error;
}
