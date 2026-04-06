import { createFamilyCoApiContracts, type FamilyCoApiContracts } from '../api/contracts.js';
import { createUIApiClient, type UIApiClientOptions } from '../api/client.js';
import { appLayoutBlueprint } from '../layouts/app-layout.blueprint.js';
import { appNavigationSections } from '../navigation/app-sections.js';
import { pageUXBlueprints } from '../pages/page-blueprints.js';
import { uiRoutes } from '../router/app-router.js';
import { createAgentStore, type AgentStore } from '../stores/agent.store.js';
import { createAppStore, type AppStore } from '../stores/app.store.js';
import { createDashboardStore, type DashboardStore } from '../stores/dashboard.store.js';
import { createInboxStore, type InboxStore } from '../stores/inbox.store.js';
import { createProjectStore, type ProjectStore } from '../stores/project.store.js';
import { createSettingsStore, type SettingsStore } from '../stores/settings.store.js';
import { createTaskStore, type TaskStore } from '../stores/task.store.js';
import { buildFamilyCoCssVariables } from '../theme/css-variables.js';
import { familyCoUITheme, type ThemePreference } from '../theme/familyco-theme.js';

export interface UIBootstrapOptions extends UIApiClientOptions {
  themePreference?: ThemePreference;
  systemPrefersDark?: boolean;
}

export interface UIBootstrap {
  api: FamilyCoApiContracts;
  stores: {
    app: AppStore;
    agents: AgentStore;
    dashboard: DashboardStore;
    inbox: InboxStore;
    projects: ProjectStore;
    settings: SettingsStore;
    tasks: TaskStore;
  };
  navigation: typeof appNavigationSections;
  routes: typeof uiRoutes;
  layout: typeof appLayoutBlueprint;
  pageUX: typeof pageUXBlueprints;
  cssVariables: Record<string, string>;
}

export const bootstrapFamilyCoUI = (options: UIBootstrapOptions): UIBootstrap => {
  const client = createUIApiClient(options);
  const api = createFamilyCoApiContracts(client);
  const appStore = createAppStore(options.baseURL);

  appStore.applyThemePreference(options.themePreference ?? 'system', options.systemPrefersDark ?? false);

  return {
    api,
    stores: {
      app: appStore,
      agents: createAgentStore(api),
      dashboard: createDashboardStore(api),
      inbox: createInboxStore(api),
      projects: createProjectStore(api),
      settings: createSettingsStore(api),
      tasks: createTaskStore(api)
    },
    navigation: appNavigationSections,
    routes: uiRoutes,
    layout: appLayoutBlueprint,
    pageUX: pageUXBlueprints,
    cssVariables: buildFamilyCoCssVariables(familyCoUITheme)
  };
};
