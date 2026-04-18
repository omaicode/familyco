<script setup lang="ts">
import type { TaskActivityItem, TaskWorkspaceArtifact } from '@familyco/ui';
import { computed, ref, watch } from 'vue';
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
import FcModalShell from '../FcModalShell.vue';
import { useI18n } from '../../composables/useI18n';

const props = defineProps<{
  activity: TaskActivityItem[];
  loading: boolean;
  formatDateTime: (iso: string) => string;
}>();

const { t } = useI18n();
const expandedIds = ref<Record<string, boolean>>({});
const selectedArtifact = ref<TaskWorkspaceArtifact | null>(null);

watch(
  () => props.activity,
  (next) => {
    const nextMap: Record<string, boolean> = {};
    for (const item of next) {
      nextMap[item.id] = expandedIds.value[item.id] ?? false;
    }
    expandedIds.value = nextMap;
  },
  { immediate: true }
);

const allExpanded = computed(() =>
  props.activity.length > 0 && props.activity.every((item) => expandedIds.value[item.id] === true)
);

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

function toggleItem(itemId: string): void {
  expandedIds.value = {
    ...expandedIds.value,
    [itemId]: !(expandedIds.value[itemId] === true)
  };
}

function setAllExpanded(expanded: boolean): void {
  const nextMap: Record<string, boolean> = {};
  for (const item of props.activity) {
    nextMap[item.id] = expanded;
  }
  expandedIds.value = nextMap;
}

