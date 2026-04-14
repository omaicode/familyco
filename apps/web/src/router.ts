import { createRouter, createWebHashHistory } from 'vue-router';

import AgentsPage from './views/AgentsPage.vue';
import AuditPage from './views/AuditPage.vue';
import DashboardPage from './views/DashboardPage.vue';
import InboxPage from './views/InboxPage.vue';
import OnboardingPage from './views/OnboardingPage.vue';
import ProjectsPage from './views/ProjectsPage.vue';
import SettingsPage from './views/SettingsPage.vue';
import TasksPage from './views/TasksPage.vue';
import BudgetPage from './views/BudgetPage.vue';
import SkillsPage from './views/SkillsPage.vue';
import PluginsPage from './views/PluginsPage.vue';
import { uiRuntime } from './runtime';
import ChatPage from './views/ChatPage.vue';

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
      path: '/chat',
      component: ChatPage,
      meta: { title: 'Chat' }
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
      path: '/budget',
      component: BudgetPage,
      meta: { title: 'Budget & Usage' }
    },
    {
      path: '/settings',
      component: SettingsPage,
      meta: { title: 'Settings' }
    },
    {
      path: '/skills',
      component: SkillsPage,
      meta: { title: 'Skills' }
    },
    {
      path: '/plugins',
      component: PluginsPage,
      meta: { title: 'Plugins' }
    }
  ]
});

// Guard: if user revisits /setup after completing onboarding, redirect to executive chat
router.beforeEach((to) => {
  if (to.path !== '/setup') return true;
  const isOnboarded = uiRuntime.stores.settings.state.data.some(
    s => s.key === 'onboarding.complete' && s.value === true
  );
  if (isOnboarded) return { path: '/dashboard', replace: true };
  return true;
});
