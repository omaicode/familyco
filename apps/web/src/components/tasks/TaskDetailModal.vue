<script setup lang="ts">
import type {
  AgentListItem,
  CreateTaskCommentPayload,
  ProjectListItem,
  TaskActivityItem,
  TaskCommentItem,
  TaskListItem,
  TaskWorkspaceArtifact,
  UpdateTaskPayload
} from '@familyco/ui';
import { computed, reactive, ref, watch } from 'vue';
import {
  Activity,
  Clock3,
  Eye,
  MessageSquareMore,
  PencilLine,
  SendHorizontal,
  Trash2,
  UserRound,
  Workflow,
  X
} from 'lucide-vue-next';

import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';
import FcInput from '../FcInput.vue';
import FcModalShell from '../FcModalShell.vue';
import FcSelect from '../FcSelect.vue';
import MarkdownEditor from '../MarkdownEditor.vue';
import MarkdownPreview from '../MarkdownPreview.vue';
import TaskActivityTimeline from './TaskActivityTimeline.vue';
import { useI18n } from '../../composables/useI18n';

type ModalMode = 'view' | 'edit' | 'delete';
type ViewTab = 'details' | 'activity';

interface CommentAuthorOption {
  id: string;
  label: string;
  type: 'agent' | 'human';
}

const props = defineProps<{
  open: boolean;
  mode: ModalMode;
  task: TaskListItem | null;
  comments: TaskCommentItem[];
  activity: TaskActivityItem[];
  projectOptions: ProjectListItem[];
  assigneeOptions: AgentListItem[];
  creatorOptions: AgentListItem[];
  commentAuthorOptions: CommentAuthorOption[];
  defaultAssigneeId: string;
  busy: boolean;
  commentsLoading: boolean;
  commentSubmitting: boolean;
  activityLoading: boolean;
  formatRelative: (iso: string) => string;
  getProjectName: (projectId: string) => string;
  getAgentName: (agentId: string | null | undefined) => string;
  formatPriority: (priority: TaskListItem['priority']) => string;
  formatStatus: (status: TaskListItem['status']) => string;
}>();

const emit = defineEmits<{
  close: [];
  changeMode: [mode: ModalMode];
  save: [payload: UpdateTaskPayload];
  remove: [taskId: string];
  comment: [payload: CreateTaskCommentPayload];
}>();

const { t } = useI18n();

const activeViewTab = ref<ViewTab>('details');

const draft = reactive({
  title: '',
  description: '',
  projectId: '',
  assigneeAgentId: '',
  createdBy: '',
  priority: 'medium' as TaskListItem['priority']
});

const commentDraft = ref('');
const commentAuthorId = ref('founder');
const selectedCommentArtifact = ref<TaskWorkspaceArtifact | null>(null);

interface TaskCommentArtifactEntry {
  id: string;
  path: string;
  action: TaskWorkspaceArtifact['action'];
  actorLabel: string;
  createdAt: string;
  artifact: TaskWorkspaceArtifact;
}

type CommentArtifactGroups = Record<string, TaskCommentArtifactEntry[]>;

watch(
  () => [props.open, props.task?.id],
  () => {
    if (!props.task) {
      return;
    }

    draft.title = props.task.title;
    draft.description = props.task.description;
    draft.projectId = props.task.projectId;
    draft.assigneeAgentId = props.task.assigneeAgentId ?? props.defaultAssigneeId;
    draft.createdBy = props.task.createdBy;
    draft.priority = props.task.priority;

    if (!props.commentAuthorOptions.some((option) => option.id === commentAuthorId.value)) {
      commentAuthorId.value = props.commentAuthorOptions[0]?.id ?? 'founder';
    }

    if (!props.open) {
      commentDraft.value = '';
      activeViewTab.value = 'details';
    }
  },
  { immediate: true }
);

watch(
  () => props.commentAuthorOptions,
  (options) => {
    if (!options.some((option) => option.id === commentAuthorId.value)) {
      commentAuthorId.value = options[0]?.id ?? 'founder';
    }
  },
  { immediate: true }
);

const selectedCommentAuthor = computed(
  () => props.commentAuthorOptions.find((option) => option.id === commentAuthorId.value) ?? null
);

const canSubmitEdit = computed(
  () => Boolean(draft.title.trim() && draft.description.trim() && draft.projectId && draft.assigneeAgentId && draft.createdBy)
);
const canSubmitComment = computed(
  () => Boolean(commentDraft.value.trim() && selectedCommentAuthor.value)
);

