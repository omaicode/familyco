import type { CreateProjectInput, Project, UpdateProjectInput } from './project.entity.js';
import type { ProjectRepository } from './project.repository.js';

export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async getProjectById(id: string): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return project;
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.repository.create(input);
  }

  updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    if (input.parentProjectId === id) {
      throw new Error('PROJECT_INVALID_PARENT');
    }

    return this.repository.update(id, input);
  }

  setProjectDirPath(id: string, dirPath: string): Promise<void> {
    return this.repository.setDirPath(id, dirPath);
  }

  deleteProject(id: string): Promise<Project> {
    return this.repository.delete(id);
  }

  listProjects(): Promise<Project[]> {
    return this.repository.list();
  }

  async countProjects(): Promise<number> {
    if (hasCountRepository(this.repository)) {
      return this.repository.count();
    }

    const projects = await this.repository.list();
    return projects.length;
  }
}

interface CountCapableProjectRepository extends ProjectRepository {
  count(): Promise<number>;
}

function hasCountRepository(repository: ProjectRepository): repository is CountCapableProjectRepository {
  return typeof (repository as { count?: unknown }).count === 'function';
}
