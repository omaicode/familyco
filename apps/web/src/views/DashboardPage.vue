<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  Bot, AlertOctagon, Clock, Zap, CheckCircle2, TrendingUp,
  BarChart2, RefreshCw, ChevronRight, Inbox, ShieldCheck,
  Activity, ListChecks
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import { useI18n } from '../composables/useI18n';
import { useTutorialTour } from '../composables/useTutorialTour';

const isRefreshing = ref(false);
const { t } = useI18n();
const tour = useTutorialTour();

const refresh = async () => {
  isRefreshing.value = true;
  try { await uiRuntime.stores.dashboard.load(); }
  finally { isRefreshing.value = false; }
};

const dashboardState = computed(() => uiRuntime.stores.dashboard.state);
const metrics = computed(() => dashboardState.value.data.metrics);
const recentTasks = computed(() => dashboardState.value.data.recentTasks);
const pendingApprovals = computed(() => dashboardState.value.data.pendingApprovals);
const latestAudit = computed(() => dashboardState.value.data.latestAudit);

const blockedRatioPercent = computed(() => `${Math.round(metrics.value.blockedRatio * 100)}%`);

const approvalQueueHealth = computed(() => {
  const n = metrics.value.pendingApprovals;
  if (n >= 10) return { label: t('High pressure'), highlight: 'error' };
  if (n >= 4)  return { label: t('Moderate pressure'), highlight: 'warning' };
  return { label: t('Healthy'), highlight: 'success' };
});

const priorityApprovals = computed(() => pendingApprovals.value.slice(0, 4));

const inferRisk = (action: string): 'low' | 'medium' | 'high' => {
  const n = action.toLowerCase();
  if (n.includes('delete') || n.includes('archive') || n.includes('revoke')) return 'high';
  if (n.includes('update') || n.includes('move') || n.includes('assign')) return 'medium';
  return 'low';
};

const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return t('just now');
  if (m < 60) return t('{{count}}m ago', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('{{count}}h ago', { count: h });
  return t('{{count}}d ago', { count: Math.floor(h / 24) });
};

useAutoReload(refresh);

const handleStartTour = () => { 
  tour.start(t); 
};

onMounted(() => {
  window.addEventListener('fc:start-tour', handleStartTour);
});
onUnmounted(() => {
  window.removeEventListener('fc:start-tour', handleStartTour);
});
</script>

