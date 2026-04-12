import type { AuditService, SettingsService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { settingParamsSchema, upsertSettingSchema } from './settings.schema.js';

export interface SettingsModuleDeps {
  settingsService: SettingsService;
  auditService: AuditService;
}

export function registerSettingsController(app: FastifyInstance, deps: SettingsModuleDeps): void {
  app.get('/settings', async (request) => {
    requireMinimumLevel(request, 'L0');
    return deps.settingsService.list();
  });

  app.get('/settings/:key', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { key } = settingParamsSchema.parse(request.params);
    const setting = await deps.settingsService.get(key);
    if (!setting) {
      throw new Error(`SETTING_NOT_FOUND:${key}`);
    }

    return setting;
  });

  app.post('/settings', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = upsertSettingSchema.parse(request.body);
    const setting = await deps.settingsService.upsert(body);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'settings.upsert',
      targetId: body.key,
      payload: {
        key: body.key
      }
    });

    reply.code(201);
    return setting;
  });
}
