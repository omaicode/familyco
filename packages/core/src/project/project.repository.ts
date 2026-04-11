import type { CreateProjectInput, Project, UpdateProjectInput } from './project.entity.js';

export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  reassignOwner(previousAgentId: string, nextAgentId: string): Promise<Project[]>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  list(): Promise<Project[]>;
}
