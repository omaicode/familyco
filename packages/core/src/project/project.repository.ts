import type { CreateProjectInput, Project } from './project.entity.js';

export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  list(): Promise<Project[]>;
}
