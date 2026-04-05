import type { ApprovalService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import {
  createApprovalSchema,
  decideApprovalBodySchema,
  decideApprovalParamsSchema
} from './approval.schema.js';

export interface ApprovalModuleDeps {
  approvalService: ApprovalService;
}

export function registerApprovalController(app: FastifyInstance, deps: ApprovalModuleDeps): void {
  app.get('/approvals', async () => {
    return deps.approvalService.listApprovalRequests();
  });

  app.post('/approvals', async (request, reply) => {
    const body = createApprovalSchema.parse(request.body);
    const approvalRequest = await deps.approvalService.createApprovalRequest(body);

    reply.code(201);
    return approvalRequest;
  });

  app.post('/approvals/:id/decision', async (request) => {
    const { id } = decideApprovalParamsSchema.parse(request.params);
    const { status } = decideApprovalBodySchema.parse(request.body);

    return deps.approvalService.decideApproval({ id, status });
  });
}
