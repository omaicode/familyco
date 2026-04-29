import type { AuditService, CronService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { resolveExecutiveAgentId } from '../shared/defaults.js';
import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { createCronBodySchema, cronParamsSchema, listCronRunsQuerySchema, updateCronBodySchema } from './cron.schema.js';

export interface CronModuleDeps {
  cronService: CronService;
  auditService: AuditService;
  settingsService: import('@familyco/core').SettingsService;
  agentService: import('@familyco/core').AgentService;
}

export function registerCronController(app: FastifyInstance, deps: CronModuleDeps): void {
  app.get('/cron', async (request) => {
    requireMinimumLevel(request, 'L0');
    return deps.cronService.listJobs();
  });

  app.get('/cron/:id/history', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = cronParamsSchema.parse(request.params);
    const { limit } = listCronRunsQuerySchema.parse(request.query);
    return deps.cronService.listRuns(id, limit ?? 50);
  });

  app.post('/cron', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = createCronBodySchema.parse(request.body ?? {});
    const schedule = body.schedule.trim();
    deps.cronService.parseSchedule(schedule);

    const agentId = body.agentId ?? await resolveExecutiveAgentId({
      agentService: deps.agentService,
      settingsService: deps.settingsService
    });

    const created = await deps.cronService.createJob({
      name: body.name,
      prompt: body.prompt,
      schedule,
      agentId,
      enabled: body.enabled
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'founder',
      action: 'cron.create',
      targetId: created.id,
      payload: {
        cronId: created.id,
        name: created.name,
        schedule: created.schedule,
        agentId: created.agentId
      }
    });

    reply.code(201);
    return created;
  });

  app.patch('/cron/:id', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = cronParamsSchema.parse(request.params);
    const body = updateCronBodySchema.parse(request.body ?? {});
    if (body.schedule !== undefined) {
      deps.cronService.parseSchedule(body.schedule);
    }

    const updated = await deps.cronService.updateJob(id, body);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'founder',
      action: 'cron.update',
      targetId: updated.id,
      payload: {
        cronId: updated.id,
        name: updated.name,
        schedule: updated.schedule,
        enabled: updated.enabled
      }
    });
    return updated;
  });

  app.delete('/cron/:id', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = cronParamsSchema.parse(request.params);
    const deleted = await deps.cronService.deleteJob(id);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'founder',
      action: 'cron.delete',
      targetId: id,
      payload: {
        cronId: id
      }
    });
    return deleted;
  });
}
