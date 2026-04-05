import type { ApprovalService, AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import {
  createApprovalSchema,
  decideApprovalBodySchema,
  decideApprovalParamsSchema
} from './approval.schema.js';

export interface ApprovalModuleDeps {
  approvalService: ApprovalService;
  auditService: AuditService;
}

export function registerApprovalController(app: FastifyInstance, deps: ApprovalModuleDeps): void {
  app.get('/approvals', async (request) => {
    requireMinimumLevel(request, 'L1');
    return deps.approvalService.listApprovalRequests();
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

    reply.code(201);
    return approvalRequest;
  });

  app.post('/approvals/:id/decision', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = decideApprovalParamsSchema.parse(request.params);
    const { status } = decideApprovalBodySchema.parse(request.body);
    const approvalRequest = await deps.approvalService.decideApproval({ id, status });
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'approval.request.decide',
      targetId: approvalRequest.id,
      payload: {
        status: approvalRequest.status
      }
    });

    return approvalRequest;
  });
}
