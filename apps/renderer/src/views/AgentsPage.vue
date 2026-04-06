<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Bot, Plus, Pause, Play, RefreshCw, AlertTriangle } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcBadge from '../components/FcBadge.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcInput from '../components/FcInput.vue';
import FcSelect from '../components/FcSelect.vue';

const showCreateForm = ref(false);
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const isCreating = ref(false);
const isLoading = ref(false);
const busy = ref<Record<string, boolean>>({});

const draft = reactive({
  name: '',
  role: '',
  level: 'L1' as 'L0' | 'L1' | 'L2',
  department: ''
});

const setFeedback = (type: 'success' | 'error', text: string) => {
  feedback.value = { type, text };
  setTimeout(() => { if (feedback.value?.text === text) feedback.value = null; }, 4000);
};

const reload = async () => {
  feedback.value = null;
  isLoading.value = true;
  await uiRuntime.stores.agents.loadAgents();
  isLoading.value = false;
};

const createAgent = async () => {
  if (!draft.name || !draft.role || !draft.department) return;
  isCreating.value = true;
  try {
    await uiRuntime.stores.agents.createAgent({
      name: draft.name,
      role: draft.role,
      level: draft.level,
      department: draft.department
    });
    draft.name = ''; draft.role = ''; draft.department = '';
    showCreateForm.value = false;
    setFeedback('success', 'Agent created successfully');
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to create agent');
  } finally {
    isCreating.value = false;
  }
};

const pauseAgent = async (agentId: string) => {
  busy.value = { ...busy.value, [agentId]: true };
  try {
    await uiRuntime.stores.agents.pauseAgent({ agentId });
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to pause agent');
  } finally {
    busy.value = { ...busy.value, [agentId]: false };
  }
};

useAutoReload(reload);
</script>

