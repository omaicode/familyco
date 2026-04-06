<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { ShieldCheck } from 'lucide-vue-next';

import FcCard from '../FcCard.vue';
import AgentReadinessChecklist from './AgentReadinessChecklist.vue';
import AgentTeamSnapshot from './AgentTeamSnapshot.vue';

defineProps<{
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
</script>

<template>
  <FcCard class="ag-detail-card">
    <template v-if="selectedAgent">
      <div class="ag-section-head">
        <div>
          <h4>Inspector</h4>
          <p>Review ownership, governance, and rollout readiness for the selected agent.</p>
        </div>
        <ShieldCheck :size="16" class="ag-muted-icon" />
      </div>

      <div
        v-if="selectedAgent.status === 'paused' || (selectedAgent.level !== 'L0' && !selectedAgent.parentAgentId)"
        class="fc-warning"
      >
        <p>
          {{
            selectedAgent.status === 'paused'
              ? 'This agent is paused and will not receive new work.'
              : 'This agent still needs a manager assignment.'
          }}
        </p>
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
      <h4>Select an agent</h4>
      <p>Pick a row from the roster to review configuration and team placement.</p>
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
