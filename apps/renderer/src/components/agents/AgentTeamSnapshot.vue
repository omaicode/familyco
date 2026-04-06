<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { computed } from 'vue';

import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';
import FcSelect from '../FcSelect.vue';

type AgentStatus = AgentListItem['status'];

const STATUS_LABELS: Record<AgentStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  paused: 'Paused',
  archived: 'Archived'
};

const props = defineProps<{
  selectedAgent: AgentListItem;
  selectedManager: AgentListItem | null;
  selectedDirectReports: AgentListItem[];
  selectedPath: AgentListItem[];
  selectedManagerOptions: AgentListItem[];
  managerDraft: string;
  isSavingParent: boolean;
  getAgentInitials: (name: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:managerDraft', value: string): void;
  (event: 'save-manager'): void;
}>();

const managerModel = computed({
  get: () => props.managerDraft,
  set: (value: string) => emit('update:managerDraft', value)
});
</script>

<template>
  <div class="ag-stack">
    <div class="ag-detail-header">
      <div class="ag-avatar" :data-level="selectedAgent.level">
        {{ getAgentInitials(selectedAgent.name) }}
      </div>
      <div class="ag-detail-copy">
        <div class="ag-agent-title">
          <strong>{{ selectedAgent.name }}</strong>
          <FcBadge :level="selectedAgent.level">{{ selectedAgent.level }}</FcBadge>
          <FcBadge :status="selectedAgent.status">{{ STATUS_LABELS[selectedAgent.status] }}</FcBadge>
        </div>
        <p class="fc-list-meta">{{ selectedAgent.role }} · {{ selectedAgent.department }}</p>
      </div>
    </div>

    <div class="ag-mini-grid">
      <div class="ag-mini-stat">
        <span>Reports to</span>
        <strong>{{ selectedManager?.name ?? 'Root / unassigned' }}</strong>
      </div>
      <div class="ag-mini-stat">
        <span>Direct reports</span>
        <strong>{{ selectedDirectReports.length }}</strong>
      </div>
      <div class="ag-mini-stat">
        <span>Status</span>
        <strong>{{ STATUS_LABELS[selectedAgent.status] }}</strong>
      </div>
    </div>

    <div class="ag-group">
      <label class="ag-group-label">Team path</label>
      <div class="ag-path">
        <span v-for="(agent, index) in selectedPath" :key="agent.id" class="ag-path-chip">
          {{ agent.name }}
          <span v-if="index < selectedPath.length - 1">→</span>
        </span>
      </div>
    </div>

    <div class="ag-group">
      <label class="ag-group-label">Direct reports</label>
      <div class="ag-path">
        <span v-if="selectedDirectReports.length === 0" class="ag-report-empty">No direct reports yet</span>
        <span v-for="report in selectedDirectReports" :key="report.id" class="ag-path-chip">
          {{ report.name }}
        </span>
      </div>
    </div>

    <div v-if="selectedAgent.level !== 'L0'" class="fc-form-group">
      <label class="fc-label">Reports to</label>
      <FcSelect v-model="managerModel">
        <option value="">No manager assigned yet</option>
        <option v-for="manager in selectedManagerOptions" :key="manager.id" :value="manager.id">
          {{ manager.name }} — {{ manager.role }}
        </option>
      </FcSelect>
      <div class="fc-toolbar">
        <FcButton
          variant="secondary"
          size="sm"
          :disabled="isSavingParent || managerDraft === (selectedAgent.parentAgentId ?? '')"
          @click="emit('save-manager')"
        >
          {{ isSavingParent ? 'Saving…' : 'Save reporting line' }}
        </FcButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ag-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ag-detail-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.ag-avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.86rem;
  font-weight: 700;
  border: 1px solid var(--fc-border-subtle);
}

.ag-avatar[data-level='L0'] {
  background: color-mix(in srgb, #7B61FF 12%, var(--fc-surface));
  color: #7B61FF;
}

.ag-avatar[data-level='L1'] {
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
  color: var(--fc-info);
}

.ag-avatar[data-level='L2'] {
  background: color-mix(in srgb, var(--fc-success) 12%, var(--fc-surface));
  color: var(--fc-success);
}

.ag-detail-copy {
  min-width: 0;
}

.ag-agent-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ag-agent-title strong {
  font-size: 0.92rem;
}

.ag-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ag-mini-stat {
  padding: 10px 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface-muted);
}

.ag-mini-stat span {
  display: block;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
  margin-bottom: 4px;
}

.ag-mini-stat strong {
  font-size: 0.82rem;
  line-height: 1.35;
}

.ag-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ag-group-label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fc-text-muted);
}

.ag-path {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ag-path-chip,
.ag-report-empty {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--fc-surface-muted);
  color: var(--fc-text-main);
  font-size: 0.74rem;
}

.ag-report-empty {
  color: var(--fc-text-muted);
}

@media (max-width: 720px) {
  .ag-detail-header {
    flex-direction: column;
  }

  .ag-mini-grid {
    grid-template-columns: 1fr;
  }
}
</style>
