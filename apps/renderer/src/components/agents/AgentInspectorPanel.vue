<script setup lang="ts">
import type { AgentListItem, AuditListItem, TaskListItem } from '@familyco/ui';
import { ShieldCheck } from 'lucide-vue-next';
import { computed } from 'vue';

import { useI18n } from '../../composables/useI18n';
import FcCard from '../FcCard.vue';
import AgentActivityTimelineSection from './AgentActivityTimelineSection.vue';
import AgentCurrentTasksPanel from './AgentCurrentTasksPanel.vue';
import AgentProfileEditorSection from './AgentProfileEditorSection.vue';
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
  detailDraft: {
    name: string;
    role: string;
    department: string;
    status: AgentListItem['status'];
  };
  currentTasks: TaskListItem[];
  selectedTask: TaskListItem | null;
  selectedTaskId: string | null;
  activityHistory: AuditListItem[];
  detailError: string | null;
  isLoadingDetails: boolean;
  isSavingDetails: boolean;
  isSavingParent: boolean;
  getAgentInitials: (name: string) => string;
  getProjectName: (projectId: string) => string;
  formatRelative: (iso: string) => string;
  formatTimestamp: (iso: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:managerDraft', value: string): void;
  (event: 'save-manager'): void;
  (event: 'save-details'): void;
  (event: 'select-task', taskId: string): void;
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
          <p>{{ t('Review the selected agent, edit profile details, and inspect current execution context.') }}</p>
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

      <AgentProfileEditorSection
        :selected-agent="selectedAgent"
        :draft="detailDraft"
        :is-saving="isSavingDetails"
        :format-relative="formatRelative"
        :format-timestamp="formatTimestamp"
        @save="emit('save-details')"
      />

      <AgentCurrentTasksPanel
        :tasks="currentTasks"
        :selected-task="selectedTask"
        :selected-task-id="selectedTaskId"
        :is-loading="isLoadingDetails"
        :error-message="detailError"
        :get-project-name="getProjectName"
        :format-relative="formatRelative"
        :format-timestamp="formatTimestamp"
        @select-task="emit('select-task', $event)"
      />

      <AgentActivityTimelineSection
        :history="activityHistory"
        :is-loading="isLoadingDetails"
        :error-message="detailError"
        :format-relative="formatRelative"
        :format-timestamp="formatTimestamp"
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
