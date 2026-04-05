import { createRouter, createWebHashHistory } from 'vue-router';

import AgentsPage from './views/AgentsPage.vue';
import DashboardPage from './views/DashboardPage.vue';
import InboxPage from './views/InboxPage.vue';
import PlaceholderPage from './views/PlaceholderPage.vue';
import SettingsPage from './views/SettingsPage.vue';
import SetupPage from './views/SetupPage.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      component: DashboardPage,
      meta: { title: 'Dashboard' }
    },
    {
      path: '/command',
      component: SetupPage,
      meta: { title: 'Setup' }
    },
    {
      path: '/agents',
      component: AgentsPage,
      meta: { title: 'Agents' }
    },
    {
      path: '/projects',
      component: PlaceholderPage,
      props: {
        title: 'Projects',
        description: 'Track project owners, scope, and outcomes.'
      }
    },
    {
      path: '/tasks',
      component: PlaceholderPage,
      props: {
        title: 'Tasks',
        description: 'Review task lifecycle and execution queue state.'
      }
    },
    {
      path: '/inbox',
      component: InboxPage,
      meta: { title: 'Inbox' }
    },
    {
      path: '/audit',
      component: PlaceholderPage,
      props: {
        title: 'Audit',
        description: 'Inspect governance actions and mutation history.'
      }
    },
    {
      path: '/settings',
      component: SettingsPage,
      meta: { title: 'Settings' }
    }
  ]
});
