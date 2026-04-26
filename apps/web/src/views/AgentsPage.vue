<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { AlertTriangle, Bot, Info, Plus, RefreshCw } from 'lucide-vue-next';

import { useAgentsPage } from '../composables/useAgentsPage';
import SkeletonList from '../components/SkeletonList.vue';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import AgentCreatePanel from '../components/agents/AgentCreatePanel.vue';
import AgentExecutionModelCard from '../components/agents/AgentExecutionModelCard.vue';
import AgentInspectorPanel from '../components/agents/AgentInspectorPanel.vue';
import AgentOrgChartPanel from '../components/agents/AgentOrgChartPanel.vue';
import AgentRosterPanel from '../components/agents/AgentRosterPanel.vue';
import AgentSummaryCards from '../components/agents/AgentSummaryCards.vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
const heartbeatInfoOpen = ref(false);
const agentDetailOpen = ref(false);

const {
  AUTONOMY_GUIDE,
  agentState,
  agents,
  attentionSummary,
  busy,
  canDeleteAgent,
  createAgent,
  currentTasks,
  deploymentChecklist,
  departmentOptions,
  detailDraft,
  detailError,
  draft,
  draftManagerOptions,
  feedback,
  filteredAgents,
  filters,
  formatRelative,
  formatTimestamp,
  getAgentInitials,
  getAgentName,
  getDirectReportCount,
  getProjectName,
  history,
  isCreating,
  isLoading,
  isLoadingDetails,
  isRefreshing,
  isSavingDetails,
  isSavingParent,
  managerDraft,
  archiveAgent,
  deleteAgent,
  pauseAgent,
  resumeAgent,
  reload,
  saveAgentDetails,
  saveReportingLine,
  selectTask,
  selectedAgent,
  selectedAgentId,
  selectedAutonomy,
  selectedDirectReports,
  selectedManager,
  selectedManagerOptions,
  selectedPath,
  selectedTask,
  selectedTaskId,
  setFeedback,
  showCreateForm,
  summaryMetrics,
  templateCards,
  applyTemplate
} = useAgentsPage();

const openAgentDetails = (agentId: string): void => {
  selectedAgentId.value = agentId;
  agentDetailOpen.value = true;
};
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Agents') }}</h3>
        <p>{{ t('Manage heartbeat-based AI employees with one required L0 executive by default, then add optional roles as the company grows.') }}</p>
      </div>
      <div class="fc-inline-actions">
        <FcButton
          variant="ghost"
          size="icon"
          :title="t('Heartbeat execution model')"
          :aria-label="t('Heartbeat execution model')"
          @click="heartbeatInfoOpen = true"
        >
          <Info :size="14" />
        </FcButton>
        <FcButton variant="secondary" :disabled="isRefreshing" @click="reload">
          <RefreshCw :size="14" />
          {{ isRefreshing ? t('Refreshing…') : t('Refresh') }}
        </FcButton>
        <FcButton variant="primary" @click="showCreateForm = !showCreateForm">
          <Plus :size="14" />
          {{ showCreateForm ? t('Close setup') : t('New agent') }}
        </FcButton>
      </div>
    </div>

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

    <AgentSummaryCards :metrics="summaryMetrics" :attention-summary="attentionSummary" />

    <AgentOrgChartPanel
      v-if="agents.length > 1"
      :agents="agents"
      :get-agent-initials="getAgentInitials"
      :get-agent-name="getAgentName"
      :get-direct-report-count="getDirectReportCount"
    />

    <AgentExecutionModelCard :open="heartbeatInfoOpen" @close="heartbeatInfoOpen = false" />

    <Transition name="fc-banner">
      <AgentCreatePanel
        v-if="showCreateForm"
        :draft="draft"
        :template-cards="templateCards"
        :draft-manager-options="draftManagerOptions"
        :autonomy-guide="AUTONOMY_GUIDE[draft.level]"
        :is-creating="isCreating"
        @apply-template="applyTemplate"
        @create="createAgent"
        @close="showCreateForm = false"
      />
    </Transition>

    <div v-if="isLoading" class="fc-loading">
      <p style="margin:0 0 12px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading agents…') }}</p>
      <SkeletonList />
    </div>

    <div v-else-if="agentState.errorMessage" class="fc-error">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <AlertTriangle :size="16" />
        <p style="margin:0;">{{ agentState.errorMessage }}</p>
      </div>
      <FcButton variant="secondary" size="sm" @click="reload">
        <RefreshCw :size="13" />
        {{ t('Retry') }}
      </FcButton>
    </div>

    <div v-else-if="agentState.isEmpty" class="fc-empty">
      <Bot :size="36" class="fc-empty-icon" />
      <h4>{{ t('No agents yet') }}</h4>
      <p>{{ t('One executive agent is enough to start. Add department leads and specialists later through the approval flow.') }}</p>
      <RouterLink to="/setup" class="fc-btn-primary">
        <Plus :size="14" />
        {{ t('Open setup') }}
      </RouterLink>
    </div>

    <div v-else>
      <AgentRosterPanel
        :agents="agents"
        :filtered-agents="filteredAgents"
        :selected-agent-id="selectedAgent?.id ?? null"
        :department-options="departmentOptions"
        :filters="filters"
        :attention-summary="attentionSummary"
        :busy="busy"
        :can-delete-agent="canDeleteAgent"
        :get-agent-name="getAgentName"
        :get-agent-initials="getAgentInitials"
        :get-direct-report-count="getDirectReportCount"
        :format-relative="formatRelative"
        @select="openAgentDetails"
        @delete="deleteAgent"
        @pause="pauseAgent"
        @resume="resumeAgent"
        @archive="archiveAgent"
      />

      <AgentInspectorPanel
        :open="agentDetailOpen"
        :selected-agent="selectedAgent"
        :selected-manager="selectedManager"
        :selected-direct-reports="selectedDirectReports"
        :selected-path="selectedPath"
        :selected-autonomy="selectedAutonomy"
        :deployment-checklist="deploymentChecklist"
        :selected-manager-options="selectedManagerOptions"
        :manager-draft="managerDraft"
        :detail-draft="detailDraft"
        :current-tasks="currentTasks"
        :selected-task="selectedTask"
        :selected-task-id="selectedTaskId"
        :activity-history="history"
        :detail-error="detailError"
        :is-loading-details="isLoadingDetails"
        :is-saving-details="isSavingDetails"
        :is-saving-parent="isSavingParent"
        :get-agent-initials="getAgentInitials"
        :get-project-name="getProjectName"
        :format-relative="formatRelative"
        :format-timestamp="formatTimestamp"
        @close="agentDetailOpen = false"
        @update:manager-draft="managerDraft = $event"
        @save-manager="saveReportingLine"
        @save-details="saveAgentDetails"
        @select-task="selectTask"
        @ai-feedback="(type, text) => setFeedback(type, text)"
      />
    </div>
  </section>
</template>
