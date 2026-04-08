<script setup lang="ts">
import { reactive, ref } from 'vue';
import {
  ShieldCheck, Filter, RefreshCw, AlertTriangle,
  ChevronDown, ChevronRight, Search, X
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const filters = reactive({
  action: '',
  actorId: '',
  targetId: '',
  limit: 30,
  offset: 0
});

const expandedId = ref<string | null>(null);

const state = reactive({
  isLoading: false,
  errorMessage: '' as string | null,
  items: [] as Array<{
    id: string;
    action: string;
    actorId: string;
    targetId?: string;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>
});

const load = async () => {
  state.isLoading = true;
  state.errorMessage = null;
  try {
    state.items = await uiRuntime.api.listAudit({
      action: filters.action || undefined,
      actorId: filters.actorId || undefined,
      targetId: filters.targetId || undefined,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : t('Failed to load audit logs');
  } finally {
    state.isLoading = false;
  }
};

const clearFilters = () => {
  filters.action = '';
  filters.actorId = '';
  filters.targetId = '';
  filters.limit = 30;
  filters.offset = 0;
  void load();
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id;
};

useAutoReload(load);
</script>

<template>
  <section>
    <!-- ── Header ──────────────────────────────────── -->
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Audit Inspector') }}</h3>
        <p>{{ t('Filter and inspect mutation logs, governance actions, and payload details.') }}</p>
      </div>
      <button class="fc-btn-secondary" :disabled="state.isLoading" @click="load">
        <RefreshCw :size="14" :class="{ 'fc-spin': state.isLoading }" />
        {{ t('Refresh') }}
      </button>
    </div>

    <!-- ── Filters ──────────────────────────────────── -->
    <div class="fc-settings-section" style="margin-bottom:16px;">
      <div class="fc-settings-section-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <Filter :size="16" style="color:var(--fc-primary);" />
          <h4>{{ t('Filters') }}</h4>
        </div>
        <p>{{ t('Narrow down audit records by action, actor, or target.') }}</p>
      </div>
      <div class="fc-settings-section-body">
        <div class="fc-form-grid" style="margin-bottom:12px;">
          <div class="fc-form-group">
            <label class="fc-label">{{ t('Action') }}</label>
            <input v-model="filters.action" class="fc-input" placeholder="e.g. task.create" @keydown.enter="load" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">{{ t('Actor ID') }}</label>
            <input v-model="filters.actorId" class="fc-input" placeholder="Agent or user ID" @keydown.enter="load" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">{{ t('Target ID') }}</label>
            <input v-model="filters.targetId" class="fc-input" placeholder="Resource ID" @keydown.enter="load" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">{{ t('Limit') }}</label>
            <input v-model.number="filters.limit" class="fc-input" type="number" min="1" max="200" />
          </div>
        </div>
        <div class="fc-toolbar">
          <button class="fc-btn-primary fc-btn-sm" :disabled="state.isLoading" @click="load">
            <Search :size="13" />
            {{ t('Apply filters') }}
          </button>
          <button class="fc-btn-ghost fc-btn-sm" @click="clearFilters">
            <X :size="13" />
            {{ t('Clear') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Loading ──────────────────────────────────── -->
    <div v-if="state.isLoading" class="fc-loading">
      <p style="margin:0 0 12px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading audit records…') }}</p>
      <SkeletonList />
    </div>

    <!-- ── Error ────────────────────────────────────── -->
    <div v-else-if="state.errorMessage" class="fc-error">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <AlertTriangle :size="16" />
        <p style="margin:0;">{{ state.errorMessage }}</p>
      </div>
      <button class="fc-btn-secondary fc-btn-sm" @click="load">
        <RefreshCw :size="13" /> {{ t('Retry') }}
      </button>
    </div>

    <!-- ── Empty ────────────────────────────────────── -->
    <div v-else-if="state.items.length === 0" class="fc-empty">
      <ShieldCheck :size="36" class="fc-empty-icon" />
      <h4>{{ t('No audit records') }}</h4>
      <p>{{ t('No events match your current filters.') }}</p>
      <button class="fc-btn-secondary fc-btn-sm" @click="clearFilters">
        <X :size="13" /> {{ t('Clear filters') }}
      </button>
    </div>

    <!-- ── Audit list ────────────────────────────────── -->
    <div v-else style="display:flex;flex-direction:column;gap:6px;">
      <!-- Summary bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <p class="fc-list-meta" style="margin:0;">
          {{ state.items.length }} record{{ state.items.length !== 1 ? 's' : '' }} shown
        </p>
      </div>

      <div
        v-for="item in state.items"
        :key="item.id"
        class="fc-card"
        style="padding:0;overflow:hidden;"
      >
        <!-- Row header -->
        <button
          style="width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;background:transparent;border:none;cursor:pointer;text-align:left;"
          @click="toggleExpand(item.id)"
        >
          <div style="width:32px;height:32px;border-radius:8px;background:color-mix(in srgb,var(--fc-info) 10%,var(--fc-surface));display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid var(--fc-border-subtle);">
            <ShieldCheck :size="14" style="color:var(--fc-info);" />
          </div>
          <div style="flex:1;min-width:0;">
            <strong style="font-size:0.875rem;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.action }}</strong>
            <p class="fc-list-meta" style="margin:2px 0 0;">
              {{ item.actorId }}
              <template v-if="item.targetId"> · target: {{ item.targetId }}</template>
            </p>
          </div>
          <span class="fc-list-meta" style="margin:0;flex-shrink:0;">{{ formatTime(item.createdAt) }}</span>
          <component :is="expandedId === item.id ? ChevronDown : ChevronRight" :size="14" style="color:var(--fc-text-faint);flex-shrink:0;" />
        </button>

        <!-- Expanded payload -->
        <Transition name="fc-page">
          <div
            v-if="expandedId === item.id && item.payload"
            style="padding:0 14px 12px;border-top:1px solid var(--fc-border-subtle);"
          >
            <p class="fc-list-meta" style="margin:10px 0 6px;font-weight:600;">{{ t('Payload') }}</p>
            <pre style="margin:0;padding:10px;border-radius:var(--fc-control-radius);background:var(--fc-surface-muted);font-size:0.78rem;overflow-x:auto;color:var(--fc-text-main);border:1px solid var(--fc-border-subtle);">{{ JSON.stringify(item.payload, null, 2) }}</pre>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
.fc-spin { animation: spin 1s linear infinite; }
</style>
