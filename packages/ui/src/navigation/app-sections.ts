export type AppRoutePath =
  | '/dashboard'
  | '/chat'
  | '/agents'
  | '/projects'
  | '/tasks'
  | '/inbox'
  | '/audit'
  | '/budget'
  | '/skills'
  | '/plugins'
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
    path: '/chat',
    label: 'Chat',
    description: 'Talk with the executive agent and let it turn plans into tracked work.',
    primaryActionLabel: 'Send message'
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
    path: '/budget',
    label: 'Budget',
    description: 'Track AI token usage, estimated cost, and monthly spend against your budget limit.'
  },
  {
    path: '/skills',
    label: 'Skills',
    description: 'Manage local SKILL.md skills and control which ones are enabled in registry.'
  },
  {
    path: '/plugins',
    label: 'Plugins',
    description: 'Discover, enable and configure plugins that extend agent capabilities.'
  },
  {
    path: '/settings',
    label: 'Settings',
    description: 'Configure providers, server connection, and notifications.'
  }
];
