<script setup lang="ts">
import { reactive, watch } from 'vue';
import { SlidersHorizontal, X } from 'lucide-vue-next';

import FcButton from '../FcButton.vue';
import FcSelect from '../FcSelect.vue';

interface FilterState {
  status: string;
  priority: string;
  projectId: string;
  assigneeAgentId: string;
}

const props = defineProps<{
  open: boolean;
  filters: FilterState;
  projectOptions: Array<{ id: string; name: string }>;
  assigneeOptions: Array<{ id: string; name: string }>;
}>();

const emit = defineEmits<{
  close: [];
  reset: [];
  apply: [value: FilterState];
}>();

const localFilters = reactive<FilterState>({
  status: 'all',
  priority: 'all',
  projectId: 'all',
  assigneeAgentId: 'all'
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      Object.assign(localFilters, props.filters);
    }
  },
  { immediate: true }
);

const apply = (): void => {
  emit('apply', { ...localFilters });
};
</script>

<template>
  <Transition name="fc-page">
    <div v-if="open" class="task-filter-modal-wrap" @click.self="emit('close')">
      <div class="task-filter-modal">
        <div class="task-filter-header">
          <div>
            <h4><SlidersHorizontal :size="16" /> Filters</h4>
            <p>Keep the board compact and open filters only when needed.</p>
          </div>
          <button class="fc-btn-ghost fc-btn-icon" @click="emit('close')">
            <X :size="14" />
          </button>
        </div>

        <div class="fc-form-grid" style="margin-bottom: 12px;">
          <div class="fc-form-group">
            <label class="fc-label">Status</label>
            <FcSelect v-model="localFilters.status">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </FcSelect>
          </div>

          <div class="fc-form-group">
            <label class="fc-label">Priority</label>
            <FcSelect v-model="localFilters.priority">
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </FcSelect>
          </div>

          <div class="fc-form-group">
            <label class="fc-label">Project</label>
            <FcSelect v-model="localFilters.projectId">
              <option value="all">All projects</option>
              <option v-for="project in projectOptions" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </FcSelect>
          </div>

          <div class="fc-form-group">
            <label class="fc-label">Assignee</label>
            <FcSelect v-model="localFilters.assigneeAgentId">
              <option value="all">All assignees</option>
              <option v-for="agent in assigneeOptions" :key="agent.id" :value="agent.id">
                {{ agent.name }}
              </option>
            </FcSelect>
          </div>
        </div>

        <div class="fc-toolbar">
          <FcButton variant="primary" @click="apply">Apply filters</FcButton>
          <FcButton variant="secondary" @click="emit('reset')">Reset</FcButton>
          <FcButton variant="ghost" @click="emit('close')">Close</FcButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.task-filter-modal-wrap {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 60;
  backdrop-filter: blur(3px);
}

.task-filter-modal {
  width: min(680px, 100%);
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-card-radius);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  padding: 16px;
}

.task-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.task-filter-header h4 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.task-filter-header p {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}
</style>
