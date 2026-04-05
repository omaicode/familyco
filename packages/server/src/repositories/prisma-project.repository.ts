import type { CreateProjectInput, Project, ProjectRepository } from '@familyco/core';
import type { PrismaClient } from '@prisma/client';

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateProjectInput): Promise<Project> {
    return this.prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        ownerAgentId: input.ownerAgentId,
        parentProjectId: input.parentProjectId ?? null
      }
    });
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id }
    });
  }

  async list(): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'asc' }
    });
  }
}