<template>
  <section>
    <!-- ── Header ─────────────────────────────────────── -->
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Company Dashboard') }}</h3>
        <p>{{ t('Focus on decisions first, then monitor throughput and operational risk.') }}</p>
      </div>
      <div class="fc-inline-actions">
        <RouterLink class="fc-btn-secondary" to="/inbox">
          <Inbox :size="14" /> {{ t('Review inbox') }}
        </RouterLink>
        <button class="fc-btn-primary" :disabled="isRefreshing" @click="refresh">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          {{ isRefreshing ? t('Refreshing…') : t('Refresh') }}
        </button>
      </div>
    </div>

    <!-- ── Loading ─────────────────────────────────────── -->
    <div v-if="dashboardState.isLoading" class="fc-loading">
      <p style="margin:0 0 10px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading dashboard…') }}</p>
      <SkeletonList />
    </div>

    <!-- ── Error ───────────────────────────────────────── -->
    <div v-else-if="dashboardState.errorMessage" class="fc-error">
      <p>{{ dashboardState.errorMessage }}</p>
      <button class="fc-btn-secondary fc-btn-sm" @click="refresh">
        <RefreshCw :size="13" /> {{ t('Retry') }}
      </button>
    </div>

    <template v-else>
      <!-- ── Decision queue ───────────────────────────── -->
      <article class="fc-card" style="margin-bottom:14px;">
        <div class="fc-section-header" style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--fc-primary) 12%,var(--fc-surface));border:1px solid color-mix(in srgb,var(--fc-primary) 25%,var(--fc-border-subtle));">
              <AlertOctagon :size="15" style="color:var(--fc-primary);" />
            </div>
            <div>
              <h4 style="margin:0;">{{ t('Decision queue') }}</h4>
              <p class="fc-list-meta" style="margin:0;">{{ t('Pending count', { count: metrics.pendingApprovals }) }}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="fc-risk-tag" :data-risk="approvalQueueHealth.highlight === 'error' ? 'high' : approvalQueueHealth.highlight === 'warning' ? 'medium' : 'low'">
              {{ approvalQueueHealth.label }}
            </span>
            <RouterLink class="fc-btn-ghost fc-btn-sm" to="/inbox">
              All <ChevronRight :size="12" />
            </RouterLink>
          </div>
        </div>

        <ul v-if="priorityApprovals.length > 0" class="fc-list">
          <li v-for="approval in priorityApprovals" :key="approval.id" class="fc-list-item">
            <div style="flex:1;min-width:0;">
              <strong>{{ approval.action }}</strong>
              <p class="fc-list-meta">{{ approval.actorId }} · {{ approval.targetType || 'operation' }}</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span class="fc-risk-tag" :data-risk="inferRisk(approval.action)">
                {{ inferRisk(approval.action) }}
              </span>
              <RouterLink class="fc-btn-secondary fc-btn-sm" to="/inbox">Review →</RouterLink>
            </div>
          </li>
        </ul>
        <p v-else class="fc-list-meta" style="margin:0;display:flex;align-items:center;gap:6px;">
          <CheckCircle2 :size="14" style="color:var(--fc-success);" />
          {{ t('No approvals waiting — team can continue executing.') }}
        </p>
      </article>

      <!-- ── KPIs ─────────────────────────────────────── -->
      <div class="fc-grid-kpi" style="grid-template-columns:repeat(4,minmax(0,1fr));">
        <article class="fc-kpi-card" data-highlight="primary">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Active agents') }}</p>
            <Bot :size="16" style="color:var(--fc-primary);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ metrics.activeAgents }}</p>
          <p class="fc-kpi-sub">{{ t('Agents running') }}</p>
        </article>

        <article class="fc-kpi-card" :data-highlight="metrics.pendingApprovals >= 10 ? 'error' : metrics.pendingApprovals >= 4 ? 'warning' : 'success'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Pending approvals') }}</p>
            <AlertOctagon :size="16" style="opacity:0.7;" :style="{ color: metrics.pendingApprovals >= 10 ? 'var(--fc-error)' : metrics.pendingApprovals >= 4 ? 'var(--fc-warning)' : 'var(--fc-success)' }" />
          </div>
          <p class="fc-kpi-value">{{ metrics.pendingApprovals }}</p>
          <p class="fc-kpi-sub">{{ approvalQueueHealth.label }}</p>
        </article>

        <article class="fc-kpi-card" :data-highlight="metrics.blockedTasks > 5 ? 'error' : metrics.blockedTasks > 0 ? 'warning' : 'success'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Blocked tasks') }}</p>
            <ListChecks :size="16" style="opacity:0.7;" :style="{ color: metrics.blockedTasks > 5 ? 'var(--fc-error)' : 'var(--fc-warning)' }" />
          </div>
          <p class="fc-kpi-value">{{ metrics.blockedTasks }}</p>
          <p class="fc-kpi-sub">{{ blockedRatioPercent }} {{ t('blocked ratio') }}</p>
        </article>

        <article class="fc-kpi-card" data-highlight="info">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Approval latency') }}</p>
            <Clock :size="16" style="color:var(--fc-info);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ metrics.approvalLatencyMinutes }}</p>
          <p class="fc-kpi-sub">{{ t('min average') }}</p>
        </article>

        <article class="fc-kpi-card" data-highlight="success">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Done in 24h') }}</p>
            <CheckCircle2 :size="16" style="color:var(--fc-success);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ metrics.throughputDoneLast24h }}</p>
          <p class="fc-kpi-sub">{{ t('tasks completed') }}</p>
        </article>

        <article class="fc-kpi-card" data-highlight="primary">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Tasks today') }}</p>
            <TrendingUp :size="16" style="color:var(--fc-primary);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ metrics.tasksToday }}</p>
          <p class="fc-kpi-sub">{{ t('created today') }}</p>
        </article>

        <article class="fc-kpi-card" data-highlight="info">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Token usage') }}</p>
            <Zap :size="16" style="color:var(--fc-info);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ metrics.tokenUsageToday }}</p>
          <p class="fc-kpi-sub">{{ t('tokens today') }}</p>
        </article>

        <article class="fc-kpi-card" data-highlight="success">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">{{ t('Throughput') }}</p>
            <BarChart2 :size="16" style="color:var(--fc-success);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ Math.round(metrics.blockedRatio * 100) }}%</p>
          <p class="fc-kpi-sub">{{ t('blocked ratio') }}</p>
        </article>
      </div>

      <!-- ── Two-col ──────────────────────────────────── -->
      <div class="fc-content-two-col">
        <!-- Recent tasks -->
        <article class="fc-card">
          <div class="fc-section-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <Activity :size="14" style="color:var(--fc-text-muted);" />
              <h4 style="margin:0;">{{ t('Recent tasks') }}</h4>
            </div>
            <RouterLink class="fc-btn-ghost fc-btn-sm" to="/tasks">
              All <ChevronRight :size="12" />
            </RouterLink>
          </div>
          <ul v-if="recentTasks.length > 0" class="fc-list">
            <li v-for="task in recentTasks" :key="task.id" class="fc-list-item">
              <div class="fc-list-item-content">
                <strong>{{ task.title }}</strong>
                <p class="fc-list-meta">{{ task.projectId }} · {{ formatRelative(task.updatedAt) }}</p>
              </div>
              <span class="fc-badge" :data-status="task.status">{{ task.status }}</span>
            </li>
          </ul>
          <div v-else class="fc-empty" style="padding:24px;border:none;">
            <p style="margin:0;font-size:0.8125rem;">{{ t('No tasks recorded yet.') }}</p>
          </div>
        </article>

        <!-- Governance events -->
        <article class="fc-card">
          <div class="fc-section-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <ShieldCheck :size="14" style="color:var(--fc-text-muted);" />
              <h4 style="margin:0;">{{ t('Governance events') }}</h4>
            </div>
            <RouterLink class="fc-btn-ghost fc-btn-sm" to="/audit">
              {{ t('Audit log') }} <ChevronRight :size="12" />
            </RouterLink>
          </div>
          <ul v-if="latestAudit.length > 0" class="fc-list">
            <li v-for="event in latestAudit" :key="event.id" class="fc-list-item">
              <div class="fc-list-item-content">
                <strong>{{ event.action }}</strong>
                <p class="fc-list-meta">{{ event.actorId }} · {{ formatRelative(event.createdAt) }}</p>
              </div>
              <span class="fc-badge fc-badge-info">audit</span>
            </li>
          </ul>
          <div v-else class="fc-empty" style="padding:24px;border:none;">
            <p style="margin:0;font-size:0.8125rem;">No governance events yet.</p>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
.fc-spin { animation: spin 1s linear infinite; }
.fc-badge-info { background: color-mix(in srgb,var(--fc-info) 10%,var(--fc-surface)); border-color: color-mix(in srgb,var(--fc-info) 30%,var(--fc-border-subtle)); color: var(--fc-info); }
</style>
