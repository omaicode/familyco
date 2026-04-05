<script setup lang="ts">
import { onMounted, reactive } from 'vue';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';

const filters = reactive({
  action: '',
  actorId: '',
  targetId: '',
  limit: 30,
  offset: 0
});

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
    state.errorMessage = error instanceof Error ? error.message : 'Failed to load audit logs';
  } finally {
    state.isLoading = false;
  }
};

onMounted(async () => {
  await load();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Audit Inspector</h3>
        <p>Filter and inspect mutation history with payload details.</p>
      </div>
      <button class="fc-btn-secondary" @click="load">Refresh</button>
    </div>

    <article class="fc-card" style="margin-bottom: 12px">
      <h4 style="margin-top: 0">Filters</h4>
      <div class="fc-form-grid">
        <input v-model="filters.action" class="fc-input" placeholder="Action" />
        <input v-model="filters.actorId" class="fc-input" placeholder="Actor ID" />
        <input v-model="filters.targetId" class="fc-input" placeholder="Target ID" />
        <input v-model.number="filters.limit" class="fc-input" type="number" min="1" max="200" />
      </div>
      <div class="fc-toolbar" style="margin-top: 10px">
        <button class="fc-btn-primary" @click="load">Apply filters</button>
      </div>
    </article>

    <div v-if="state.isLoading" class="fc-loading"><SkeletonList /></div>
    <div v-else-if="state.errorMessage" class="fc-error">{{ state.errorMessage }}</div>
    <div v-else-if="state.items.length === 0" class="fc-empty">No audit records found.</div>

    <article v-else class="fc-card">
      <ul class="fc-list">
        <li v-for="item in state.items" :key="item.id" class="fc-list-item" style="align-items: flex-start">
          <div>
            <strong>{{ item.action }}</strong>
            <p class="fc-list-meta">actor: {{ item.actorId }} · target: {{ item.targetId ?? 'n/a' }}</p>
            <p class="fc-list-meta">{{ item.createdAt }}</p>
            <pre class="fc-list-meta" style="white-space: pre-wrap">{{ JSON.stringify(item.payload ?? {}, null, 2) }}</pre>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>
