<script setup lang="ts">
import { Activity, Clock3, Database } from 'lucide-vue-next';

import { AGENT_STATUS_META } from '../../composables/agents-page.config';
import { useI18n } from '../../composables/useI18n';
import FcBadge from '../FcBadge.vue';
import FcCard from '../FcCard.vue';

const { t } = useI18n();

const executionSteps = [
  {
    title: 'Trigger',
    text: 'A schedule, assignment, mention, or manual invoke wakes the agent.'
  },
  {
    title: 'Adapter invocation',
    text: 'FamilyCo calls the configured adapter for that heartbeat.'
  },
  {
    title: 'Agent process',
    text: 'The adapter spawns the runtime that performs the short burst of work.'
  },
  {
    title: 'FamilyCo API calls',
    text: 'The agent checks assignments, claims tasks, and updates progress through FamilyCo APIs.'
  },
  {
    title: 'Result capture',
    text: 'Output, usage, costs, and session state are captured after the run.'
  },
  {
    title: 'Run record',
    text: 'Each heartbeat leaves an audit trail for debugging and review.'
  }
] as const;

const statusEntries = (Object.keys(AGENT_STATUS_META) as Array<keyof typeof AGENT_STATUS_META>).map((status) => ({
  status,
  ...AGENT_STATUS_META[status]
}));
</script>

<template>
  <FcCard class="ag-execution-card">
    <div class="ag-section-head">
      <div>
        <h4>{{ t('Heartbeat execution model') }}</h4>
        <p>{{ t('Agents wake up, work in short bursts, and go back to sleep with context restored on the next wake.') }}</p>
      </div>
      <Activity :size="16" class="ag-muted-icon" />
    </div>

    <div class="ag-pill-row">
      <div class="ag-pill">
        <Clock3 :size="14" />
        <span>{{ t('Short heartbeat bursts instead of always-on workers') }}</span>
      </div>
      <div class="ag-pill">
        <Database :size="14" />
        <span>{{ t('Session persistence keeps context across heartbeats') }}</span>
      </div>
    </div>

    <div class="ag-execution-grid">
      <ol class="ag-step-list">
        <li v-for="step in executionSteps" :key="step.title" class="ag-step-item">
          <strong>{{ t(step.title) }}</strong>
          <p>{{ t(step.text) }}</p>
        </li>
      </ol>

      <div class="ag-status-panel">
        <h5>{{ t('Status reference') }}</h5>
        <div v-for="entry in statusEntries" :key="entry.status" class="ag-status-row">
          <FcBadge :status="entry.status">{{ t(entry.label) }}</FcBadge>
          <p>{{ t(entry.description) }}</p>
        </div>
      </div>
    </div>

    <div class="ag-session-note">
      <strong>{{ t('Session persistence') }}</strong>
      <p>{{ t('After each heartbeat, the adapter saves session state so the next wake can continue without re-reading the full thread.') }}</p>
      <small>{{ t('Run outputs, usage, and debugging details should be captured in the audit trail for every heartbeat.') }}</small>
    </div>
  </FcCard>
</template>

<style scoped>
.ag-execution-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
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

.ag-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ag-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface-muted);
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.ag-execution-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 12px;
}

.ag-step-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
}

.ag-step-item strong {
  display: block;
  font-size: 0.82rem;
  margin-bottom: 2px;
}

.ag-step-item p,
.ag-status-row p,
.ag-session-note p,
.ag-session-note small {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--fc-text-muted);
}

.ag-status-panel {
  padding: 12px;
  border-radius: var(--fc-card-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface-muted);
}

.ag-status-panel h5 {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
}

.ag-status-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: start;
}

.ag-status-row + .ag-status-row {
  margin-top: 8px;
}

.ag-session-note {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--fc-info) 26%, var(--fc-border-subtle));
  border-radius: var(--fc-card-radius);
  background: color-mix(in srgb, var(--fc-info) 6%, var(--fc-surface));
}

.ag-session-note strong {
  display: block;
  margin-bottom: 4px;
  font-size: 0.82rem;
}

.ag-session-note small {
  display: block;
  margin-top: 6px;
}

@media (max-width: 900px) {
  .ag-execution-grid {
    grid-template-columns: 1fr;
  }
}
</style>
