<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { Pause, Users } from 'lucide-vue-next';

import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';
import FcCard from '../FcCard.vue';
import FcInput from '../FcInput.vue';
import FcSelect from '../FcSelect.vue';

type AgentLevel = AgentListItem['level'];
type AgentStatus = AgentListItem['status'];

const STATUS_LABELS: Record<AgentStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  paused: 'Paused',
  archived: 'Archived'
};

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
    missingManager: number;
  };
  busy: Record<string, boolean>;
  getAgentName: (agentId: string | null) => string;
  getAgentInitials: (name: string) => string;
  getDirectReportCount: (agentId: string) => number;
}>();

const emit = defineEmits<{
  (event: 'select', agentId: string): void;
  (event: 'pause', agent: AgentListItem): void;
}>();
</script>

<template>
  <FcCard class="ag-list-card">
    <div class="ag-section-head">
      <div>
        <h4>Roster</h4>
        <p>Filter by level, status, or department and act from one simple list.</p>
      </div>
      <Users :size="16" class="ag-muted-icon" />
    </div>

    <div class="ag-filters">
      <FcInput v-model="filters.searchQuery" placeholder="Search by name, role, or department" />
      <FcSelect v-model="filters.level">
        <option value="all">All levels</option>
        <option value="L0">L0</option>
        <option value="L1">L1</option>
        <option value="L2">L2</option>
      </FcSelect>
      <FcSelect v-model="filters.status">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="idle">Idle</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
      </FcSelect>
      <FcSelect v-model="filters.department">
        <option value="all">All departments</option>
        <option v-for="department in departmentOptions" :key="department" :value="department">
          {{ department }}
        </option>
      </FcSelect>
    </div>

    <p class="ag-results-copy">
      Showing <strong>{{ filteredAgents.length }}</strong> of <strong>{{ agents.length }}</strong> agents.
      <template v-if="attentionSummary.paused || attentionSummary.missingManager">
        {{ attentionSummary.paused }} paused · {{ attentionSummary.missingManager }} missing manager.
      </template>
    </p>

    <div v-if="filteredAgents.length === 0" class="fc-empty ag-compact-empty">
      <h4>No agents match these filters</h4>
      <p>Try broadening the filters or create a new agent from the quick setup panel.</p>
    </div>

    <div v-else class="ag-roster-list">
      <div
        v-for="agent in filteredAgents"
        :key="agent.id"
        class="ag-agent-row"
        :class="{ 'is-selected': agent.id === selectedAgentId }"
        @click="emit('select', agent.id)"
      >
        <div class="ag-agent-main">
          <div class="ag-avatar" :data-level="agent.level">
            {{ getAgentInitials(agent.name) }}
          </div>

          <div class="ag-agent-copy">
            <div class="ag-agent-title">
              <strong>{{ agent.name }}</strong>
              <FcBadge :level="agent.level">{{ agent.level }}</FcBadge>
            </div>
            <p class="fc-list-meta">{{ agent.role }} · {{ agent.department }}</p>
            <p class="ag-agent-subcopy">
              {{ agent.level === 'L0' ? 'Company root' : `Reports to ${getAgentName(agent.parentAgentId)}` }}
              <span v-if="getDirectReportCount(agent.id) > 0">
                · {{ getDirectReportCount(agent.id) }} direct reports
              </span>
            </p>
          </div>
        </div>

        <div class="ag-row-actions">
          <span v-if="agent.level !== 'L0' && !agent.parentAgentId" class="fc-risk-tag" data-risk="medium">
            Manager needed
          </span>
          <FcBadge :status="agent.status">{{ STATUS_LABELS[agent.status] }}</FcBadge>
          <FcButton
            v-if="agent.status === 'active'"
            variant="secondary"
            size="sm"
            :disabled="busy[agent.id]"
            @click.stop="emit('pause', agent)"
          >
            <Pause :size="12" />
            {{ busy[agent.id] ? 'Pausing…' : 'Pause' }}
          </FcButton>
        </div>
      </div>
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

.ag-roster-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ag-agent-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ag-agent-row:hover {
  border-color: color-mix(in srgb, var(--fc-primary) 24%, var(--fc-border-subtle));
  box-shadow: 0 4px 10px rgba(16, 24, 40, 0.05);
}

.ag-agent-row.is-selected {
  border-color: color-mix(in srgb, var(--fc-primary) 40%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
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

.ag-agent-subcopy {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.ag-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ag-compact-empty {
  padding: 24px 18px;
}

@media (max-width: 720px) {
  .ag-filters {
    grid-template-columns: 1fr;
  }

  .ag-agent-row {
    flex-direction: column;
  }

  .ag-row-actions {
    justify-content: flex-start;
  }
}
</style>
