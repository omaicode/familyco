import type { AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { toolNameParamsSchema } from './tool-management.schema.js';
import type { ToolManagementService } from './tool-management.service.js';

export interface ToolManagementModuleDeps {
  toolsService: ToolManagementService;
  auditService: AuditService;
}

export function registerToolManagementController(app: FastifyInstance, deps: ToolManagementModuleDeps): void {
  app.get('/tools', async (request) => {
    requireMinimumLevel(request, 'L0');
    return deps.toolsService.list();
  });

  app.get('/tools/:name', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { name } = toolNameParamsSchema.parse(request.params);
    const tool = await deps.toolsService.getByName(name);
    if (!tool) {
      throw withStatusCode(new Error(`TOOL_NOT_FOUND:${name}`), 404);
    }

    return tool;
  });

  app.post('/tools/:name/enable', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { name } = toolNameParamsSchema.parse(request.params);
    const tool = await deps.toolsService.enable(name);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'tools.enable',
      targetId: tool.name,
      payload: {
        name: tool.name,
        source: tool.source,
        pluginId: tool.pluginId
      }
    });

    return tool;
  });

  app.post('/tools/:name/disable', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { name } = toolNameParamsSchema.parse(request.params);
    const tool = await deps.toolsService.disable(name);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'tools.disable',
      targetId: tool.name,
      payload: {
        name: tool.name,
        source: tool.source,
        pluginId: tool.pluginId
      }
    });

    return tool;
  });
}

function withStatusCode(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}