const sortedComments = computed<TaskCommentItem[]>(() =>
  [...props.comments].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
);

const checkpointArtifacts = computed<TaskCommentArtifactEntry[]>(() =>
  props.activity
    .filter((item) => item.kind === 'session.checkpoint' && Array.isArray(item.workspaceArtifacts) && item.workspaceArtifacts.length > 0)
    .flatMap((item) =>
      (item.workspaceArtifacts ?? []).map((artifact, artifactIndex) => ({
        id: `${item.id}-${artifactIndex}-${artifact.path}`,
        path: artifact.path,
        action: artifact.action,
        actorLabel: item.actorLabel,
        createdAt: item.createdAt,
        artifact
      }))
    )
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
);

const commentArtifactsById = computed<CommentArtifactGroups>(() => {
  const comments = sortedComments.value;
  const map: CommentArtifactGroups = Object.fromEntries(
    comments.map((comment) => [comment.id, [] as TaskCommentArtifactEntry[]])
  );

  if (comments.length === 0) {
    return map;
  }

  for (const artifactEntry of checkpointArtifacts.value) {
    const artifactTime = new Date(artifactEntry.createdAt).getTime();
    let nearestComment = comments[0];
    let nearestDistance = Math.abs(new Date(nearestComment.createdAt).getTime() - artifactTime);

    for (let index = 1; index < comments.length; index += 1) {
      const candidate = comments[index];
      const candidateDistance = Math.abs(new Date(candidate.createdAt).getTime() - artifactTime);
      const candidateTime = new Date(candidate.createdAt).getTime();
      const nearestTime = new Date(nearestComment.createdAt).getTime();
      const preferCandidateOnTie = candidateDistance === nearestDistance
        && candidateTime <= artifactTime
        && nearestTime > artifactTime;

      if (candidateDistance < nearestDistance || preferCandidateOnTie) {
        nearestComment = candidate;
        nearestDistance = candidateDistance;
      }
    }

    map[nearestComment.id].push(artifactEntry);
  }

  return map;
});

const standaloneArtifacts = computed<TaskCommentArtifactEntry[]>(() => {
  if (sortedComments.value.length > 0) {
    return [];
  }

  return checkpointArtifacts.value;
});

const artifactsForComment = (commentId: string): TaskCommentArtifactEntry[] =>
  commentArtifactsById.value[commentId] ?? [];

const submitEdit = (): void => {
  if (!props.task || !canSubmitEdit.value) {
    return;
  }

  emit('save', {
    taskId: props.task.id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    projectId: draft.projectId,
    assigneeAgentId: draft.assigneeAgentId,
    createdBy: draft.createdBy,
    priority: draft.priority
  });
};

const submitComment = (): void => {
  if (!props.task || !canSubmitComment.value || !selectedCommentAuthor.value) {
    return;
  }

  emit('comment', {
    taskId: props.task.id,
    body: commentDraft.value.trim(),
    authorId: selectedCommentAuthor.value.id,
    authorType: selectedCommentAuthor.value.type,
    authorLabel: selectedCommentAuthor.value.label
  });

  commentDraft.value = '';
};

