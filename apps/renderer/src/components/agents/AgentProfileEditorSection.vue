<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { FilePenLine } from 'lucide-vue-next';
import { computed } from 'vue';

import { AGENT_STATUS_META } from '../../composables/agents-page.config';
import { useI18n } from '../../composables/useI18n';
import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';
import FcInput from '../FcInput.vue';
import FcSelect from '../FcSelect.vue';

const STATUS_OPTIONS: Array<AgentListItem['status']> = ['active', 'idle', 'running', 'error', 'paused', 'terminated'];

const props = defineProps<{
  selectedAgent: AgentListItem;
  draft: {
    name: string;
    role: string;
    department: string;
    status: AgentListItem['status'];
  };
  isSaving: boolean;
  formatRelative: (iso: string) => string;
  formatTimestamp: (iso: string) => string;
}>();

const emit = defineEmits<{
  (event: 'save'): void;
}>();

const { t } = useI18n();

const isDirty = computed(() =>
  props.draft.name.trim() !== props.selectedAgent.name ||
  props.draft.role.trim() !== props.selectedAgent.role ||
  props.draft.department.trim() !== props.selectedAgent.department ||
  props.draft.status !== props.selectedAgent.status
);

const canSave = computed(() =>
  !props.isSaving &&
  isDirty.value &&
  props.draft.name.trim().length > 0 &&
  props.draft.role.trim().length > 0 &&
  props.draft.department.trim().length > 0
);

const getStatusLabel = (status: AgentListItem['status']): string => t(AGENT_STATUS_META[status].label);
</script>

<template>
  <section class="ag-subsection">
    <div class="ag-subsection-head">
      <div>
        <h5>{{ t('Agent profile') }}</h5>
        <p>{{ t('Update the display name, role, department, and runtime status for this agent.') }}</p>
      </div>
      <FilePenLine :size="16" class="ag-muted-icon" />
    </div>

    <div class="ag-overview-grid">
      <div class="ag-overview-item">
        <span>{{ t('Level') }}</span>
        <strong>{{ selectedAgent.level }}</strong>
      </div>
      <div class="ag-overview-item">
        <span>{{ t('Status') }}</span>
        <strong>
          <FcBadge :status="selectedAgent.status">{{ getStatusLabel(selectedAgent.status) }}</FcBadge>
        </strong>
      </div>
      <div class="ag-overview-item">
        <span>{{ t('Created') }}</span>
        <strong :title="formatTimestamp(selectedAgent.createdAt)">{{ formatRelative(selectedAgent.createdAt) }}</strong>
      </div>
      <div class="ag-overview-item">
        <span>{{ t('Last update') }}</span>
        <strong :title="formatTimestamp(selectedAgent.updatedAt)">{{ formatRelative(selectedAgent.updatedAt) }}</strong>
      </div>
    </div>

    <div class="ag-form-grid">
      <div class="fc-form-group">
        <label class="fc-label">{{ t('Name') }}</label>
        <FcInput v-model="draft.name" :placeholder="t('e.g. Nora — Ops Lead')" />
      </div>
      <div class="fc-form-group">
        <label class="fc-label">{{ t('Role') }}</label>
        <FcInput v-model="draft.role" :placeholder="t('e.g. Operations Lead')" />
      </div>
      <div class="fc-form-group">
        <label class="fc-label">{{ t('Department') }}</label>
        <FcInput v-model="draft.department" :placeholder="t('e.g. Operations')" />
      </div>
      <div class="fc-form-group">
        <label class="fc-label">{{ t('Status') }}</label>
        <FcSelect v-model="draft.status">
          <option v-for="status in STATUS_OPTIONS" :key="status" :value="status">
            {{ getStatusLabel(status) }}
          </option>
        </FcSelect>
      </div>
    </div>

    <div class="fc-toolbar ag-toolbar-end">
      <FcButton variant="primary" size="sm" :disabled="!canSave" @click="emit('save')">
        {{ isSaving ? t('Saving…') : t('Save changes') }}
      </FcButton>
    </div>
  </section>
</template>

<style scoped>
.ag-subsection {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface-muted);
}

.ag-subsection-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ag-subsection-head h5 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.ag-subsection-head p {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.ag-muted-icon {
  color: var(--fc-text-faint);
  flex-shrink: 0;
}

.ag-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.ag-overview-item {
  padding: 10px 12px;
  border-radius: var(--fc-control-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
}

.ag-overview-item span {
  display: block;
  margin-bottom: 4px;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
}

.ag-overview-item strong {
  font-size: 0.82rem;
}

.ag-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ag-toolbar-end {
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .ag-overview-grid,
  .ag-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
