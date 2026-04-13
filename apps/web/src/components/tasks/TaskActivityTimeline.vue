<script setup lang="ts">
import type { TaskActivityItem } from '@familyco/ui';
import {
  CheckCircle2,
  CircleDot,
  MessageSquareMore,
  ShieldCheck,
  UserRound,
  Workflow,
  XCircle
} from 'lucide-vue-next';

import MarkdownPreview from '../MarkdownPreview.vue';
import { useI18n } from '../../composables/useI18n';

const props = defineProps<{
  activity: TaskActivityItem[];
  loading: boolean;
  formatDateTime: (iso: string) => string;
}>();

const { t } = useI18n();

function kindIcon(kind: TaskActivityItem['kind']) {
  switch (kind) {
    case 'comment': return MessageSquareMore;
    case 'session.checkpoint': return Workflow;
    case 'approval.created': return ShieldCheck;
    case 'approval.decided': return CheckCircle2;
    case 'status.changed': return CircleDot;
    case 'assigned': return UserRound;
    default: return CircleDot;
  }
}

function kindLabel(item: TaskActivityItem): string {
  switch (item.kind) {
    case 'comment': return t('Comment');
    case 'session.checkpoint':
      return item.sessionStatus === 'waiting_for_approval'
        ? t('Waiting for approval')
        : item.sessionStatus === 'waiting_for_input'
          ? t('Waiting for input')
          : item.sessionStatus === 'blocked'
            ? t('Blocked')
            : t('Checkpoint');
    case 'approval.created': return t('Approval requested');
    case 'approval.decided':
      return item.approvalDecision === 'approved' ? t('Approved') : t('Rejected');
    case 'status.changed': return t('Status changed');
    case 'assigned': return t('Assigned');
    default: return item.kind;
  }
}

function kindClass(item: TaskActivityItem): string {
  if (item.kind === 'approval.decided') {
    return item.approvalDecision === 'approved'
      ? 'activity-kind activity-kind--approved'
      : 'activity-kind activity-kind--rejected';
  }
  if (item.kind === 'session.checkpoint') {
    if (item.sessionStatus === 'waiting_for_approval' || item.sessionStatus === 'blocked') {
      return 'activity-kind activity-kind--blocked';
    }
    if (item.sessionStatus === 'waiting_for_input') {
      return 'activity-kind activity-kind--waiting';
    }
  }
  return 'activity-kind';
}
</script>

<template>
  <div class="task-activity-timeline">
    <div v-if="loading" class="task-comments-empty">
      {{ t('Loading activity history…') }}
    </div>

    <div v-else-if="activity.length === 0" class="task-comments-empty">
      {{ t('No activity yet. Activity will appear here as the agent works on this task.') }}
    </div>

    <ol v-else class="activity-list">
      <li v-for="item in activity" :key="item.id" class="activity-item">
        <div class="activity-icon-col">
          <component :is="item.approvalDecision === 'rejected' ? XCircle : kindIcon(item.kind)" :size="14" />
        </div>
        <div class="activity-body-col">
          <div class="activity-header">
            <span :class="kindClass(item)">{{ kindLabel(item) }}</span>
            <span class="activity-actor">{{ item.actorLabel }}</span>
            <span class="activity-time">{{ formatDateTime(item.createdAt) }}</span>
          </div>
          <div v-if="item.kind === 'comment' && item.body" class="activity-comment-body">
            <MarkdownPreview :source="item.body" :empty-text="t('No comment body provided.')" />
          </div>
          <div v-else-if="item.summary" class="activity-summary">
            <MarkdownPreview :source="item.summary" />
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.task-activity-timeline {
  width: 100%;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.activity-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fc-border-subtle, rgba(255,255,255,0.06));
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon-col {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
  color: var(--fc-text-muted, #8b8b8b);
}

.activity-body-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.activity-kind {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--fc-surface-2, rgba(255,255,255,0.06));
  color: var(--fc-text-secondary, #ccc);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.activity-kind--approved {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}

.activity-kind--rejected,
.activity-kind--blocked {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

.activity-kind--waiting {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
}

.activity-actor {
  font-size: 12px;
  font-weight: 500;
  color: var(--fc-text-primary, #e8e8e8);
}

.activity-time {
  font-size: 11px;
  color: var(--fc-text-muted, #8b8b8b);
  margin-left: auto;
}

.activity-summary {
  font-size: 12px;
  color: var(--fc-text-secondary, #aaa);
}

.activity-comment-body {
  font-size: 13px;
}
</style>