const confirmDelete = (): void => {
  if (!props.task) {
    return;
  }

  emit('remove', props.task.id);
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return t('recently');
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatUpdatedLabel = (iso: string): string =>
  t('updated {{time}}', { time: props.formatRelative(iso) });

const formatCommentCountLabel = (count: number): string =>
  count === 1 ? t('1 comment logged') : t('{{count}} comments logged', { count });

const taskCode = computed(() => (props.task ? `TASK-${props.task.id.slice(0, 8).toUpperCase()}` : ''));

const openCommentArtifactModal = (artifact: TaskWorkspaceArtifact): void => {
  selectedCommentArtifact.value = artifact;
};

const closeCommentArtifactModal = (): void => {
  selectedCommentArtifact.value = null;
};
</script>

<template>
  <FcModalShell
    :open="open && task !== null"
    :ariaLabel="t('Task details')"
    panel-class="task-modal"
    :z-index="70"
    @close="emit('close')"
  >
      <div v-if="task">
        <div class="task-modal-header">
          <div>
            <h4>
              {{ mode === 'view' ? t('Task details') : mode === 'edit' ? t('Edit task') : t('Delete task') }}
            </h4>
            <p>
              <template v-if="mode === 'view'">
                {{ t('Review the brief, owner, and latest discussion without leaving the task board.') }}
              </template>
              <template v-else-if="mode === 'edit'">
                {{ t('Update the brief, assignment, and priority in one focused modal.') }}
              </template>
              <template v-else>
                {{ t('Delete this task when the work is no longer needed.') }}
              </template>
            </p>
          </div>

          <div class="task-modal-actions">
            <FcButton :variant="mode === 'view' ? 'secondary' : 'ghost'" size="sm" @click="emit('changeMode', 'view')">
              <Eye :size="13" /> {{ t('View') }}
            </FcButton>
            <FcButton :variant="mode === 'edit' ? 'secondary' : 'ghost'" size="sm" @click="emit('changeMode', 'edit')">
              <PencilLine :size="13" /> {{ t('Edit') }}
            </FcButton>
            <FcButton :variant="mode === 'delete' ? 'danger' : 'ghost'" size="sm" @click="emit('changeMode', 'delete')">
              <Trash2 :size="13" /> {{ t('Delete') }}
            </FcButton>
            <button class="fc-btn-ghost fc-btn-icon" @click="emit('close')">
              <X :size="14" />
            </button>
          </div>
        </div>

        <template v-if="mode === 'view'">
          <div class="task-modal-topline">
            <div>
              <span class="task-modal-code">{{ taskCode }}</span>
              <strong class="task-modal-name">{{ task.title }}</strong>
              <p class="task-modal-meta">
                {{ getProjectName(task.projectId) }} · {{ getAgentName(task.assigneeAgentId) }} ·
                {{ formatUpdatedLabel(task.updatedAt) }}
              </p>
            </div>

            <div class="task-modal-tags">
              <FcBadge :status="task.status">{{ formatStatus(task.status) }}</FcBadge>
              <span class="task-priority-pill" :data-priority="task.priority">
                {{ formatPriority(task.priority) }}
              </span>
            </div>
          </div>

          <div class="task-meta-grid">
            <div class="task-mini-card">
              <span><Workflow :size="13" /> {{ t('Project') }}</span>
              <strong>{{ getProjectName(task.projectId) }}</strong>
              <p>{{ t('Task code') }} · {{ taskCode }}</p>
            </div>

            <div class="task-mini-card">
              <span><UserRound :size="13" /> {{ t('Assignee') }}</span>
              <strong>{{ getAgentName(task.assigneeAgentId) }}</strong>
              <p>{{ t('Created by') }} · {{ getAgentName(task.createdBy) }}</p>
            </div>

            <div class="task-mini-card">
              <span><Clock3 :size="13" /> {{ t('Created') }}</span>
              <strong>{{ formatRelative(task.createdAt) }}</strong>
              <p>{{ formatDateTime(task.createdAt) }}</p>
            </div>

            <div class="task-mini-card">
              <span><MessageSquareMore :size="13" /> {{ t('Task comments') }}</span>
              <strong>{{ comments.length }}</strong>
              <p>{{ formatCommentCountLabel(comments.length) }}</p>
            </div>
          </div>

          <div class="task-modal-section">
            <div class="task-modal-section-header">
              <h5>{{ t('Execution brief') }}</h5>
            </div>
            <div class="task-brief-box">
              <MarkdownPreview
                :source="task.description"
                :empty-text="t('Add a Markdown brief so the assignee has execution context.')"
              />
            </div>
          </div>

          <div class="task-view-tabs">
            <button
              :class="['task-view-tab', activeViewTab === 'details' ? 'task-view-tab--active' : '']"
              @click="activeViewTab = 'details'"
            >
              <MessageSquareMore :size="13" />
              {{ t('Comment thread') }}
              <span class="task-view-tab-count">{{ comments.length }}</span>
            </button>
            <button
              :class="['task-view-tab', activeViewTab === 'activity' ? 'task-view-tab--active' : '']"
              @click="activeViewTab = 'activity'"
            >
              <Activity :size="13" />
              {{ t('Agent activity') }}
              <span class="task-view-tab-count">{{ activity.length }}</span>
            </button>
          </div>

          <div v-if="activeViewTab === 'details'" class="task-modal-section">
            <div class="task-comment-composer">
              <div class="fc-form-grid">
                <div class="fc-form-group">
                  <label class="fc-label">{{ t('Post as') }}</label>
                  <FcSelect v-model="commentAuthorId">
                    <option v-for="author in commentAuthorOptions" :key="author.id" :value="author.id">
                      {{ author.label }}
                    </option>
                  </FcSelect>
                </div>
              </div>

              <div class="fc-form-group" style="margin-top: 10px;">
                <label class="fc-label">{{ t('Comment body') }}</label>
                <textarea
                  v-model="commentDraft"
                  class="task-comment-textarea"
                  :placeholder="t('Add the next update, blocker, or decision for this task…')"
                  rows="4"
                />
              </div>

              <div class="fc-toolbar" style="margin-top: 10px;">
                <FcButton variant="primary" :disabled="commentSubmitting || !canSubmitComment" @click="submitComment">
                  <SendHorizontal :size="14" />
                  {{ commentSubmitting ? t('Posting…') : t('Post comment') }}
                </FcButton>
              </div>
            </div>

            <div v-if="commentsLoading" class="task-comments-empty">
              {{ t('Loading task comments…') }}
            </div>

            <ul v-else-if="sortedComments.length > 0" class="task-comment-list">
              <li v-for="comment in sortedComments" :key="comment.id" class="task-comment-item">
                <div class="task-comment-header">
                  <div>
                    <strong>{{ comment.authorLabel }}</strong>
                    <span class="task-comment-kind" :data-author-type="comment.authorType">
                      {{ comment.authorType === 'human' ? t('Human') : t('Agent') }}
                    </span>
                  </div>
                  <span>{{ formatDateTime(comment.createdAt) }}</span>
                </div>

                <MarkdownPreview :source="comment.body" :empty-text="t('No comment body provided.')" />

                <div v-if="artifactsForComment(comment.id).length > 0" class="task-comment-artifact-group">
                  <div class="task-comment-artifact-group-header">
                    <h6>{{ t('Files created') }}</h6>
                    <span>{{ artifactsForComment(comment.id).length }}</span>
                  </div>

                  <ul class="task-comment-artifact-list">
                    <li v-for="entry in artifactsForComment(comment.id)" :key="entry.id" class="task-comment-artifact-item">
                      <button
                        type="button"
                        class="fc-btn-ghost task-comment-artifact-btn"
                        @click="openCommentArtifactModal(entry.artifact)"
                      >
                        <span class="task-comment-artifact-path">{{ entry.path }}</span>
                        <span class="task-comment-artifact-meta">
                          {{ entry.action === 'created' ? t('Created') : t('Updated') }}
                        </span>
                        <span class="task-comment-artifact-meta">
                          {{ entry.actorLabel }} · {{ formatDateTime(entry.createdAt) }}
                        </span>
                      </button>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>

            <div v-else class="task-comments-empty">
              {{ t('No comments yet. Start the thread with context, blockers, or a quick status note.') }}
            </div>

            <div v-if="sortedComments.length === 0" class="task-comment-artifacts">
              <div class="task-modal-section-header">
                <h5>{{ t('Files created') }}</h5>
              </div>

              <div v-if="activityLoading" class="task-comments-empty">
                {{ t('Loading activity history…') }}
              </div>

              <div v-else-if="standaloneArtifacts.length === 0" class="task-comments-empty">
                {{ t('No files recorded') }}
              </div>

              <ul v-else class="task-comment-artifact-list">
                <li v-for="entry in standaloneArtifacts" :key="entry.id" class="task-comment-artifact-item">
                  <button
                    type="button"
                    class="fc-btn-ghost task-comment-artifact-btn"
                    @click="openCommentArtifactModal(entry.artifact)"
                  >
                    <span class="task-comment-artifact-path">{{ entry.path }}</span>
                    <span class="task-comment-artifact-meta">
                      {{ entry.action === 'created' ? t('Created') : t('Updated') }}
                    </span>
                    <span class="task-comment-artifact-meta">
                      {{ entry.actorLabel }} · {{ formatDateTime(entry.createdAt) }}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div v-else-if="activeViewTab === 'activity'" class="task-modal-section">
            <TaskActivityTimeline
              :activity="activity"
              :loading="activityLoading"
              :format-date-time="formatDateTime"
            />
          </div>
        </template>

        <template v-else-if="mode === 'edit'">
          <div class="fc-form-grid" style="margin-bottom: 12px;">
            <div class="fc-form-group">
              <label class="fc-label">{{ t('Task title') }}</label>
              <FcInput v-model="draft.title" :placeholder="t('Task title')" />
            </div>

            <div class="fc-form-group">
              <label class="fc-label">{{ t('Project') }}</label>
              <FcSelect v-model="draft.projectId">
                <option v-for="project in projectOptions" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </FcSelect>
            </div>

            <div class="fc-form-group">
              <label class="fc-label">{{ t('Assignee') }}</label>
              <FcSelect v-model="draft.assigneeAgentId">
                <option v-for="agent in assigneeOptions" :key="agent.id" :value="agent.id">
                  {{ agent.name }} · {{ agent.role }}
                </option>
              </FcSelect>
            </div>

            <div class="fc-form-group">
              <label class="fc-label">{{ t('Created by') }}</label>
              <FcSelect v-model="draft.createdBy">
                <option v-for="agent in creatorOptions" :key="agent.id" :value="agent.id">
                  {{ agent.name }} · {{ agent.level }}
                </option>
              </FcSelect>
            </div>

            <div class="fc-form-group">
              <label class="fc-label">{{ t('Priority') }}</label>
              <FcSelect v-model="draft.priority">
                <option value="low">{{ t('Low') }}</option>
                <option value="medium">{{ t('Medium') }}</option>
                <option value="high">{{ t('High') }}</option>
                <option value="urgent">{{ t('Urgent') }}</option>
              </FcSelect>
            </div>
          </div>

          <div class="fc-form-group" style="margin-bottom: 12px;">
            <label class="fc-label">{{ t('Execution brief') }}</label>
            <MarkdownEditor
              v-model="draft.description"
              :placeholder="t('Describe the outcome, constraints, and what “done” should look like using Markdown.')"
              :preview-empty-text="t('The task brief preview will appear here.')"
            />
          </div>

          <div class="fc-toolbar">
            <FcButton variant="primary" :disabled="busy || !canSubmitEdit" @click="submitEdit">
              <PencilLine :size="14" />
              {{ busy ? t('Saving…') : t('Save changes') }}
            </FcButton>
            <FcButton variant="ghost" :disabled="busy" @click="emit('changeMode', 'view')">
              {{ t('Cancel') }}
            </FcButton>
          </div>
        </template>

        <template v-else>
          <div class="task-delete-panel">
            <p>
              {{ t('This removes the task from the active board. Use it only when the work item is no longer needed.') }}
            </p>

            <ul class="task-delete-checks">
              <li>
                <span>{{ t('Task title') }}</span>
                <strong>{{ task.title }}</strong>
              </li>
              <li>
                <span>{{ t('Project') }}</span>
                <strong>{{ getProjectName(task.projectId) }}</strong>
              </li>
              <li>
                <span>{{ t('Status') }}</span>
                <strong>{{ formatStatus(task.status) }}</strong>
              </li>
              <li>
                <span>{{ t('Comments') }}</span>
                <strong>{{ comments.length }}</strong>
              </li>
            </ul>

            <div class="fc-toolbar">
              <FcButton variant="danger" :disabled="busy" @click="confirmDelete">
                <Trash2 :size="14" />
                {{ busy ? t('Deleting…') : t('Delete task') }}
              </FcButton>
              <FcButton variant="ghost" :disabled="busy" @click="emit('changeMode', 'view')">
                {{ t('Cancel') }}
              </FcButton>
            </div>
          </div>
        </template>
      </div>

      <FcModalShell
        :open="selectedCommentArtifact !== null"
        :ariaLabel="t('File snapshot')"
        panel-class="activity-file-modal"
        overlay-class="activity-file-modal-overlay"
        :z-index="120"
        @close="closeCommentArtifactModal"
      >
        <div v-if="selectedCommentArtifact">
          <div class="activity-file-modal-header">
            <div>
              <div class="activity-file-modal-title">{{ t('File snapshot') }}</div>
              <div class="activity-file-modal-path">{{ selectedCommentArtifact.path }}</div>
            </div>
            <button type="button" class="fc-btn-ghost fc-btn-sm" @click="closeCommentArtifactModal">{{ t('Close') }}</button>
          </div>

          <div class="activity-file-modal-body">
            <MarkdownPreview
              v-if="selectedCommentArtifact.contentPreview && selectedCommentArtifact.contentPreview.length > 0"
              :source="selectedCommentArtifact.contentPreview"
              :empty-text="t('No file content captured.')"
            />
            <div v-else class="activity-file-empty">{{ t('No file content captured.') }}</div>
            <div v-if="selectedCommentArtifact.contentTruncated" class="activity-file-truncated-note">
              {{ t('Snapshot is truncated. Open the file in workspace for full content.') }}
            </div>
          </div>
        </div>
      </FcModalShell>
  </FcModalShell>
</template>

<style scoped>
.task-modal {
  width: min(960px, 100%);
}

.task-modal-header,
.task-modal-topline,
.task-modal-section-header,
.task-comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.task-modal-header {
  margin-bottom: 14px;
}

.task-modal-header h4,
.task-modal-section-header h5 {
  margin: 0;
}

.task-modal-header p {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.task-modal-actions,
.task-modal-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.task-modal-code {
  display: inline-block;
  margin-bottom: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fc-text-muted);
}

.task-modal-name {
  display: block;
  font-size: 1rem;
  color: var(--fc-text-main);
}

.task-modal-meta {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.task-meta-grid,
.task-delete-checks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.task-mini-card,
.task-delete-checks li,
.task-comment-item {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}

.task-mini-card span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fc-text-faint);
}

