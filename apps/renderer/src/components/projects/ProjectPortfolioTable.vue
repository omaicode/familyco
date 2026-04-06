<script setup lang="ts">
import type { AgentListItem, ProjectListItem } from '@familyco/ui';

import FcButton from '../FcButton.vue';

type RiskLevel = 'healthy' | 'watch' | 'critical';

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
  projects: ProjectPortfolioItem[];
  selectedProjectId: string | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  formatRelative: (iso: string) => string;
  riskLabel: (risk: RiskLevel) => string;
  riskTone: (risk: RiskLevel) => 'low' | 'medium' | 'high';
}>();

const emit = defineEmits<{
  select: [projectId: string];
  view: [projectId: string];
  edit: [projectId: string];
  remove: [projectId: string];
  changePage: [page: number];
}>();

const goToPage = (page: number): void => {
  if (page < 1 || page > props.totalPages || page === props.currentPage) {
    return;
  }

  emit('changePage', page);
};
</script>

<template>
  <div class="project-table-toolbar">
    <p class="project-table-summary">
      <template v-if="totalItems > 0">
        Showing <strong>{{ rangeStart }}–{{ rangeEnd }}</strong> of <strong>{{ totalItems }}</strong> projects
      </template>
      <template v-else>
        No projects match the current filter.
      </template>
    </p>

    <div v-if="totalItems > 0" class="project-pagination">
      <FcButton variant="secondary" size="sm" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
        Previous
      </FcButton>
      <span class="project-pagination-label">Page {{ currentPage }} / {{ totalPages }}</span>
      <FcButton variant="secondary" size="sm" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
        Next
      </FcButton>
    </div>
  </div>

  <div class="project-table-wrap">
    <table class="project-table">
      <thead>
        <tr>
          <th>Project</th>
          <th>Owner</th>
          <th>Status</th>
          <th>Open</th>
          <th>Blocked</th>
          <th>Updated</th>
          <th></th>
        </tr>
      </thead>
      <tbody v-if="projects.length > 0">
        <tr
          v-for="project in projects"
          :key="project.id"
          :class="{ 'project-row-selected': selectedProjectId === project.id }"
          @click="emit('select', project.id); emit('view', project.id)"
        >
          <td class="project-main-cell">
            <strong class="project-name">{{ project.name }}</strong>
            <p class="project-meta">
              {{ project.parentProjectId ? 'Sub-project' : 'Root project' }}
              <template v-if="project.childCount > 0"> · {{ project.childCount }} child</template>
            </p>
            <p class="project-preview">{{ project.preview }}</p>
          </td>
          <td>
            <strong class="project-owner">{{ project.owner?.name || 'Unassigned' }}</strong>
            <p class="project-meta">{{ project.owner?.role || 'Assign an owner' }}</p>
          </td>
          <td>
            <span class="fc-risk-tag" :data-risk="riskTone(project.risk)">
              {{ riskLabel(project.risk) }}
            </span>
            <p class="project-meta project-health">{{ project.healthText }}</p>
          </td>
          <td class="project-count-cell">{{ project.openTasks }}</td>
          <td class="project-count-cell">{{ project.counts.blocked }}</td>
          <td>
            <strong class="project-updated">{{ formatRelative(project.updatedAt) }}</strong>
          </td>
          <td class="project-action-cell">
            <div class="project-row-actions">
              <FcButton variant="secondary" size="sm" @click.stop="emit('select', project.id); emit('view', project.id)">
                View
              </FcButton>
              <FcButton variant="ghost" size="sm" @click.stop="emit('select', project.id); emit('edit', project.id)">
                Edit
              </FcButton>
              <FcButton variant="danger" size="sm" @click.stop="emit('select', project.id); emit('remove', project.id)">
                Delete
              </FcButton>
            </div>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr>
          <td colspan="7" class="project-empty-row">No projects match the current filter.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.project-table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.project-table-summary {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.project-table-summary strong {
  color: var(--fc-text-main);
}

.project-pagination {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.project-pagination-label {
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.project-table-wrap {
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--fc-border-subtle) 88%, transparent);
  border-radius: var(--fc-card-radius);
}

.project-table {
  width: 100%;
  min-width: 880px;
  border-collapse: collapse;
  background: var(--fc-surface);
}

.project-table th,
.project-table td {
  padding: 12px;
  text-align: left;
  vertical-align: top;
}

.project-table thead th {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fc-text-muted);
  background: color-mix(in srgb, var(--fc-surface) 92%, white);
  border-bottom: 1px solid var(--fc-border-subtle);
}

.project-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

.project-table tbody tr + tr td {
  border-top: 1px solid color-mix(in srgb, var(--fc-border-subtle) 90%, transparent);
}

.project-table tbody tr:hover {
  background: color-mix(in srgb, var(--fc-primary) 4%, transparent);
}

.project-row-selected {
  background: color-mix(in srgb, var(--fc-primary) 7%, var(--fc-surface));
}

.project-main-cell {
  min-width: 270px;
}

.project-name,
.project-owner,
.project-updated {
  display: block;
  color: var(--fc-text-main);
}

.project-preview,
.project-meta {
  margin: 4px 0 0;
  font-size: 0.76rem;
  color: var(--fc-text-muted);
  line-height: 1.45;
}

.project-preview {
  margin-top: 6px;
}

.project-health {
  max-width: 200px;
}

.project-count-cell {
  font-weight: 700;
  color: var(--fc-text-main);
}

.project-action-cell {
  white-space: nowrap;
}

.project-row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.project-empty-row {
  padding: 24px 12px;
  text-align: center;
  color: var(--fc-text-muted);
}

@media (max-width: 720px) {
  .project-table-toolbar {
    align-items: flex-start;
  }
}
</style>
