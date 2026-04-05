export interface PageUXBlueprint {
  pageId: 'dashboard' | 'agents' | 'inbox';
  title: string;
  description: string;
  primaryActionLabel: string;
  loadingMessage: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  emptyStateActionLabel: string;
  errorStateActionLabel: string;
}

export const pageUXBlueprints: PageUXBlueprint[] = [
  {
    pageId: 'dashboard',
    title: 'Company Dashboard',
    description: 'Track agent health, task flow, and pending approvals in one place.',
    primaryActionLabel: 'Refresh dashboard',
    loadingMessage: 'Loading dashboard summary...',
    emptyStateTitle: 'No activity yet',
    emptyStateDescription: 'Create your first agent or task to start the operating loop.',
    emptyStateActionLabel: 'Create agent',
    errorStateActionLabel: 'Retry'
  },
  {
    pageId: 'agents',
    title: 'Agent Management',
    description: 'Control hierarchy, status, and ownership of all agents.',
    primaryActionLabel: 'Create agent',
    loadingMessage: 'Loading agents...',
    emptyStateTitle: 'No agents yet',
    emptyStateDescription: 'Create your first agent to start your AI company.',
    emptyStateActionLabel: 'Create agent',
    errorStateActionLabel: 'Retry'
  },
  {
    pageId: 'inbox',
    title: 'Master Inbox',
    description: 'Review approval requests, alerts, and important updates.',
    primaryActionLabel: 'Review approvals',
    loadingMessage: 'Loading inbox items...',
    emptyStateTitle: 'Inbox is clear',
    emptyStateDescription: 'No pending approvals or critical alerts right now.',
    emptyStateActionLabel: 'Go to dashboard',
    errorStateActionLabel: 'Retry'
  }
];
