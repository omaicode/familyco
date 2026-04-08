<script setup lang="ts">
import type { AuditListItem } from '@familyco/ui';
import { History } from 'lucide-vue-next';

import { useI18n } from '../../composables/useI18n';

const props = defineProps<{
  history: AuditListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  formatRelative: (iso: string) => string;
  formatTimestamp: (iso: string) => string;
}>();

const { t } = useI18n();

const ACTION_LABELS: Record<string, string> = {
  'agent.create': 'Agent created',
  'agent.update': 'Agent profile updated',
  'agent.pause': 'Agent paused',
  'agent.parent.update': 'Reporting line updated',
  'task.create': 'Task created',
  'task.update': 'Task updated',
  'task.status.update': 'Task status changed',
  'task.priority.update': 'Task priority changed',
  'task.comment.added': 'Task comment added',
  'approval.request.create': 'Approval request created'
};

const formatAction = (action: string): string => t(ACTION_LABELS[action] ?? action.replaceAll('.', ' → '));

const summarizePayload = (payload?: Record<string, unknown>): string | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload.title === 'string' && payload.title.length > 0) {
    return payload.title;
  }

  if (typeof payload.status === 'string') {
    return `${t('Status')}: ${payload.status}`;
  }

  if (typeof payload.priority === 'string') {
    return `${t('Priority')}: ${payload.priority}`;
  }

  if (typeof payload.parentAgentId === 'string' && payload.parentAgentId.length > 0) {
    return `${t('Reports to')}: ${payload.parentAgentId}`;
  }

  if (payload.parentAgentId === null) {
    return t('Moved to root reporting line');
  }

  if (typeof payload.projectId === 'string') {
    return `${t('Project')}: ${payload.projectId}`;
  }

  const preview = JSON.stringify(payload);
  return preview === '{}' ? null : preview;
};
</script>

<template>
  <section class="ag-subsection">
    <div class="ag-subsection-head">
      <div>
        <h5>{{ t('Recent activity') }}</h5>
        <p>{{ t('Scan the latest audit trail for this agent without leaving the roster view.') }}</p>
      </div>
      <History :size="16" class="ag-muted-icon" />
    </div>

    <div v-if="isLoading" class="ag-empty-state">
      <p>{{ t('Loading activity history…') }}</p>
    </div>

    <div v-else-if="errorMessage" class="fc-warning">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-else-if="history.length === 0" class="fc-empty ag-empty-state">
      <h4>{{ t('No recent activity yet') }}</h4>
      <p>{{ t('This agent has not produced any recent audit events to review.') }}</p>
    </div>

    <ol v-else class="ag-timeline">
      <li v-for="item in history" :key="item.id" class="ag-timeline-item">
        <div class="ag-timeline-dot" />
        <div class="ag-timeline-card">
          <div class="ag-timeline-head">
            <strong>{{ formatAction(item.action) }}</strong>
            <span :title="formatTimestamp(item.createdAt)">{{ formatRelative(item.createdAt) }}</span>
          </div>
          <p v-if="item.targetId" class="fc-list-meta">{{ t('Target ID') }}: {{ item.targetId }}</p>
          <p v-if="summarizePayload(item.payload)" class="ag-timeline-summary">{{ summarizePayload(item.payload) }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.ag-subsection {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface-muted);
}

.ag-subsection-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ag-subsection-head h5 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.ag-subsection-head p {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.ag-muted-icon {
  color: var(--fc-text-faint);
  flex-shrink: 0;
}

.ag-empty-state {
  padding: 16px;
}

.ag-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-timeline-item {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.ag-timeline-dot {
  width: 10px;
  height: 10px;
  margin-top: 8px;
  border-radius: 999px;
  background: var(--fc-primary);
}

.ag-timeline-card {
  padding: 10px 12px;
  border-radius: var(--fc-control-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
}

.ag-timeline-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.ag-timeline-head strong {
  font-size: 0.84rem;
}

.ag-timeline-head span {
  font-size: 0.74rem;
  color: var(--fc-text-muted);
  flex-shrink: 0;
}

.ag-timeline-summary {
  margin: 8px 0 0;
  font-size: 0.79rem;
  line-height: 1.5;
  color: var(--fc-text-main);
  word-break: break-word;
}

@media (max-width: 720px) {
  .ag-timeline-head {
    flex-direction: column;
  }
}
</style>
