<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';

const projectId = ref(import.meta.env.VITE_DEFAULT_PROJECT_ID || 'demo-project');

const refresh = async () => {
  await uiRuntime.stores.dashboard.load(projectId.value);
};

const dashboardState = computed(() => uiRuntime.stores.dashboard.state);
const metrics = computed(() => dashboardState.value.data.metrics);
const recentTasks = computed(() => dashboardState.value.data.recentTasks);
const pendingApprovals = computed(() => dashboardState.value.data.pendingApprovals);
const latestAudit = computed(() => dashboardState.value.data.latestAudit);

const blockedRatioPercent = computed(() => `${Math.round(metrics.value.blockedRatio * 100)}%`);
const approvalQueueHealth = computed(() => {
  if (metrics.value.pendingApprovals >= 10) {
    return 'High queue pressure';
  }

  if (metrics.value.pendingApprovals >= 4) {
    return 'Moderate queue pressure';
  }

  return 'Queue healthy';
});

const priorityApprovals = computed(() => pendingApprovals.value.slice(0, 4));

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString();
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
        <p>Focus on decisions first, then monitor throughput and operational risk.</p>
      </div>
      <div class="fc-inline-actions">
        <RouterLink class="fc-btn-secondary" to="/inbox">Review inbox</RouterLink>
        <button class="fc-btn-primary" @click="refresh">Refresh dashboard</button>
      </div>
    </div>

    <div v-if="dashboardState.isLoading" class="fc-loading">
      <p style="margin: 0 0 10px">Loading dashboard priorities...</p>
      <SkeletonList />
    </div>

    <div v-else-if="dashboardState.errorMessage" class="fc-error">
      <p>{{ dashboardState.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="refresh">Retry</button>
    </div>

    <template v-else>
      <article class="fc-card" style="margin-bottom: 12px">
        <div class="fc-page-header" style="margin-bottom: 10px">
          <div>
            <h4 style="margin: 0">Decision queue</h4>
            <p class="fc-list-meta" style="margin: 4px 0 0">{{ approvalQueueHealth }}</p>
          </div>
          <span class="fc-status">{{ metrics.pendingApprovals }} pending</span>
        </div>

        <ul v-if="priorityApprovals.length > 0" class="fc-list">
          <li v-for="approval in priorityApprovals" :key="approval.id" class="fc-list-item">
            <div>
              <strong>{{ approval.action }}</strong>
              <p class="fc-list-meta">{{ approval.actorId }} · {{ approval.targetType || 'operation' }}</p>
            </div>
            <RouterLink class="fc-btn-secondary" to="/inbox">Review</RouterLink>
          </li>
        </ul>
        <p v-else class="fc-list-meta" style="margin: 0">No approvals waiting. Team can continue executing.</p>
      </article>

      <div class="fc-grid-kpi">
        <article class="fc-card">
          <p class="fc-kpi-label">Active agents</p>
          <p class="fc-kpi-value">{{ metrics.activeAgents }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Pending approvals</p>
          <p class="fc-kpi-value">{{ metrics.pendingApprovals }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Blocked tasks</p>
          <p class="fc-kpi-value">{{ metrics.blockedTasks }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Blocked ratio</p>
          <p class="fc-kpi-value">{{ blockedRatioPercent }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Approval latency (min)</p>
          <p class="fc-kpi-value">{{ metrics.approvalLatencyMinutes }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Done in 24h</p>
          <p class="fc-kpi-value">{{ metrics.throughputDoneLast24h }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Tasks today</p>
          <p class="fc-kpi-value">{{ metrics.tasksToday }}</p>
        </article>
        <article class="fc-card">
          <p class="fc-kpi-label">Token usage</p>
          <p class="fc-kpi-value">{{ metrics.tokenUsageToday }}</p>
        </article>
      </div>

      <div class="fc-content-two-col">
        <article class="fc-card">
          <h4>Recent tasks</h4>
          <ul v-if="recentTasks.length > 0" class="fc-list">
            <li v-for="task in recentTasks" :key="task.id" class="fc-list-item">
              <div>
                <strong>{{ task.title }}</strong>
                <p class="fc-list-meta">{{ task.projectId }} · {{ formatTimestamp(task.updatedAt) }}</p>
              </div>
              <span class="fc-status">{{ task.status }}</span>
            </li>
          </ul>
          <p v-else class="fc-list-meta" style="margin: 0">No tasks recorded for this view yet.</p>
        </article>

        <article class="fc-card">
          <h4>Latest governance events</h4>
          <ul v-if="latestAudit.length > 0" class="fc-list">
            <li v-for="event in latestAudit" :key="event.id" class="fc-list-item">
              <div>
                <strong>{{ event.action }}</strong>
                <p class="fc-list-meta">{{ event.actorId }} · {{ formatTimestamp(event.createdAt) }}</p>
              </div>
              <span class="fc-status">audit</span>
            </li>
          </ul>
          <p v-else class="fc-list-meta" style="margin: 0">No governance events captured yet.</p>
        </article>
      </div>
    </template>
  </section>
</template>
