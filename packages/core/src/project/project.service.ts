import type { CreateProjectInput, Project } from './project.entity.js';
import type { ProjectRepository } from './project.repository.js';

export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.repository.create(input);
  }

  listProjects(): Promise<Project[]> {
    return this.repository.list();
  }
}
