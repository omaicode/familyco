import type { AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { listAuditQuerySchema } from './audit.schema.js';

export interface AuditModuleDeps {
  auditService: AuditService;
}

export function registerAuditController(app: FastifyInstance, deps: AuditModuleDeps): void {
  app.get('/audit', async (request) => {
    requireMinimumLevel(request, 'L0');
    const query = listAuditQuerySchema.parse(request.query);
    return deps.auditService.list(query);
  });
}