.task-mini-card strong {
  display: block;
  margin-top: 6px;
  font-size: 0.9rem;
}

.task-mini-card p {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.task-modal-section + .task-modal-section {
  margin-top: 14px;
}

.task-comment-artifacts {
  margin-top: 14px;
}

.task-comment-artifact-group {
  margin-top: 10px;
}

.task-comment-artifact-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.task-comment-artifact-group-header h6 {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fc-text-faint);
}

.task-comment-artifact-group-header span {
  font-size: 0.72rem;
  color: var(--fc-text-muted);
}

.task-brief-box,
.task-comment-composer,
.task-comments-empty {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--fc-surface-muted) 35%, var(--fc-surface));
  margin-top: 12px;
}

.task-comment-textarea {
  width: 100%;
  border-radius: var(--fc-control-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
  color: var(--fc-text-main);
  padding: 10px 12px;
  font: inherit;
  resize: vertical;
}

.task-comment-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-comment-artifact-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-comment-artifact-item {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}

.task-comment-artifact-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
}

.task-comment-artifact-path {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--fc-text-main);
  text-align: left;
  word-break: break-all;
}

.task-comment-artifact-meta {
  font-size: 0.72rem;
  color: var(--fc-text-muted);
  text-align: left;
}

.task-comment-header {
  margin-bottom: 8px;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.task-comment-header strong {
  color: var(--fc-text-main);
}

.task-comment-kind {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.68rem;
  font-weight: 700;
}

.task-comment-kind[data-author-type='human'] {
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
  color: var(--fc-info);
}

.task-comment-kind[data-author-type='agent'] {
  background: color-mix(in srgb, var(--fc-primary) 12%, var(--fc-surface));
  color: var(--fc-primary);
}

.task-delete-panel p {
  margin: 0 0 12px;
}

.task-delete-checks {
  list-style: none;
  padding: 0;
}

.task-delete-checks li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-delete-checks span {
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.task-priority-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--fc-border-subtle);
}

