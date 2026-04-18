<script setup lang="ts">
import type { AgentListItem, ProjectListItem, TaskListItem, UpdateProjectPayload } from '@familyco/ui';
import { computed, reactive, watch } from 'vue';
import { Clock3, Eye, FileText, PencilLine, Trash2, Users, Workflow, X } from 'lucide-vue-next';

import FcButton from '../FcButton.vue';
import FcInput from '../FcInput.vue';
import FcSelect from '../FcSelect.vue';
import MarkdownEditor from '../MarkdownEditor.vue';
import MarkdownPreview from '../MarkdownPreview.vue';

type RiskLevel = 'healthy' | 'watch' | 'critical';
type ModalMode = 'view' | 'edit' | 'delete';

interface ProjectPortfolioItem extends ProjectListItem {
  owner: AgentListItem | null;
  childCount: number;
  counts: {
    pending: number;
    inProgress: number;
    review: number;
    done: number;
    blocked: number;
    cancelled: number;
    total: number;
  };
  openTasks: number;
  risk: RiskLevel;
  healthText: string;
  preview: string;
}

const props = defineProps<{
  open: boolean;
  mode: ModalMode;
  project: ProjectPortfolioItem | null;
  tasks: TaskListItem[];
  ownerOptions: AgentListItem[];
  projectOptions: ProjectListItem[];
  busy: boolean;
  formatDate: (iso: string) => string;
  formatRelative: (iso: string) => string;
  getAgentLabel: (agentId: string | null | undefined) => string;
  riskLabel: (risk: RiskLevel) => string;
  riskTone: (risk: RiskLevel) => 'low' | 'medium' | 'high';
  deleteDisabledReason?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  changeMode: [mode: ModalMode];
  save: [payload: UpdateProjectPayload];
  remove: [projectId: string];
}>();

const draft = reactive({
  name: '',
  description: '',
  ownerAgentId: '',
  parentProjectId: ''
});

watch(
  () => [props.open, props.project?.id, props.mode],
  () => {
    if (!props.project) {
      return;
    }

    draft.name = props.project.name;
    draft.description = props.project.description;
    draft.ownerAgentId = props.project.ownerAgentId;
    draft.parentProjectId = props.project.parentProjectId ?? '';
  },
  { immediate: true }
);

const canDelete = computed(() => {
  if (!props.project) {
    return false;
  }

  return props.project.counts.total === 0 && props.project.childCount === 0 && !props.deleteDisabledReason;
});

const availableParentProjects = computed(() => {
  const currentProjectId = props.project?.id;
  if (!currentProjectId) {
    return props.projectOptions;
  }

  return props.projectOptions.filter((item) => item.id !== currentProjectId);
});

const submitEdit = (): void => {
  if (!props.project || !draft.name.trim() || !draft.description.trim() || !draft.ownerAgentId) {
    return;
  }

  emit('save', {
    projectId: props.project.id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    ownerAgentId: draft.ownerAgentId,
    parentProjectId: draft.parentProjectId || null
  });
};

const confirmDelete = (): void => {
  if (!props.project || !canDelete.value) {
    return;
  }

  emit('remove', props.project.id);
};
</script>

