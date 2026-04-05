import { randomUUID } from 'node:crypto';

import type { CreateProjectInput, Project, ProjectRepository } from '@familyco/core';

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, Project>();

  async create(input: CreateProjectInput): Promise<Project> {
    const now = new Date();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      ownerAgentId: input.ownerAgentId,
      parentProjectId: input.parentProjectId ?? null,
      createdAt: now,
      updatedAt: now
    };

    this.projects.set(project.id, project);
    return project;
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async list(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }
}
