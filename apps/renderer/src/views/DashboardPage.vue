<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';

const projectId = ref(import.meta.env.VITE_DEFAULT_PROJECT_ID || 'demo-project');

const refresh = async () => {
  await uiRuntime.stores.dashboard.load(projectId.value);
};

onMounted(async () => {
  await refresh();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Company Dashboard</h3>
        <p>Track agent health, tasks, approvals, and governance signals.</p>
      </div>
      <button class="fc-btn-primary" @click="refresh">Refresh dashboard</button>
    </div>

    <div v-if="uiRuntime.stores.dashboard.state.isLoading" class="fc-loading">
      <SkeletonList />
    </div>

    <div v-else-if="uiRuntime.stores.dashboard.state.errorMessage" class="fc-error">
      <p>{{ uiRuntime.stores.dashboard.state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="refresh">Retry</button>
    </div>

    <div v-else-if="uiRuntime.stores.dashboard.state.isEmpty" class="fc-empty">
      <p>No activity yet. Create your first agent or task to start the operating loop.</p>
    </div>

    <template v-else>
      <div class="fc-grid-kpi">
        <article class="fc-card">
          <p class="fc-kpi-label">Active agents</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.activeAgents }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Tasks today</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.tasksToday }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Blocked tasks</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.blockedTasks }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Blocked ratio</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.blockedRatio }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Pending approvals</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.pendingApprovals }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Approval latency (min)</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.approvalLatencyMinutes }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Done in 24h</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.throughputDoneLast24h }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Token usage</p>
          <p class="fc-kpi-value">{{ uiRuntime.stores.dashboard.state.data.metrics.tokenUsageToday }}</p>
        </article>
      </div>

      <div class="fc-content-two-col">
        <article class="fc-card">
          <h4>Recent tasks</h4>
          <ul class="fc-list">
            <li v-for="task in uiRuntime.stores.dashboard.state.data.recentTasks" :key="task.id" class="fc-list-item">
              <div>
                <strong>{{ task.title }}</strong>
                <p class="fc-list-meta">{{ task.projectId }}</p>
              </div>
              <span class="fc-status">{{ task.status }}</span>
            </li>
          </ul>
        </article>

        <article class="fc-card">
          <h4>Pending approvals</h4>
          <ul class="fc-list">
            <li
              v-for="approval in uiRuntime.stores.dashboard.state.data.pendingApprovals"
              :key="approval.id"
              class="fc-list-item"
            >
              <div>
                <strong>{{ approval.action }}</strong>
                <p class="fc-list-meta">{{ approval.actorId }}</p>
              </div>
              <span class="fc-status">{{ approval.status }}</span>
            </li>
          </ul>
        </article>
      </div>
    </template>
  </section>
</template>
