import type { AuditService, ProjectService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { createProjectSchema } from './project.schema.js';

export interface ProjectModuleDeps {
  projectService: ProjectService;
  auditService: AuditService;
}

export function registerProjectController(app: FastifyInstance, deps: ProjectModuleDeps): void {
  app.get('/projects', async () => {
    return deps.projectService.listProjects();
  });

  app.post('/projects', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);
    const project = await deps.projectService.createProject(body);
    await deps.auditService.write({
      actorId: body.ownerAgentId,
      action: 'project.create',
      targetId: project.id,
      payload: {
        parentProjectId: project.parentProjectId
      }
    });

    reply.code(201);
    return project;
  });
}