.task-priority-pill[data-priority='low'] {
  color: var(--fc-text-muted);
  background: var(--fc-surface-muted);
}

.task-priority-pill[data-priority='medium'] {
  color: var(--fc-info);
  background: color-mix(in srgb, var(--fc-info) 10%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-info) 30%, var(--fc-border-subtle));
}

.task-priority-pill[data-priority='high'] {
  color: var(--fc-warning);
  background: color-mix(in srgb, var(--fc-warning) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-warning) 30%, var(--fc-border-subtle));
}

.task-priority-pill[data-priority='urgent'] {
  color: var(--fc-error);
  background: color-mix(in srgb, var(--fc-error) 10%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-error) 30%, var(--fc-border-subtle));
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
  align-items: center;
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

@media (max-width: 720px) {
  .task-modal-header,
  .task-modal-topline,
  .task-comment-header {
    flex-direction: column;
  }

  .task-meta-grid,
  .task-delete-checks {
    grid-template-columns: 1fr;
  }
}

.task-view-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--fc-border-subtle);
  padding: 0 20px;
  margin: 0 -20px;
}

.task-view-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fc-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.task-view-tab:hover {
  color: var(--fc-text-primary);
}

.task-view-tab--active {
  color: var(--fc-text-primary);
  border-bottom-color: var(--fc-accent);
}

.task-view-tab-count {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 10px;
  background: var(--fc-surface-2, rgba(255,255,255,0.06));
  color: var(--fc-text-muted);
  min-width: 18px;
  text-align: center;
}
</style>
