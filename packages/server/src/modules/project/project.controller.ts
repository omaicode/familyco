import type { ProjectService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { createProjectSchema } from './project.schema.js';

export interface ProjectModuleDeps {
  projectService: ProjectService;
}

export function registerProjectController(app: FastifyInstance, deps: ProjectModuleDeps): void {
  app.get('/projects', async () => {
    return deps.projectService.listProjects();
  });

  app.post('/projects', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);
    const project = await deps.projectService.createProject(body);

    reply.code(201);
    return project;
  });
}
