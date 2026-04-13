import type { CreateProjectInput, Project, UpdateProjectInput } from './project.entity.js';

export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  reassignOwner(previousAgentId: string, nextAgentId: string): Promise<Project[]>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  setDirPath(id: string, dirPath: string): Promise<void>;
  delete(id: string): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  list(): Promise<Project[]>;
}
