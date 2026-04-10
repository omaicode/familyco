import type { AppRoutePath } from '../navigation/app-sections.js';
import { appNavigationSections } from '../navigation/app-sections.js';

export interface UIRouteDefinition {
  path: AppRoutePath;
  pageId: 'dashboard' | 'chat' | 'agents' | 'projects' | 'tasks' | 'inbox' | 'audit' | 'budget' | 'skills' | 'settings';
  pageTitle: string;
  minRequiredLevel: 'L0' | 'L1' | 'L2';
}

export const uiRoutes: UIRouteDefinition[] = appNavigationSections.map((section) => {
  const routeMap: Record<AppRoutePath, UIRouteDefinition> = {
    '/dashboard': {
      path: '/dashboard',
      pageId: 'dashboard',
      pageTitle: 'Dashboard',
      minRequiredLevel: 'L1'
    },
    '/chat': {
      path: '/chat',
      pageId: 'chat',
      pageTitle: 'Chat',
      minRequiredLevel: 'L0'
    },
    '/agents': {
      path: '/agents',
      pageId: 'agents',
      pageTitle: 'Agents',
      minRequiredLevel: 'L1'
    },
    '/projects': {
      path: '/projects',
      pageId: 'projects',
      pageTitle: 'Projects',
      minRequiredLevel: 'L1'
    },
    '/tasks': {
      path: '/tasks',
      pageId: 'tasks',
      pageTitle: 'Tasks',
      minRequiredLevel: 'L1'
    },
    '/inbox': {
      path: '/inbox',
      pageId: 'inbox',
      pageTitle: 'Inbox',
      minRequiredLevel: 'L1'
    },
    '/audit': {
      path: '/audit',
      pageId: 'audit',
      pageTitle: 'Audit',
      minRequiredLevel: 'L0'
    },
    '/budget': {
      path: '/budget',
      pageId: 'budget',
      pageTitle: 'Budget',
      minRequiredLevel: 'L0'
    },
    '/skills': {
      path: '/skills',
      pageId: 'skills',
      pageTitle: 'Skills',
      minRequiredLevel: 'L0'
    },
    '/settings': {
      path: '/settings',
      pageId: 'settings',
      pageTitle: 'Settings',
      minRequiredLevel: 'L0'
    }
  };

  return routeMap[section.path];
});
