import type {
  AgentListItem,
  BulkUpdateTasksPayload,
  BulkUpdateTasksResult,
  CreateTaskCommentPayload,
  CreateTaskPayload,
  CreateTaskResult,
  DeleteTaskPayload,
  DeleteTaskResult,
  FamilyCoApiContracts,
  ListTasksQuery,
  ProjectListItem,
  TaskActivityItem,
  TaskCommentItem,
  TaskListItem,
  UpdateTaskPayload,
  UpdateTaskPriorityPayload,
  UpdateTaskPriorityResult,
  UpdateTaskResult,
  UpdateTaskStatusPayload,
  UpdateTaskStatusResult
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface TaskStoreData {
  tasks: TaskListItem[];
  projects: ProjectListItem[];
  agents: AgentListItem[];
}

export class TaskStore {
  state: AsyncState<TaskStoreData>;
  private lastQuery: ListTasksQuery = {};

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<TaskStoreData>({
      tasks: [],
      projects: [],
      agents: []
    });
  }

  async loadTasks(query: ListTasksQuery = {}): Promise<void> {
    this.lastQuery = { ...query };
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const [tasks, projects, agents] = await Promise.all([
        this.api.listTasks(query),
        this.api.listProjects(),
        this.api.listAgents()
      ]);

      this.state.data = {
        tasks,
        projects,
        agents
      };
      this.state.isEmpty = tasks.length === 0;
    } catch (error) {
      this.state.errorMessage =
        error instanceof Error ? error.message : 'Failed to load task management data';
    } finally {
      this.state.isLoading = false;
    }
  }

  async refresh(): Promise<void> {
    await this.loadTasks(this.lastQuery);
  }

  async createTask(payload: CreateTaskPayload): Promise<CreateTaskResult> {
    const result = await this.api.createTask(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    await this.refresh();
    return result;
  }

  async updateTask(payload: UpdateTaskPayload): Promise<UpdateTaskResult> {
    const result = await this.api.updateTask(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    await this.refresh();
    return result;
  }

  async updateTaskStatus(payload: UpdateTaskStatusPayload): Promise<UpdateTaskStatusResult> {
    const result = await this.api.updateTaskStatus(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    await this.refresh();
    return result;
  }

  async updateTaskPriority(payload: UpdateTaskPriorityPayload): Promise<UpdateTaskPriorityResult> {
    const result = await this.api.updateTaskPriority(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    await this.refresh();
    return result;
  }

  async bulkUpdateTasks(payload: BulkUpdateTasksPayload): Promise<BulkUpdateTasksResult> {
    const result = await this.api.bulkUpdateTasks(payload);

    if (Array.isArray(result)) {
      await this.refresh();
      return result;
    }

    return result;
  }

  async deleteTask(payload: DeleteTaskPayload): Promise<DeleteTaskResult> {
    const result = await this.api.deleteTask(payload);

    if ('approvalRequired' in result) {
      return result;
    }

    await this.refresh();
    return result;
  }

  listTaskComments(taskId: string): Promise<TaskCommentItem[]> {
    return this.api.listTaskComments(taskId);
  }

  createTaskComment(payload: CreateTaskCommentPayload): Promise<TaskCommentItem> {
    return this.api.createTaskComment(payload);
  }

  listTaskActivity(taskId: string): Promise<TaskActivityItem[]> {
    return this.api.listTaskActivity(taskId);
  }
}

export const createTaskStore = (api: FamilyCoApiContracts): TaskStore =>
  new TaskStore(api);