<template>
  <section>
    <!-- ── Header ──────────────────────────────────── -->
    <div class="fc-page-header">
      <div>
        <h3>Agents</h3>
        <p>Manage your AI team — hierarchy, status, and permissions.</p>
      </div>
      <div class="fc-inline-actions">
        <button class="fc-btn-secondary" @click="reload">
          <RefreshCw :size="14" />
          Refresh
        </button>
        <button class="fc-btn-primary" @click="showCreateForm = !showCreateForm">
          <Plus :size="14" />
          {{ showCreateForm ? 'Cancel' : 'New agent' }}
        </button>
      </div>
    </div>

    <!-- ── Feedback ─────────────────────────────────── -->
    <Transition name="fc-banner">
      <FcBanner
        v-if="feedback"
        :type="feedback.type"
        closable
        style="margin-bottom:14px;"
        @close="feedback = null"
      >
        {{ feedback.text }}
      </FcBanner>
    </Transition>

    <!-- ── Create form ──────────────────────────────── -->
    <Transition name="fc-page">
      <div v-if="showCreateForm" class="fc-settings-section" style="margin-bottom:16px;">
        <div class="fc-settings-section-header">
          <h4>Create new agent</h4>
          <p>Fill in agent details — level determines authority and approval mode.</p>
        </div>
        <div class="fc-settings-section-body">
          <div class="fc-form-grid" style="margin-bottom:12px;">
            <div class="fc-form-group">
              <label class="fc-label">Name</label>
              <FcInput v-model="draft.name" placeholder="e.g. Alex — Head of Marketing" />
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Role</label>
              <FcInput v-model="draft.role" placeholder="e.g. Marketing Director" />
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Department</label>
              <FcInput v-model="draft.department" placeholder="e.g. Marketing" />
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Level</label>
              <FcSelect v-model="draft.level">
                <option value="L0">L0 — Executive (auto-approve)</option>
                <option value="L1">L1 — Manager (suggest only)</option>
                <option value="L2">L2 — Worker (require review)</option>
              </FcSelect>
            </div>
          </div>
          <div class="fc-toolbar">
            <FcButton
              variant="primary"
              :disabled="isCreating || !draft.name || !draft.role || !draft.department"
              @click="createAgent"
            >
              <Plus :size="14" />
              {{ isCreating ? 'Creating…' : 'Create agent' }}
            </FcButton>
            <FcButton variant="ghost" @click="showCreateForm = false">Cancel</FcButton>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Loading ──────────────────────────────────── -->
    <div v-if="isLoading" class="fc-loading">
      <p style="margin:0 0 12px;font-size:0.875rem;color:var(--fc-text-muted);">Loading agents…</p>
      <SkeletonList />
    </div>

    <!-- ── Error ────────────────────────────────────── -->
    <div v-else-if="uiRuntime.stores.agents.state.agents.errorMessage" class="fc-error">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <AlertTriangle :size="16" />
        <p style="margin:0;">{{ uiRuntime.stores.agents.state.agents.errorMessage }}</p>
      </div>
      <FcButton variant="secondary" size="sm" @click="reload">
        <RefreshCw :size="13" /> Retry
      </FcButton>
    </div>

    <!-- ── Empty ───────────────────────────────────── -->
    <div v-else-if="uiRuntime.stores.agents.state.agents.isEmpty" class="fc-empty">
      <Bot :size="36" class="fc-empty-icon" />
      <h4>No agents yet</h4>
      <p>Create your first agent to start your AI company.</p>
      <FcButton variant="primary" @click="showCreateForm = true">
        <Plus :size="14" /> Create first agent
      </FcButton>
    </div>

    <!-- ── Agent list ────────────────────────────────── -->
    <div v-else style="display:flex;flex-direction:column;gap:8px;">
      <FcCard
        v-for="agent in uiRuntime.stores.agents.state.agents.data"
        :key="agent.id"
        style="padding:14px 16px;"
      >
        <div style="display:flex;align-items:center;gap:12px;">
          <!-- Avatar -->
          <div
            style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;font-size:0.875rem;"
            :style="{
              background: agent.level === 'L0'
                ? 'color-mix(in srgb,#7B61FF 15%,var(--fc-surface))'
                : agent.level === 'L1'
                  ? 'color-mix(in srgb,var(--fc-info) 15%,var(--fc-surface))'
                  : 'color-mix(in srgb,var(--fc-success) 15%,var(--fc-surface))',
              color: agent.level === 'L0' ? '#7B61FF' : agent.level === 'L1' ? 'var(--fc-info)' : 'var(--fc-success)',
              border: '1px solid var(--fc-border-subtle)'
            }"
          >
            {{ agent.name.slice(0, 2).toUpperCase() }}
          </div>

          <!-- Info -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
              <strong style="font-size:0.9375rem;">{{ agent.name }}</strong>
              <FcBadge :level="agent.level">{{ agent.level }}</FcBadge>
            </div>
            <p class="fc-list-meta" style="margin:0;">
              {{ agent.role }} · {{ agent.department }}
            </p>
          </div>

          <!-- Actions -->
          <div class="fc-list-actions">
            <FcBadge :status="agent.status">{{ agent.status }}</FcBadge>
            <FcButton
              variant="secondary"
              size="sm"
              :disabled="busy[agent.id]"
              :title="agent.status === 'active' ? 'Pause agent' : 'Resume agent'"
              @click="pauseAgent(agent.id)"
            >
              <component :is="agent.status === 'active' ? Pause : Play" :size="12" />
              {{ agent.status === 'active' ? 'Pause' : 'Resume' }}
            </FcButton>
          </div>
        </div>
      </FcCard>
    </div>
  </section>
</template>

<style scoped>
@keyframes fc-banner-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
.fc-banner-enter-active { animation: fc-banner-in 0.25s ease; }
.fc-banner-leave-active { transition: opacity 0.2s; }
.fc-banner-leave-to    { opacity: 0; }
</style>
