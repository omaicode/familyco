export type AppRoutePath =
  | '/dashboard'
  | '/command'
  | '/agents'
  | '/projects'
  | '/tasks'
  | '/inbox'
  | '/audit'
  | '/settings';

export interface AppNavigationSection {
  path: AppRoutePath;
  label: string;
  description: string;
  primaryActionLabel?: string;
}

// Matches route naming constraints in ui-style-guide.
export const appNavigationSections: AppNavigationSection[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    description: 'Overview of agent health, tasks, approvals, and token usage.'
  },
  {
    path: '/command',
    label: 'Command Center',
    description: 'Send high-level instructions to the executive agent.',
    primaryActionLabel: 'Run command'
  },
  {
    path: '/agents',
    label: 'Agents',
    description: 'Manage L0/L1/L2 agents, permissions, and activity.',
    primaryActionLabel: 'Create agent'
  },
  {
    path: '/projects',
    label: 'Projects',
    description: 'Track project owners, milestones, and delivery status.',
    primaryActionLabel: 'Create project'
  },
  {
    path: '/tasks',
    label: 'Tasks',
    description: 'Monitor task lifecycle, blocked items, and execution queues.',
    primaryActionLabel: 'Create task'
  },
  {
    path: '/inbox',
    label: 'Inbox',
    description: 'Review approvals, alerts, reports, and suggestions.'
  },
  {
    path: '/audit',
    label: 'Audit',
    description: 'Inspect mutation logs and governance actions.'
  },
  {
    path: '/settings',
    label: 'Settings',
    description: 'Configure providers, server connection, and notifications.'
  }
];
