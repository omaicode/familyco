<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import { uiRuntime, applyRuntimeTheme } from './runtime';

const route = useRoute();

const pageTitle = computed(() => {
  const match = uiRuntime.routes.find((item) => item.path === route.path);
  return match?.pageTitle ?? 'FamilyCo';
});

const connectionLabel = computed(() =>
  uiRuntime.stores.app.state.connection.isServerReachable ? 'Connected' : 'Disconnected'
);

const checkHealth = async () => {
  try {
    await uiRuntime.api.listAudit({ limit: 1 });
    uiRuntime.stores.app.setServerReachable(true, new Date().toISOString());
  } catch {
    uiRuntime.stores.app.setServerReachable(false, new Date().toISOString());
  }
};

onMounted(async () => {
  applyRuntimeTheme();
  await checkHealth();
});
</script>

<template>
  <div :class="uiRuntime.layout.defaultContainerClasses.shell">
    <aside class="fc-sidebar">
      <div class="fc-brand">
        <h1>FamilyCo</h1>
        <p>AI-native operating system</p>
      </div>

      <nav class="fc-nav">
        <RouterLink
          v-for="section in uiRuntime.navigation"
          :key="section.path"
          :to="section.path"
          class="fc-nav-item"
          active-class="fc-nav-item-active"
        >
          <span class="fc-nav-label">{{ section.label }}</span>
          <span class="fc-nav-desc">{{ section.description }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div :class="uiRuntime.layout.defaultContainerClasses.contentWrap">
      <header class="fc-topbar">
        <div>
          <p class="fc-topbar-caption">Workspace</p>
          <h2>{{ pageTitle }}</h2>
        </div>

        <div class="fc-topbar-right">
          <span class="fc-connection" :data-online="uiRuntime.stores.app.state.connection.isServerReachable">
            {{ connectionLabel }}
          </span>
          <span class="fc-founder">Founder</span>
        </div>
      </header>

      <main :class="uiRuntime.layout.defaultContainerClasses.mainContent">
        <RouterView />
      </main>
    </div>
  </div>
</template>
