<script setup lang="ts">
import { AlertTriangle, Bot, Plus, RefreshCw } from 'lucide-vue-next';

import { useAgentsPage } from '../composables/useAgentsPage';
import SkeletonList from '../components/SkeletonList.vue';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import AgentCreatePanel from '../components/agents/AgentCreatePanel.vue';
import AgentInspectorPanel from '../components/agents/AgentInspectorPanel.vue';
import AgentRosterPanel from '../components/agents/AgentRosterPanel.vue';
import AgentSummaryCards from '../components/agents/AgentSummaryCards.vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const {
  AUTONOMY_GUIDE,
  agentState,
  agents,
  attentionSummary,
  busy,
  createAgent,
  deploymentChecklist,
  departmentOptions,
  draft,
  draftManagerOptions,
  feedback,
  filteredAgents,
  filters,
  getAgentInitials,
  getAgentName,
  getDirectReportCount,
  isCreating,
  isLoading,
  isRefreshing,
  isSavingParent,
  managerDraft,
  pauseAgent,
  reload,
  saveReportingLine,
  selectedAgent,
  selectedAgentId,
  selectedAutonomy,
  selectedDirectReports,
  selectedManager,
  selectedManagerOptions,
  selectedPath,
  showCreateForm,
  summaryMetrics,
  templateCards,
  applyTemplate
} = useAgentsPage();
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Agents') }}</h3>
        <p>{{ t('Manage your AI team with one required L0 executive by default, then add optional roles as the company grows.') }}</p>
      </div>
      <div class="fc-inline-actions">
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
      <FcButton variant="primary" @click="applyTemplate('executive')">
        <Plus :size="14" />
        {{ t('Create first agent') }}
      </FcButton>
    </div>

    <div v-else class="ag-main-grid">
      <AgentRosterPanel
        :agents="agents"
        :filtered-agents="filteredAgents"
        :selected-agent-id="selectedAgent?.id ?? null"
        :department-options="departmentOptions"
        :filters="filters"
        :attention-summary="attentionSummary"
        :busy="busy"
        :get-agent-name="getAgentName"
        :get-agent-initials="getAgentInitials"
        :get-direct-report-count="getDirectReportCount"
        @select="selectedAgentId = $event"
        @pause="pauseAgent"
      />

      <AgentInspectorPanel
        :selected-agent="selectedAgent"
        :selected-manager="selectedManager"
        :selected-direct-reports="selectedDirectReports"
        :selected-path="selectedPath"
        :selected-autonomy="selectedAutonomy"
        :deployment-checklist="deploymentChecklist"
        :selected-manager-options="selectedManagerOptions"
        :manager-draft="managerDraft"
        :is-saving-parent="isSavingParent"
        :get-agent-initials="getAgentInitials"
        @update:manager-draft="managerDraft = $event"
        @save-manager="saveReportingLine"
      />
    </div>
  </section>
</template>

<style scoped>
.ag-main-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 12px;
  align-items: start;
}

@media (max-width: 1100px) {
  .ag-main-grid {
    grid-template-columns: 1fr;
  }
}
</style>
