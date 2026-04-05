<script setup lang="ts">
import { onMounted, reactive } from 'vue';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';

const draft = reactive({
  name: '',
  role: '',
  level: 'L1' as 'L0' | 'L1' | 'L2',
  department: ''
});

const reload = async () => {
  await uiRuntime.stores.agents.loadAgents();
};

const createAgent = async () => {
  if (!draft.name || !draft.role || !draft.department) {
    return;
  }

  await uiRuntime.stores.agents.createAgent({
    name: draft.name,
    role: draft.role,
    level: draft.level,
    department: draft.department
  });

  draft.name = '';
  draft.role = '';
  draft.department = '';
};

const pauseAgent = async (agentId: string) => {
  await uiRuntime.stores.agents.pauseAgent({ agentId });
};

onMounted(async () => {
  await reload();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Agent Management</h3>
        <p>Manage hierarchy, status, and ownership of your AI team.</p>
      </div>
      <button class="fc-btn-secondary" @click="reload">Refresh</button>
    </div>

    <article class="fc-card" style="margin-bottom: 12px">
      <h4 style="margin-top: 0">Create agent</h4>
      <div class="fc-form-grid">
        <input v-model="draft.name" class="fc-input" placeholder="Name" />
        <input v-model="draft.role" class="fc-input" placeholder="Role" />
        <input v-model="draft.department" class="fc-input" placeholder="Department" />
        <select v-model="draft.level" class="fc-select">
          <option value="L0">L0</option>
          <option value="L1">L1</option>
          <option value="L2">L2</option>
        </select>
      </div>
      <div class="fc-toolbar" style="margin-top: 10px">
        <button class="fc-btn-primary" @click="createAgent">Create agent</button>
      </div>
    </article>

    <div v-if="uiRuntime.stores.agents.state.agents.isLoading" class="fc-loading"><SkeletonList /></div>

    <div v-else-if="uiRuntime.stores.agents.state.agents.errorMessage" class="fc-error">
      <p>{{ uiRuntime.stores.agents.state.agents.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="reload">Retry</button>
    </div>

    <div v-else-if="uiRuntime.stores.agents.state.agents.isEmpty" class="fc-empty">
      <p>No agents yet. Create your first agent to start your AI company.</p>
    </div>

    <article v-else class="fc-card">
      <ul class="fc-list">
        <li v-for="agent in uiRuntime.stores.agents.state.agents.data" :key="agent.id" class="fc-list-item">
          <div>
            <strong>{{ agent.name }}</strong>
            <p class="fc-list-meta">{{ agent.role }} · {{ agent.level }} · {{ agent.department }}</p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center">
            <span class="fc-status">{{ agent.status }}</span>
            <button class="fc-btn-secondary" @click="pauseAgent(agent.id)">Pause</button>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>
