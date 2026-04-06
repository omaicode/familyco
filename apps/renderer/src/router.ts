import { createRouter, createWebHashHistory } from 'vue-router';

import AgentsPage from './views/AgentsPage.vue';
import DashboardPage from './views/DashboardPage.vue';
import InboxPage from './views/InboxPage.vue';
import ProjectsPage from './views/ProjectsPage.vue';
import TasksPage from './views/TasksPage.vue';
import AuditPage from './views/AuditPage.vue';
import SettingsPage from './views/SettingsPage.vue';
import OnboardingPage from './views/OnboardingPage.vue';
import { uiRuntime } from './runtime';

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/setup',
      component: OnboardingPage,
      meta: { title: 'Setup', hideShell: true }
    },
    {
      path: '/dashboard',
      component: DashboardPage,
      meta: { title: 'Dashboard' }
    },
    {
      path: '/agents',
      component: AgentsPage,
      meta: { title: 'Agents' }
    },
    {
      path: '/projects',
      component: ProjectsPage,
      meta: { title: 'Projects' }
    },
    {
      path: '/tasks',
      component: TasksPage,
      meta: { title: 'Tasks' }
    },
    {
      path: '/inbox',
      component: InboxPage,
      meta: { title: 'Inbox' }
    },
    {
      path: '/audit',
      component: AuditPage,
      meta: { title: 'Audit Inspector' }
    },
    {
      path: '/settings',
      component: SettingsPage,
      meta: { title: 'Settings' }
    }
  ]
});

// Guard: if user revisits /setup after completing onboarding, redirect to dashboard
router.beforeEach((to) => {
  if (to.path !== '/setup') return true;
  const isOnboarded = uiRuntime.stores.settings.state.data.some(
    s => s.key === 'onboarding.complete' && s.value === true
  );
  if (isOnboarded) return { path: '/dashboard', replace: true };
  return true;
});
