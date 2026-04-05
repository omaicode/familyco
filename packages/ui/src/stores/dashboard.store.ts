import type {
  AgentListItem,
  ApprovalListItem,
  AuditListItem,
  FamilyCoApiContracts,
  TaskListItem
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface DashboardMetrics {
  activeAgents: number;
  tasksToday: number;
  blockedTasks: number;
  pendingApprovals: number;
  tokenUsageToday: number;
}

export interface DashboardStoreData {
  metrics: DashboardMetrics;
  recentTasks: TaskListItem[];
  pendingApprovals: ApprovalListItem[];
  latestAudit: AuditListItem[];
  activeAgents: AgentListItem[];
}

export class DashboardStore {
  state: AsyncState<DashboardStoreData>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<DashboardStoreData>({
      metrics: {
        activeAgents: 0,
        tasksToday: 0,
        blockedTasks: 0,
        pendingApprovals: 0,
        tokenUsageToday: 0
      },
      recentTasks: [],
      pendingApprovals: [],
      latestAudit: [],
      activeAgents: []
    });
  }

  async load(projectId: string): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const [agents, tasks, approvals, audit] = await Promise.all([
        this.api.listAgents(),
        this.api.listTasks(projectId),
        this.api.listApprovals(),
        this.api.listAudit(12)
      ]);

      const activeAgents = agents.filter((agent) => agent.status === 'active');
      const blockedTasks = tasks.filter((task) => task.status === 'blocked');
      const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');

      this.state.data = {
        metrics: {
          activeAgents: activeAgents.length,
          tasksToday: tasks.length,
          blockedTasks: blockedTasks.length,
          pendingApprovals: pendingApprovals.length,
          // Placeholder until token analytics endpoint is available.
          tokenUsageToday: 0
        },
        recentTasks: tasks.slice(0, 8),
        pendingApprovals: pendingApprovals.slice(0, 8),
        latestAudit: audit,
        activeAgents
      };
      this.state.isEmpty = tasks.length === 0 && approvals.length === 0;
    } catch (error) {
      this.state.errorMessage =
        error instanceof Error ? error.message : 'Failed to load dashboard data';
    } finally {
      this.state.isLoading = false;
    }
  }
}

export const createDashboardStore = (api: FamilyCoApiContracts): DashboardStore =>
  new DashboardStore(api);
