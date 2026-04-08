<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { Pause, Users } from 'lucide-vue-next';

import { AGENT_STATUS_META, PAUSABLE_AGENT_STATUSES } from '../../composables/agents-page.config';
import { useI18n } from '../../composables/useI18n';
import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';
import FcCard from '../FcCard.vue';
import FcInput from '../FcInput.vue';
import FcSelect from '../FcSelect.vue';

type AgentLevel = AgentListItem['level'];
type AgentStatus = AgentListItem['status'];

const STATUS_OPTIONS: AgentStatus[] = ['active', 'idle', 'running', 'error', 'paused', 'terminated'];

defineProps<{
  agents: AgentListItem[];
  filteredAgents: AgentListItem[];
  selectedAgentId: string | null;
  departmentOptions: string[];
  filters: {
    searchQuery: string;
    level: 'all' | AgentLevel;
    status: 'all' | AgentStatus;
    department: string;
  };
  attentionSummary: {
    paused: number;
    error: number;
    terminated: number;
    missingManager: number;
  };
  busy: Record<string, boolean>;
  getAgentName: (agentId: string | null) => string;
  getAgentInitials: (name: string) => string;
  getDirectReportCount: (agentId: string) => number;
  formatRelative: (iso: string) => string;
}>();

const emit = defineEmits<{
  (event: 'select', agentId: string): void;
  (event: 'pause', agent: AgentListItem): void;
}>();

const { t } = useI18n();

const getStatusLabel = (status: AgentStatus): string => t(AGENT_STATUS_META[status].label);
const canPause = (status: AgentStatus): boolean => PAUSABLE_AGENT_STATUSES.includes(status);
</script>

<template>
  <FcCard class="ag-list-card">
    <div class="ag-section-head">
      <div>
        <h4>{{ t('Roster') }}</h4>
        <p>{{ t('Filter by level, status, or department and act from one simple list.') }}</p>
      </div>
      <Users :size="16" class="ag-muted-icon" />
    </div>

    <div class="ag-filters">
      <FcInput v-model="filters.searchQuery" :placeholder="t('Search by name, role, or department')" />
      <FcSelect v-model="filters.level">
        <option value="all">{{ t('All levels') }}</option>
        <option value="L0">L0</option>
        <option value="L1">L1</option>
        <option value="L2">L2</option>
      </FcSelect>
      <FcSelect v-model="filters.status">
        <option value="all">{{ t('All statuses') }}</option>
        <option v-for="status in STATUS_OPTIONS" :key="status" :value="status">
          {{ getStatusLabel(status) }}
        </option>
      </FcSelect>
      <FcSelect v-model="filters.department">
        <option value="all">{{ t('All departments') }}</option>
        <option v-for="department in departmentOptions" :key="department" :value="department">
          {{ department }}
        </option>
      </FcSelect>
    </div>

    <p class="ag-results-copy">
      {{ t('Roster results summary', { shown: filteredAgents.length, total: agents.length }) }}
      <template v-if="attentionSummary.paused || attentionSummary.error || attentionSummary.missingManager || attentionSummary.terminated">
        {{
          t('Roster attention summary', {
            paused: attentionSummary.paused,
            error: attentionSummary.error,
            missing: attentionSummary.missingManager
          })
        }}
        <template v-if="attentionSummary.terminated">
          · {{ t('Terminated count label', { count: attentionSummary.terminated }) }}
        </template>
      </template>
    </p>

    <div v-if="filteredAgents.length === 0" class="fc-empty ag-compact-empty">
      <h4>{{ t('No agents match these filters') }}</h4>
      <p>{{ t('Try broadening the filters or create a new agent from the quick setup panel.') }}</p>
    </div>

    <div v-else class="ag-table-shell">
      <table class="ag-table">
        <thead>
          <tr>
            <th>{{ t('Agent') }}</th>
            <th>{{ t('Role') }}</th>
            <th>{{ t('Team') }}</th>
            <th>{{ t('Status') }}</th>
            <th>{{ t('Last update') }}</th>
            <th>{{ t('Actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="agent in filteredAgents"
            :key="agent.id"
            :class="{ 'is-selected': agent.id === selectedAgentId }"
            @click="emit('select', agent.id)"
          >
            <td>
              <div class="ag-agent-main">
                <div class="ag-avatar" :data-level="agent.level">
                  {{ getAgentInitials(agent.name) }}
                </div>
                <div class="ag-agent-copy">
                  <div class="ag-agent-title">
                    <strong>{{ agent.name }}</strong>
                    <FcBadge :level="agent.level">{{ agent.level }}</FcBadge>
                  </div>
                  <p class="fc-list-meta">{{ agent.department }}</p>
                </div>
              </div>
            </td>
            <td>
              <strong class="ag-cell-strong">{{ agent.role }}</strong>
            </td>
            <td>
              <p class="ag-agent-subcopy">
                {{ agent.level === 'L0' ? t('Company root') : t('Reports to label', { name: getAgentName(agent.parentAgentId) }) }}
              </p>
              <p v-if="getDirectReportCount(agent.id) > 0" class="fc-list-meta">
                {{ t('Direct reports count', { count: getDirectReportCount(agent.id) }) }}
              </p>
            </td>
            <td>
              <div class="ag-status-stack">
                <span v-if="agent.level !== 'L0' && !agent.parentAgentId" class="fc-risk-tag" data-risk="medium">
                  {{ t('Manager needed') }}
                </span>
                <FcBadge :status="agent.status">{{ getStatusLabel(agent.status) }}</FcBadge>
              </div>
            </td>
            <td>
              <span :title="agent.updatedAt">{{ formatRelative(agent.updatedAt) }}</span>
            </td>
            <td>
              <div class="ag-row-actions">
                <FcButton variant="secondary" size="sm" @click.stop="emit('select', agent.id)">
                  {{ t('View') }}
                </FcButton>
                <FcButton
                  v-if="canPause(agent.status)"
                  variant="secondary"
                  size="sm"
                  :disabled="busy[agent.id]"
                  @click.stop="emit('pause', agent)"
                >
                  <Pause :size="12" />
                  {{ busy[agent.id] ? t('Pausing…') : t('Pause') }}
                </FcButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </FcCard>
</template>

<style scoped>
.ag-list-card {
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

.ag-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 0.8fr));
  gap: 8px;
}

.ag-results-copy {
  margin: 0;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.ag-table-shell {
  overflow-x: auto;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
}

.ag-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
}

.ag-table th,
.ag-table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--fc-border-subtle);
}

.ag-table th {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fc-text-muted);
  background: var(--fc-surface-muted);
}

.ag-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-table tbody tr:hover {
  background: color-mix(in srgb, var(--fc-primary) 4%, var(--fc-surface));
}

.ag-table tbody tr.is-selected {
  background: color-mix(in srgb, var(--fc-primary) 7%, var(--fc-surface));
}

.ag-table tbody tr:last-child td {
  border-bottom: none;
}

.ag-agent-main {
  display: flex;
  gap: 12px;
  min-width: 0;
}

.ag-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.82rem;
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

.ag-agent-copy {
  min-width: 0;
}

.ag-agent-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ag-agent-title strong {
  font-size: 0.9rem;
}

.ag-cell-strong {
  font-size: 0.84rem;
  line-height: 1.35;
}

.ag-agent-subcopy {
  margin: 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.ag-status-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.ag-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ag-compact-empty {
  padding: 24px 18px;
}

@media (max-width: 720px) {
  .ag-filters {
    grid-template-columns: 1fr;
  }
}
</style>
