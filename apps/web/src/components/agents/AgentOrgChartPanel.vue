<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { computed } from 'vue';
import { Building2, Network, Users2 } from 'lucide-vue-next';

import { useI18n } from '../../composables/useI18n';
import FcBadge from '../FcBadge.vue';
import FcCard from '../FcCard.vue';

const props = defineProps<{
  agents: AgentListItem[];
  getAgentInitials: (name: string) => string;
  getAgentName: (agentId: string | null) => string;
  getDirectReportCount: (agentId: string) => number;
}>();

const { t } = useI18n();

const levelGroups = computed(() => ({
  L0: props.agents.filter((agent) => agent.level === 'L0'),
  L1: props.agents.filter((agent) => agent.level === 'L1'),
  L2: props.agents.filter((agent) => agent.level === 'L2')
}));

const levelMeta = {
  L0: {
    icon: Building2,
    title: 'L0 executive layer',
    hint: 'Company-wide direction and final approvals.'
  },
  L1: {
    icon: Network,
    title: 'L1 lead layer',
    hint: 'Department leads translating strategy into queues.'
  },
  L2: {
    icon: Users2,
    title: 'L2 specialist layer',
    hint: 'Execution specialists attached to a lead or root.'
  }
} as const;
</script>

<template>
  <FcCard class="ag-org-card">
    <div class="ag-org-head">
      <div>
        <h4>{{ t('Org chart') }}</h4>
        <p>{{ t('See how executives, leads, and specialists connect before you open the inspector.') }}</p>
      </div>
      <Network :size="16" class="ag-org-head-icon" />
    </div>

    <div class="ag-org-grid">
      <section v-for="level in ['L0', 'L1', 'L2'] as const" :key="level" class="ag-org-lane">
        <div class="ag-org-lane-head">
          <component :is="levelMeta[level].icon" :size="15" />
          <div>
            <strong>{{ t(levelMeta[level].title) }}</strong>
            <p>{{ t(levelMeta[level].hint) }}</p>
          </div>
        </div>

        <div v-if="levelGroups[level].length > 0" class="ag-org-stack">
          <article v-for="agent in levelGroups[level]" :key="agent.id" class="ag-org-node" :data-level="agent.level">
            <div class="ag-org-node-top">
              <div class="ag-org-avatar" :data-level="agent.level">
                {{ getAgentInitials(agent.name) }}
              </div>
              <div>
                <div class="ag-org-title-row">
                  <strong>{{ agent.name }}</strong>
                  <FcBadge :level="agent.level">{{ agent.level }}</FcBadge>
                </div>
                <p>{{ agent.role }}</p>
              </div>
            </div>

            <dl class="ag-org-meta">
              <div>
                <dt>{{ t('Department') }}</dt>
                <dd>{{ agent.department }}</dd>
              </div>
              <div>
                <dt>{{ t('Reports to') }}</dt>
                <dd>{{ agent.level === 'L0' ? t('Company root') : getAgentName(agent.parentAgentId) }}</dd>
              </div>
              <div>
                <dt>{{ t('Direct reports') }}</dt>
                <dd>{{ getDirectReportCount(agent.id) }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <div v-else class="ag-org-empty">
          {{ t('No agents in this layer yet.') }}
        </div>
      </section>
    </div>
  </FcCard>
</template>

<style scoped>
.ag-org-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.ag-org-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.ag-org-head h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.ag-org-head p,
.ag-org-lane-head p,
.ag-org-node-top p {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
}

.ag-org-head-icon {
  color: var(--fc-text-faint);
  flex-shrink: 0;
}

.ag-org-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ag-org-lane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.ag-org-lane-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border-radius: 12px;
  background: var(--fc-surface-muted);
  border: 1px solid var(--fc-border-subtle);
}

.ag-org-lane-head strong {
  display: block;
  font-size: 0.84rem;
}

.ag-org-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ag-org-node {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
}

.ag-org-node[data-level='L0'] {
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
}

.ag-org-node-top {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.ag-org-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--fc-border-subtle);
  font-size: 0.82rem;
  font-weight: 700;
  flex-shrink: 0;
}

.ag-org-avatar[data-level='L0'] {
  background: color-mix(in srgb, #7B61FF 12%, var(--fc-surface));
  color: #7B61FF;
}

.ag-org-avatar[data-level='L1'] {
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
  color: var(--fc-info);
}

.ag-org-avatar[data-level='L2'] {
  background: color-mix(in srgb, var(--fc-warning) 12%, var(--fc-surface));
  color: var(--fc-warning);
}

.ag-org-title-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.ag-org-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0 0;
}

.ag-org-meta div {
  min-width: 0;
}

.ag-org-meta dt {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fc-text-muted);
}

.ag-org-meta dd {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--fc-text-main);
  word-break: break-word;
}

.ag-org-empty {
  padding: 16px;
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 12px;
  font-size: 0.82rem;
  color: var(--fc-text-muted);
  background: var(--fc-surface-muted);
}

@media (max-width: 960px) {
  .ag-org-grid {
    grid-template-columns: 1fr;
  }

  .ag-org-meta {
    grid-template-columns: 1fr;
  }
}
</style>