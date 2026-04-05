export type KpiMetricId =
  | 'active_agents'
  | 'tasks_today'
  | 'blocked_tasks'
  | 'pending_approvals'
  | 'token_usage_today';

export interface KpiMetricDefinition {
  id: KpiMetricId;
  label: string;
  helperText: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'error';
}

export interface DashboardPanelDefinition {
  id: 'execution_summary' | 'approval_inbox' | 'agent_activity' | 'token_overview';
  title: string;
  column: 'left' | 'right';
  displayStyle: 'list' | 'table' | 'compact-metric';
}

export interface DashboardBlueprint {
  kpis: KpiMetricDefinition[];
  panels: DashboardPanelDefinition[];
}

export const dashboardBlueprint: DashboardBlueprint = {
  kpis: [
    {
      id: 'active_agents',
      label: 'Active agents',
      helperText: 'Agents currently running work loops.',
      tone: 'success'
    },
    {
      id: 'tasks_today',
      label: 'Tasks today',
      helperText: 'Tasks created or updated in the last 24h.',
      tone: 'neutral'
    },
    {
      id: 'blocked_tasks',
      label: 'Blocked tasks',
      helperText: 'Tasks waiting for dependency or decision.',
      tone: 'warning'
    },
    {
      id: 'pending_approvals',
      label: 'Pending approvals',
      helperText: 'Requests awaiting founder decision.',
      tone: 'info'
    },
    {
      id: 'token_usage_today',
      label: 'Token usage (today)',
      helperText: 'Total tokens consumed by all active runs.',
      tone: 'neutral'
    }
  ],
  panels: [
    {
      id: 'execution_summary',
      title: 'Execution summary',
      column: 'left',
      displayStyle: 'list'
    },
    {
      id: 'approval_inbox',
      title: 'Approval inbox',
      column: 'left',
      displayStyle: 'table'
    },
    {
      id: 'agent_activity',
      title: 'Agent activity',
      column: 'right',
      displayStyle: 'list'
    },
    {
      id: 'token_overview',
      title: 'Token overview',
      column: 'right',
      displayStyle: 'compact-metric'
    }
  ]
};
