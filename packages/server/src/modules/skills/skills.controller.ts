import type { AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { skillParamsSchema } from './skills.schema.js';
import type { SkillsService } from './skills.service.js';

export interface SkillsModuleDeps {
  skillsService: SkillsService;
  auditService: AuditService;
}

export function registerSkillsController(app: FastifyInstance, deps: SkillsModuleDeps): void {
  app.get('/skills', async (request) => {
    requireMinimumLevel(request, 'L0');
    return deps.skillsService.list();
  });

  app.get('/skills/:id', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = skillParamsSchema.parse(request.params);
    const skill = await deps.skillsService.getById(id);
    if (!skill) {
      throw withStatusCode(new Error(`SKILL_NOT_FOUND:${id}`), 404);
    }

    return skill;
  });

  app.post('/skills/:id/enable', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = skillParamsSchema.parse(request.params);
    const skill = await deps.skillsService.enable(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'skills.enable',
      targetId: skill.id,
      payload: {
        id: skill.id
      }
    });

    return skill;
  });

  app.post('/skills/:id/disable', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = skillParamsSchema.parse(request.params);
    const skill = await deps.skillsService.disable(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'skills.disable',
      targetId: skill.id,
      payload: {
        id: skill.id
      }
    });

    return skill;
  });
}

function withStatusCode(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}