function sanitizePreviewText(raw: string): string {
  return raw
    .replace(/\*\*|__|`|~~|#+\s|\*\s|>\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function previewText(item: TaskActivityItem): string {
  if (item.kind === 'comment' && item.body) {
    return sanitizePreviewText(item.body);
  }

  return sanitizePreviewText(item.summary ?? '');
}

function isExpanded(itemId: string): boolean {
  return expandedIds.value[itemId] === true;
}

function openArtifactModal(artifact: TaskWorkspaceArtifact): void {
  selectedArtifact.value = artifact;
}

function closeArtifactModal(): void {
  selectedArtifact.value = null;
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

    <div v-else class="activity-toolbar">
      <button class="fc-btn-ghost fc-btn-sm" @click="setAllExpanded(!allExpanded)">
        {{ allExpanded ? t('Collapse all') : t('Expand all') }}
      </button>
    </div>

    <ol v-if="activity.length > 0" class="activity-list">
      <li v-for="item in activity" :key="item.id" class="activity-item">
        <div class="activity-icon-col">
          <component :is="item.approvalDecision === 'rejected' ? XCircle : kindIcon(item.kind)" :size="14" />
        </div>
        <div class="activity-body-col">
          <div class="activity-header">
            <span :class="kindClass(item)">{{ kindLabel(item) }}</span>
            <span class="activity-actor">{{ item.actorLabel }}</span>
            <span class="activity-time">{{ formatDateTime(item.createdAt) }}</span>
            <button class="fc-btn-ghost fc-btn-sm activity-toggle" @click="toggleItem(item.id)">
              {{ isExpanded(item.id) ? t('Collapse') : t('Expand') }}
            </button>
          </div>
          <div v-if="!isExpanded(item.id)" class="activity-preview">
            {{ previewText(item) }}
          </div>

          <template v-else>
            <div v-if="item.kind === 'comment' && item.body" class="activity-comment-body">
              <MarkdownPreview :source="item.body" :empty-text="t('No comment body provided.')" />
            </div>
            <div v-else-if="item.summary" class="activity-summary">
              <MarkdownPreview :source="item.summary" />
            </div>

            <div v-if="item.kind === 'session.checkpoint'" class="activity-detail-list">
              <div class="activity-detail-row">
                <span class="activity-detail-label">{{ t('Checkpoint') }}:</span>
                <span class="activity-detail-value">#{{ item.checkpointIndex ?? 0 }}</span>
              </div>
              <div class="activity-detail-row">
                <span class="activity-detail-label">{{ t('Tools used') }}:</span>
                <span class="activity-detail-value" v-if="item.toolsUsed && item.toolsUsed.length > 0">
                  {{ item.toolsUsed.join(', ') }}
                </span>
                <span class="activity-detail-value" v-else>{{ t('No tools recorded') }}</span>
              </div>
              <div class="activity-detail-row activity-detail-row--artifact-list">
                <span class="activity-detail-label">{{ t('Files created') }}:</span>
                <span class="activity-detail-value" v-if="item.workspaceArtifacts && item.workspaceArtifacts.length > 0">
                  <button
                    v-for="artifact in item.workspaceArtifacts"
                    :key="`${item.id}-${artifact.path}`"
                    type="button"
                    class="fc-btn-ghost fc-btn-sm activity-artifact-btn"
                    @click="openArtifactModal(artifact)"
                  >
                    <span>{{ artifact.path }}</span>
                    <span class="activity-artifact-action">{{ artifact.action === 'created' ? t('Created') : t('Updated') }}</span>
                  </button>
                </span>
                <span class="activity-detail-value" v-else>{{ t('No files recorded') }}</span>
              </div>
            </div>

            <div v-else-if="item.kind === 'approval.created'" class="activity-detail-list">
              <div v-if="item.approvalAction" class="activity-detail-row">
                <span class="activity-detail-label">{{ t('Requested action') }}:</span>
                <span class="activity-detail-value">{{ item.approvalAction }}</span>
              </div>
              <div v-if="item.approvalId" class="activity-detail-row">
                <span class="activity-detail-label">{{ t('Approval ID') }}:</span>
                <span class="activity-detail-value">{{ item.approvalId }}</span>
              </div>
            </div>

            <div v-else-if="item.kind === 'approval.decided'" class="activity-detail-list">
              <div v-if="item.approvalId" class="activity-detail-row">
                <span class="activity-detail-label">{{ t('Approval ID') }}:</span>
                <span class="activity-detail-value">{{ item.approvalId }}</span>
              </div>
              <div v-if="item.decisionNote" class="activity-detail-row">
                <span class="activity-detail-label">{{ t('Decision note') }}:</span>
                <span class="activity-detail-value">{{ item.decisionNote }}</span>
              </div>
            </div>
          </template>
        </div>
      </li>
    </ol>

    <FcModalShell
      :open="selectedArtifact !== null"
      :ariaLabel="t('File snapshot')"
      panel-class="activity-file-modal"
      overlay-class="activity-file-modal-overlay"
      :z-index="120"
      @close="closeArtifactModal"
    >
      <div v-if="selectedArtifact">
        <div class="activity-file-modal-header">
          <div>
            <div class="activity-file-modal-title">{{ t('File snapshot') }}</div>
            <div class="activity-file-modal-path">{{ selectedArtifact.path }}</div>
          </div>
          <button type="button" class="fc-btn-ghost fc-btn-sm" @click="closeArtifactModal">{{ t('Close') }}</button>
        </div>

        <div class="activity-file-modal-body">
          <MarkdownPreview
            v-if="selectedArtifact.contentPreview && selectedArtifact.contentPreview.length > 0"
            :source="selectedArtifact.contentPreview"
            :empty-text="t('No file content captured.')"
          />
          <div v-else class="activity-file-empty">{{ t('No file content captured.') }}</div>
          <div v-if="selectedArtifact.contentTruncated" class="activity-file-truncated-note">
            {{ t('Snapshot is truncated. Open the file in workspace for full content.') }}
          </div>
        </div>
      </div>
    </FcModalShell>
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

.activity-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.activity-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fc-border-subtle, rgba(255, 255, 255, 0.06));
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
  background: var(--fc-surface-2, rgba(255, 255, 255, 0.06));
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
}

.activity-toggle {
  margin-left: auto;
}

.activity-preview {
  font-size: 12px;
  color: var(--fc-text-secondary, #aaa);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.activity-summary {
  font-size: 12px;
  color: var(--fc-text-secondary, #aaa);
}

.activity-comment-body {
  font-size: 13px;
}

.activity-detail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-detail-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
}

.activity-detail-row--artifact-list {
  align-items: flex-start;
}

.activity-detail-label {
  color: var(--fc-text-muted, #8b8b8b);
  font-weight: 600;
}

.activity-detail-value {
  color: var(--fc-text-secondary, #aaa);
  word-break: break-word;
}

.activity-artifact-btn {
  margin: 0 6px 6px 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.activity-artifact-action {
  font-size: 11px;
  opacity: 0.85;
}

.activity-file-modal-overlay {
  background: rgba(0, 0, 0, 0.45);
  padding: 18px;
}

.activity-file-modal :deep(.fc-modal-panel) {
  width: min(960px, 100%);
  max-height: min(86vh, 860px);
  display: flex;
  flex-direction: column;
}

.activity-file-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.activity-file-modal-title {
  font-size: 0.8rem;
  color: var(--fc-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.activity-file-modal-path {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fc-text-main);
  word-break: break-all;
}

.activity-file-modal-body {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  background: var(--fc-surface-muted);
  padding: 10px;
  overflow: auto;
  max-height: min(68vh, 700px);
}

.activity-file-empty,
.activity-file-truncated-note {
  font-size: 12px;
  color: var(--fc-text-muted);
}

.activity-file-truncated-note {
  margin-top: 8px;
}

.task-comments-empty {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--fc-surface-muted) 35%, var(--fc-surface));
  margin-top: 12px;
}
</style>