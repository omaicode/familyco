<script setup lang="ts">
import type { AgentListItem, AuditListItem, TaskListItem } from '@familyco/ui';
import { ShieldCheck, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { useI18n } from '../../composables/useI18n';
import FcButton from '../FcButton.vue';
import AgentActivityTimelineSection from './AgentActivityTimelineSection.vue';
import AgentCurrentTasksPanel from './AgentCurrentTasksPanel.vue';
import AgentProfileEditorSection from './AgentProfileEditorSection.vue';
import AgentReadinessChecklist from './AgentReadinessChecklist.vue';
import AgentTeamSnapshot from './AgentTeamSnapshot.vue';

const props = defineProps<{
  open: boolean;
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
  (event: 'close'): void;
  (event: 'update:managerDraft', value: string): void;
  (event: 'save-manager'): void;
  (event: 'save-details'): void;
  (event: 'select-task', taskId: string): void;
}>();

const { t } = useI18n();

type AgentDetailTab = 'overview' | 'profile' | 'tasks' | 'activity';

const activeTab = ref<AgentDetailTab>('overview');

watch(
  () => [props.open, props.selectedAgent?.id],
  ([open]) => {
    if (open) {
      activeTab.value = 'overview';
    }
  },
  { immediate: true }
);

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
  <Transition name="fc-page">
    <div v-if="open && selectedAgent" class="ag-modal-wrap" @click.self="emit('close')">
      <div class="ag-modal" role="dialog" aria-modal="true" :aria-label="selectedAgent.name">
        <div class="ag-modal-header">
          <div>
            <p class="ag-modal-eyebrow">{{ t('Details') }}</p>
            <h4>{{ selectedAgent.name }}</h4>
            <p>{{ t('Review the selected agent, edit profile details, and inspect current execution context.') }}</p>
          </div>

          <div class="ag-modal-actions">
            <span class="ag-modal-icon">
              <ShieldCheck :size="16" />
            </span>
            <FcButton
              variant="ghost"
              size="icon"
              :title="t('Close')"
              :aria-label="t('Close')"
              @click="emit('close')"
            >
              <X :size="14" />
            </FcButton>
          </div>
        </div>

        <div class="ag-modal-tabbar fc-tabs" role="tablist" :aria-label="t('Details')">
          <button class="fc-tab" :class="{ 'fc-tab-active': activeTab === 'overview' }" @click="activeTab = 'overview'">
            {{ t('Overview') }}
          </button>
          <button class="fc-tab" :class="{ 'fc-tab-active': activeTab === 'profile' }" @click="activeTab = 'profile'">
            {{ t('Agent profile') }}
          </button>
          <button class="fc-tab" :class="{ 'fc-tab-active': activeTab === 'tasks' }" @click="activeTab = 'tasks'">
            {{ t('Tasks') }}
          </button>
          <button class="fc-tab" :class="{ 'fc-tab-active': activeTab === 'activity' }" @click="activeTab = 'activity'">
            {{ t('Recent activity') }}
          </button>
        </div>

        <div class="ag-modal-body">
          <div v-if="warningMessage" class="fc-warning">
            <p>{{ warningMessage }}</p>
          </div>

          <div v-show="activeTab === 'overview'" class="ag-modal-pane">
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
          </div>

          <AgentProfileEditorSection
            v-show="activeTab === 'profile'"
            :selected-agent="selectedAgent"
            :draft="detailDraft"
            :is-saving="isSavingDetails"
            :format-relative="formatRelative"
            :format-timestamp="formatTimestamp"
            @save="emit('save-details')"
          />

          <AgentCurrentTasksPanel
            v-show="activeTab === 'tasks'"
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
            v-show="activeTab === 'activity'"
            :history="activityHistory"
            :is-loading="isLoadingDetails"
            :error-message="detailError"
            :format-relative="formatRelative"
            :format-timestamp="formatTimestamp"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ag-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px 12px;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(3px);
}

.ag-modal {
  width: min(1120px, calc(100vw - 24px));
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border-radius: 18px;
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
}

.ag-modal-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--fc-border-subtle);
  background: color-mix(in srgb, var(--fc-surface) 92%, white);
}

.ag-modal-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.ag-modal-header p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: var(--fc-text-muted);
}

.ag-modal-eyebrow {
  margin: 0 0 4px !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ag-modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ag-modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--fc-primary);
  background: color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface));
}

.ag-modal-tabbar {
  margin: 0 18px;
}

.ag-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
}

.ag-modal-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 720px) {
  .ag-modal-wrap {
    padding: 12px 8px;
  }

  .ag-modal-header {
    padding: 14px;
  }

  .ag-modal-tabbar {
    margin: 0 14px;
  }

  .ag-modal-body {
    padding: 14px;
  }
}
</style>
