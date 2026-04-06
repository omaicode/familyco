import type { AgentService, AuditService, ProjectService, SettingsService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { resolveDefaultProjectId } from '../shared/defaults.js';
import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { initializeSetupSchema } from './setup.schema.js';

export interface SetupModuleDeps {
  agentService: AgentService;
  projectService: ProjectService;
  settingsService: SettingsService;
  auditService: AuditService;
}

export function registerSetupController(app: FastifyInstance, deps: SetupModuleDeps): void {
  app.post('/setup/initialize', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = initializeSetupSchema.parse(request.body);

    const executiveAgent =
      (await deps.agentService.findExecutiveAgent()) ??
      (await deps.agentService.createAgent({
        name: 'Chief of Staff',
        role: 'Executive Agent',
        level: 'L0',
        department: 'Executive'
      }));

    await deps.settingsService.upsert({
      key: 'company.name',
      value: body.companyName
    });

    await deps.settingsService.upsert({
      key: 'company.templateDepartments',
      value: body.departments
    });

    await deps.settingsService.upsert({
      key: 'defaults.executiveAgentId',
      value: executiveAgent.id
    });

    const defaultProjectId = await resolveDefaultProjectId({
      agentService: deps.agentService,
      projectService: deps.projectService,
      settingsService: deps.settingsService
    });
    const defaultProject = (await deps.projectService.listProjects()).find(
      (project) => project.id === defaultProjectId
    ) ?? null;

    await deps.settingsService.upsert({
      key: 'setup.completed',
      value: true
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'setup.initialize',
      targetId: executiveAgent.id,
      payload: {
        companyName: body.companyName,
        templateDepartmentCount: body.departments.length,
        defaultProjectId
      }
    });

    reply.code(201);
    return {
      companyName: body.companyName,
      executiveAgent,
      departmentAgents: [],
      departmentTemplates: body.departments,
      defaultProject
    };
  });
}
