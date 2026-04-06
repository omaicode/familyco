import type {
  AgentListItem,
  CreateProjectPayload,
  CreateProjectResult,
  DeleteProjectPayload,
  DeleteProjectResult,
  FamilyCoApiContracts,
  ProjectListItem,
  TaskListItem,
  UpdateProjectPayload,
  UpdateProjectResult
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface ProjectStoreData {
  projects: ProjectListItem[];
  agents: AgentListItem[];
  taskMap: Record<string, TaskListItem[]>;
}

export class ProjectStore {
  state: AsyncState<ProjectStoreData>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<ProjectStoreData>({
      projects: [],
      agents: [],
      taskMap: {}
    });
  }

  async loadProjects(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const [projects, agents] = await Promise.all([
        this.api.listProjects(),
        this.api.listAgents()
      ]);

      const taskEntries = await Promise.all(
        projects.map(async (project) => {
          try {
            const tasks = await this.api.listTasks({ projectId: project.id });
            return [project.id, tasks] as const;
          } catch {
            return [project.id, [] as TaskListItem[]] as const;
          }
        })
      );

      this.state.data = {
        projects,
        agents,
        taskMap: Object.fromEntries(taskEntries)
      };
      this.state.isEmpty = projects.length === 0;
    } catch (error) {
      this.state.errorMessage =
        error instanceof Error ? error.message : 'Failed to load project portfolio';
    } finally {
      this.state.isLoading = false;
    }
  }

  async createProject(payload: CreateProjectPayload): Promise<CreateProjectResult> {
    const result = await this.api.createProject(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    this.state.data = {
      ...this.state.data,
      projects: [result, ...this.state.data.projects],
      taskMap: {
        [result.id]: [],
        ...this.state.data.taskMap
      }
    };
    this.state.isEmpty = false;

    return result;
  }

  async updateProject(payload: UpdateProjectPayload): Promise<UpdateProjectResult> {
    const result = await this.api.updateProject(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    this.state.data = {
      ...this.state.data,
      projects: this.state.data.projects.map((project) => (project.id === result.id ? result : project))
    };

    return result;
  }

  async deleteProject(payload: DeleteProjectPayload): Promise<DeleteProjectResult> {
    const result = await this.api.deleteProject(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    const { [payload.projectId]: _, ...nextTaskMap } = this.state.data.taskMap;
    this.state.data = {
      ...this.state.data,
      projects: this.state.data.projects.filter((project) => project.id !== payload.projectId),
      taskMap: nextTaskMap
    };
    this.state.isEmpty = this.state.data.projects.length === 0;

    return result;
  }
}

export const createProjectStore = (api: FamilyCoApiContracts): ProjectStore =>
  new ProjectStore(api);
