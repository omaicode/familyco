import type {
  AgentListItem,
  CreateProjectPayload,
  CreateProjectResult,
  FamilyCoApiContracts,
  ProjectListItem,
  TaskListItem
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
}

export const createProjectStore = (api: FamilyCoApiContracts): ProjectStore =>
  new ProjectStore(api);