<template>
  <Transition name="fc-page">
    <div v-if="open && project" class="project-modal-wrap" @click.self="emit('close')">
      <div class="project-modal">
        <div class="project-modal-header">
          <div>
            <h4>{{ mode === 'view' ? 'Project details' : mode === 'edit' ? 'Edit project' : 'Delete project' }}</h4>
            <p>
              <template v-if="mode === 'view'">Review the brief, owner, and current delivery status in one place.</template>
              <template v-else-if="mode === 'edit'">Update the brief, owner, or project structure without leaving the table.</template>
              <template v-else>Delete only when the project has no active tasks and no sub-projects.</template>
            </p>
          </div>

          <div class="project-modal-actions">
            <FcButton :variant="mode === 'view' ? 'secondary' : 'ghost'" size="sm" @click="emit('changeMode', 'view')">
              <Eye :size="13" /> View
            </FcButton>
            <FcButton :variant="mode === 'edit' ? 'secondary' : 'ghost'" size="sm" @click="emit('changeMode', 'edit')">
              <PencilLine :size="13" /> Edit
            </FcButton>
            <FcButton :variant="mode === 'delete' ? 'danger' : 'ghost'" size="sm" @click="emit('changeMode', 'delete')">
              <Trash2 :size="13" /> Delete
            </FcButton>
            <button class="fc-btn-ghost fc-btn-icon" @click="emit('close')">
              <X :size="14" />
            </button>
          </div>
        </div>

        <template v-if="mode === 'view'">
          <div class="project-modal-topline">
            <div>
              <strong class="project-modal-name">{{ project.name }}</strong>
              <p class="project-modal-meta">{{ project.owner?.name || 'Unassigned owner' }} · updated {{ formatRelative(project.updatedAt) }}</p>
            </div>
            <span class="fc-risk-tag" :data-risk="riskTone(project.risk)">
              {{ riskLabel(project.risk) }}
            </span>
          </div>

          <div class="project-meta-grid">
            <div class="project-mini-card">
              <span><Users :size="13" /> Owner</span>
              <strong>{{ project.owner?.name || 'Unassigned' }}</strong>
              <p>{{ project.owner?.department || 'Choose an L0 or L1 owner' }}</p>
            </div>
            <div class="project-mini-card">
              <span><Workflow :size="13" /> Delivery state</span>
              <strong>{{ project.healthText }}</strong>
              <p>{{ project.openTasks }} open · {{ project.counts.blocked }} blocked</p>
            </div>
            <div class="project-mini-card">
              <span><FileText :size="13" /> Structure</span>
              <strong>{{ project.parentProjectId ? 'Sub-project' : 'Root project' }}</strong>
              <p>{{ project.childCount }} child project{{ project.childCount === 1 ? '' : 's' }}</p>
            </div>
            <div class="project-mini-card">
              <span><Clock3 :size="13" /> Updated</span>
              <strong>{{ formatRelative(project.updatedAt) }}</strong>
              <p>{{ formatDate(project.updatedAt) }}</p>
            </div>
          </div>

          <div class="project-modal-section">
            <div class="project-modal-section-header">
              <h5>Project brief</h5>
            </div>
            <div class="project-brief-box">
              <MarkdownPreview
                :source="project.description"
                empty-text="Add a Markdown brief so agents can review scope and execution details."
              />
            </div>
          </div>

          <div class="project-modal-section">
            <div class="project-modal-section-header">
              <h5>Current execution lane</h5>
              <span class="fc-badge">{{ tasks.length }} tasks</span>
            </div>

            <ul v-if="tasks.length > 0" class="fc-list">
              <li v-for="task in tasks.slice(0, 6)" :key="task.id" class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong>{{ task.title }}</strong>
                  <p class="fc-list-meta">{{ getAgentLabel(task.assigneeAgentId) }} · created by {{ getAgentLabel(task.createdBy) }}</p>
                </div>
                <span class="fc-badge" :data-status="task.status">{{ task.status }}</span>
              </li>
            </ul>

            <div v-else class="project-empty-state">
              No tasks yet. Delivery items will appear here once the owner decomposes the project.
            </div>
          </div>
        </template>

        <template v-else-if="mode === 'edit'">
          <div class="fc-form-grid" style="margin-bottom: 12px;">
            <div class="fc-form-group">
              <label class="fc-label">Project name</label>
              <FcInput v-model="draft.name" placeholder="e.g. Q2 Growth Engine" />
            </div>

            <div class="fc-form-group">
              <label class="fc-label">Owner agent</label>
              <FcSelect v-model="draft.ownerAgentId">
                <option value="" disabled>Select an L0 or L1 owner</option>
                <option v-for="agent in ownerOptions" :key="agent.id" :value="agent.id">
                  {{ agent.name }} — {{ agent.role }}
                </option>
              </FcSelect>
            </div>

            <div class="fc-form-group">
              <label class="fc-label">Parent project</label>
              <FcSelect v-model="draft.parentProjectId">
                <option value="">No parent project</option>
                <option v-for="projectOption in availableParentProjects" :key="projectOption.id" :value="projectOption.id">
                  {{ projectOption.name }}
                </option>
              </FcSelect>
            </div>
          </div>

          <div class="fc-form-group" style="margin-bottom: 12px;">
            <label class="fc-label">Operational brief</label>
            <MarkdownEditor
              v-model="draft.description"
              placeholder="Describe the goal, success criteria, scope, and constraints using Markdown."
              preview-empty-text="The project brief preview will appear here."
            />
          </div>

          <div class="fc-toolbar">
            <FcButton variant="primary" :disabled="busy || !draft.name || !draft.description || !draft.ownerAgentId" @click="submitEdit">
              <PencilLine :size="14" />
              {{ busy ? 'Saving…' : 'Save changes' }}
            </FcButton>
            <FcButton variant="ghost" :disabled="busy" @click="emit('changeMode', 'view')">Cancel</FcButton>
          </div>
        </template>

        <template v-else>
          <div class="project-delete-panel">
            <p>
              You are deleting <strong>{{ project.name }}</strong>. This action is only available when the project has no active tasks and no sub-projects.
            </p>

            <ul class="project-delete-checks">
              <li>
                <span>Tasks linked</span>
                <strong>{{ project.counts.total }}</strong>
              </li>
              <li>
                <span>Child projects</span>
                <strong>{{ project.childCount }}</strong>
              </li>
            </ul>

            <p v-if="!canDelete" class="project-delete-warning">
              {{
                deleteDisabledReason ||
                  'Clear all tasks and child projects first, then return here to delete it.'
              }}
            </p>

            <div class="fc-toolbar">
              <FcButton variant="danger" :disabled="busy || !canDelete" @click="confirmDelete">
                <Trash2 :size="14" />
                {{ busy ? 'Deleting…' : 'Delete project' }}
              </FcButton>
              <FcButton variant="ghost" :disabled="busy" @click="emit('changeMode', 'view')">Cancel</FcButton>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.project-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(4px);
}

