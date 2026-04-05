import type { AgentService, AuditService, SettingsService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { initializeSetupSchema } from './setup.schema.js';

export interface SetupModuleDeps {
  agentService: AgentService;
  settingsService: SettingsService;
  auditService: AuditService;
}

export function registerSetupController(app: FastifyInstance, deps: SetupModuleDeps): void {
  app.post('/setup/initialize', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = initializeSetupSchema.parse(request.body);

    const l0 = await deps.agentService.createAgent({
      name: 'Chief of Staff',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    });

    const l1Agents = await Promise.all(
      body.departments.map(async (department) =>
        deps.agentService.createAgent({
          name: `${department} Lead`,
          role: 'Department Lead',
          level: 'L1',
          department,
          parentAgentId: l0.id
        })
      )
    );

    await deps.settingsService.upsert({
      key: 'company.name',
      value: body.companyName
    });

    await deps.settingsService.upsert({
      key: 'setup.completed',
      value: true
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'setup.initialize',
      targetId: l0.id,
      payload: {
        companyName: body.companyName,
        createdL1Count: l1Agents.length
      }
    });

    reply.code(201);
    return {
      companyName: body.companyName,
      executiveAgent: l0,
      departmentAgents: l1Agents
    };
  });
}
