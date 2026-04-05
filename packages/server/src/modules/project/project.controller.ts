import { ApprovalGuard, type ApprovalService, type AuditService, type ProjectService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import { createProjectSchema } from './project.schema.js';

export interface ProjectModuleDeps {
  projectService: ProjectService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
}

export function registerProjectController(app: FastifyInstance, deps: ProjectModuleDeps): void {
  app.get('/projects', async (request) => {
    requireMinimumLevel(request, 'L1');
    return deps.projectService.listProjects();
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
        ownerAgentId: body.ownerAgentId,
        name: body.name
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
}