.project-modal {
  width: min(920px, 100%);
  max-height: calc(100dvh - 40px);
  overflow: auto;
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-card-radius);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

.project-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.project-modal-header h4 {
  margin: 0;
  font-size: 1rem;
}

.project-modal-header p {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.project-modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.project-modal-topline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.project-modal-name {
  display: block;
  font-size: 1rem;
  color: var(--fc-text-main);
}

.project-modal-meta {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.project-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.project-mini-card {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}

.project-mini-card span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fc-text-faint);
}

.project-mini-card strong {
  display: block;
  margin-top: 6px;
  font-size: 0.9rem;
  color: var(--fc-text-main);
}

.project-mini-card p {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.project-modal-section + .project-modal-section {
  margin-top: 14px;
}

.project-modal-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.project-modal-section-header h5 {
  margin: 0;
  font-size: 0.9rem;
}

.project-brief-box {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--fc-surface-muted) 35%, var(--fc-surface));
}

.project-brief-box :deep(.fc-markdown) {
  font-size: 0.875rem;
}

.project-empty-state {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 14px;
  color: var(--fc-text-muted);
  background: color-mix(in srgb, var(--fc-surface-muted) 45%, var(--fc-surface));
}

.project-delete-panel p {
  margin: 0 0 12px;
  color: var(--fc-text-main);
}

.project-delete-checks {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.project-delete-checks li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 45%, var(--fc-surface));
}

.project-delete-checks span {
  color: var(--fc-text-muted);
  font-size: 0.8rem;
}

.project-delete-warning {
  color: var(--fc-warning);
}

@media (max-width: 720px) {
  .project-modal-header,
  .project-modal-topline {
    flex-direction: column;
  }

  .project-meta-grid,
  .project-delete-checks {
    grid-template-columns: 1fr;
  }
}
</style>
