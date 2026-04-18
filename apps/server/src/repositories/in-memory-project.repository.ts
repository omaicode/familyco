import { randomUUID } from 'node:crypto';

import type { CreateProjectInput, Project, ProjectRepository, UpdateProjectInput } from '@familyco/core';

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
      dirPath: null,
      createdAt: now,
      updatedAt: now
    };

    this.projects.set(project.id, project);
    return project;
  }

  async reassignOwner(previousAgentId: string, nextAgentId: string): Promise<Project[]> {
    const updatedProjects: Project[] = [];

    for (const project of this.projects.values()) {
      if (project.ownerAgentId !== previousAgentId) {
        continue;
      }

      const updated: Project = {
        ...project,
        ownerAgentId: nextAgentId,
        updatedAt: new Date()
      };
      this.projects.set(project.id, updated);
      updatedProjects.push(updated);
    }

    return updatedProjects;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const updated: Project = {
      ...existing,
      name: input.name,
      description: input.description,
      ownerAgentId: input.ownerAgentId,
      parentProjectId: input.parentProjectId ?? null,
      updatedAt: new Date()
    };

    this.projects.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const hasChildren = Array.from(this.projects.values()).some((project) => project.parentProjectId === id);
    if (hasChildren) {
      throw new Error('PROJECT_NOT_EMPTY');
    }

    this.projects.delete(id);
    return existing;
  }

  async setDirPath(id: string, dirPath: string): Promise<void> {
    const existing = this.projects.get(id);
    if (existing) {
      this.projects.set(id, { ...existing, dirPath });
    }
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async list(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async count(): Promise<number> {
    return this.projects.size;
  }
}
