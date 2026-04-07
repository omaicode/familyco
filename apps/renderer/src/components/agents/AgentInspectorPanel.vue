<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { ShieldCheck } from 'lucide-vue-next';
import { computed } from 'vue';

import { useI18n } from '../../composables/useI18n';
import FcCard from '../FcCard.vue';
import AgentReadinessChecklist from './AgentReadinessChecklist.vue';
import AgentTeamSnapshot from './AgentTeamSnapshot.vue';

const props = defineProps<{
  selectedAgent: AgentListItem | null;
  selectedManager: AgentListItem | null;
  selectedDirectReports: AgentListItem[];
  selectedPath: AgentListItem[];
  selectedAutonomy: {
    label: string;
    description: string;
    note: string;
  };
  deploymentChecklist: Array<{
    title: string;
    text: string;
    done: boolean;
  }>;
  selectedManagerOptions: AgentListItem[];
  managerDraft: string;
  isSavingParent: boolean;
  getAgentInitials: (name: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:managerDraft', value: string): void;
  (event: 'save-manager'): void;
}>();

const { t } = useI18n();

const warningMessage = computed(() => {
  const agent = props.selectedAgent;
  if (!agent) {
    return null;
  }

  if (agent.status === 'paused') {
    return t('This agent is paused and will not receive new heartbeats.');
  }

  if (agent.status === 'error') {
    return t('This agent needs attention because the last heartbeat failed.');
  }

  if (agent.status === 'terminated') {
    return t('This agent has been permanently deactivated.');
  }

  if (agent.level !== 'L0' && !agent.parentAgentId) {
    return t('This agent still needs a manager assignment.');
  }

  return null;
});
</script>

<template>
  <FcCard class="ag-detail-card">
    <template v-if="selectedAgent">
      <div class="ag-section-head">
        <div>
          <h4>{{ t('Inspector') }}</h4>
          <p>{{ t('Review heartbeat state, reporting line, and session continuity for the selected agent.') }}</p>
        </div>
        <ShieldCheck :size="16" class="ag-muted-icon" />
      </div>

      <div v-if="warningMessage" class="fc-warning">
        <p>{{ warningMessage }}</p>
      </div>

      <AgentTeamSnapshot
        :selected-agent="selectedAgent"
        :selected-manager="selectedManager"
        :selected-direct-reports="selectedDirectReports"
        :selected-path="selectedPath"
        :selected-manager-options="selectedManagerOptions"
        :manager-draft="managerDraft"
        :is-saving-parent="isSavingParent"
        :get-agent-initials="getAgentInitials"
        @update:manager-draft="emit('update:managerDraft', $event)"
        @save-manager="emit('save-manager')"
      />

      <AgentReadinessChecklist
        :selected-autonomy="selectedAutonomy"
        :deployment-checklist="deploymentChecklist"
      />
    </template>

    <div v-else class="fc-empty ag-empty-panel">
      <h4>{{ t('Select an agent') }}</h4>
      <p>{{ t('Pick a row from the roster to review configuration and team placement.') }}</p>
    </div>
  </FcCard>
</template>

<style scoped>
.ag-detail-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ag-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ag-section-head h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.ag-section-head p {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
}

.ag-muted-icon {
  color: var(--fc-text-faint);
  flex-shrink: 0;
}

.ag-empty-panel {
  padding: 36px 20px;
}
</style>
