import type { AuditService, PluginService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { pluginParamsSchema, pluginUpdateApprovalSchema } from './plugin.schema.js';
import type { PluginLoaderService } from './plugin-loader.service.js';

export interface PluginsModuleDeps {
  pluginService: PluginService;
  pluginLoader: PluginLoaderService;
  auditService: AuditService;
  onPluginsRefreshed?: () => Promise<void>;
}

export function registerPluginsController(app: FastifyInstance, deps: PluginsModuleDeps): void {
  /** List all plugins (discovered, enabled, disabled, error). */
  app.get('/plugins', async (request) => {
    requireMinimumLevel(request, 'L0');
    const plugins = await deps.pluginService.list();
    return { items: plugins.map((p) => ({ ...p, isDefault: deps.pluginLoader.isDefault(p.id) })) };
  });

  /** Get a single plugin by id. */
  app.get('/plugins/:id', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pluginParamsSchema.parse(request.params);
    const plugin = await deps.pluginService.getById(id);
    if (!plugin) {
      throw withStatusCode(new Error(`PLUGIN_NOT_FOUND:${id}`), 404);
    }
    return { ...plugin, isDefault: deps.pluginLoader.isDefault(id) };
  });

  /** Re-scan the plugins/ directory for new or changed plugins. */
  app.post('/plugins/discover', async (request) => {
    requireMinimumLevel(request, 'L0');
    const result = await deps.pluginLoader.discover();
    await deps.onPluginsRefreshed?.();

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'plugin.discover',
      payload: result
    });

    return result;
  });

  /** Enable a plugin. */
  app.post('/plugins/:id/enable', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pluginParamsSchema.parse(request.params);
    const plugin = await deps.pluginService.enable(id);
    await deps.pluginLoader.refreshRegistry();
    await deps.onPluginsRefreshed?.();

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'plugin.enable',
      targetId: plugin.id,
      payload: { id: plugin.id, name: plugin.name }
    });

    return plugin;
  });

  /** Disable a plugin. */
  app.post('/plugins/:id/disable', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pluginParamsSchema.parse(request.params);

    if (deps.pluginLoader.isDefault(id)) {
      throw withStatusCode(
        new Error(`PLUGIN_IS_DEFAULT:${id}`),
        403
      );
    }

    const plugin = await deps.pluginService.disable(id);
    await deps.pluginLoader.refreshRegistry();
    await deps.onPluginsRefreshed?.();

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'plugin.disable',
      targetId: plugin.id,
      payload: { id: plugin.id, name: plugin.name }
    });

    return plugin;
  });

  /** Update the approval mode for a plugin. */
  app.patch('/plugins/:id/approval', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pluginParamsSchema.parse(request.params);
    const { approvalMode } = pluginUpdateApprovalSchema.parse(request.body);

    const plugin = await deps.pluginService.update({ id, approvalMode });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'plugin.approval_mode.updated',
      targetId: plugin.id,
      payload: { id: plugin.id, approvalMode }
    });

    return plugin;
  });
}

function withStatusCode(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}
