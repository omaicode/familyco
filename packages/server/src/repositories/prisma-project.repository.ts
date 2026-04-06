import type { CreateProjectInput, Project, ProjectRepository, UpdateProjectInput } from '@familyco/core';
import type { PrismaClient } from '../db/prisma/client.js';

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

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await this.prisma.project.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        ownerAgentId: input.ownerAgentId,
        parentProjectId: input.parentProjectId ?? null
      }
    });
  }

  async delete(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            tasks: true
          }
        }
      }
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    if (project._count.children > 0 || project._count.tasks > 0) {
      throw new Error('PROJECT_NOT_EMPTY');
    }

    return this.prisma.project.delete({
      where: { id }
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
