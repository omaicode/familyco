import type {
  AgentListItem,
  ApprovalListItem,
  AuditListItem,
  DashboardSummary,
  FamilyCoApiContracts,
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface DashboardMetrics {
  activeAgents: number;
  tasksToday: number;
  blockedTasks: number;
  blockedRatio: number;
  pendingApprovals: number;
  approvalLatencyMinutes: number;
  throughputDoneLast24h: number;
  tokenUsageToday: number;
}

export interface DashboardStoreData {
  metrics: DashboardMetrics;
  recentTasks: DashboardSummary['recentTasks'];
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
        blockedRatio: 0,
        pendingApprovals: 0,
        approvalLatencyMinutes: 0,
        throughputDoneLast24h: 0,
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
      const [summary, agents] = await Promise.all([
        this.api.getDashboardSummary(projectId),
        this.api.listAgents()
      ]);

      const activeAgents = agents.filter((agent) => agent.status === 'active');

      this.state.data = {
        metrics: summary.metrics,
        recentTasks: summary.recentTasks,
        pendingApprovals: summary.pendingApprovals,
        latestAudit: summary.latestAudit,
        activeAgents
      };
      this.state.isEmpty = summary.recentTasks.length === 0 && summary.pendingApprovals.length === 0;
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
