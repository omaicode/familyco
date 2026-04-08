<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';
import { CheckSquare2, Square } from 'lucide-vue-next';

import FcButton from '../FcButton.vue';
import FcSelect from '../FcSelect.vue';

const props = defineProps<{
  selectedCount: number;
  allVisibleSelected: boolean;
  busy: boolean;
  bulkStatus: TaskListItem['status'];
  bulkPriority: TaskListItem['priority'];
}>();

const emit = defineEmits<{
  toggleAll: [];
  clear: [];
  applyStatus: [];
  applyPriority: [];
  'update:bulkStatus': [value: TaskListItem['status']];
  'update:bulkPriority': [value: TaskListItem['priority']];
}>();
</script>

<template>
  <div class="bulk-toolbar">
    <div>
      <strong>{{ props.selectedCount }} task{{ props.selectedCount === 1 ? '' : 's' }} selected</strong>
      <p class="fc-card-desc" style="margin-top: 4px;">Apply status or priority changes in one step.</p>
    </div>

    <div class="bulk-toolbar-actions">
      <button class="fc-btn-ghost" @click="emit('toggleAll')">
        <component :is="props.allVisibleSelected ? CheckSquare2 : Square" :size="14" />
        {{ props.allVisibleSelected ? 'Clear visible' : 'Select visible' }}
      </button>

      <div class="bulk-field">
        <FcSelect :model-value="props.bulkStatus" @update:modelValue="emit('update:bulkStatus', $event as TaskListItem['status'])">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="review">Review</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </FcSelect>
        <FcButton variant="secondary" :disabled="props.busy" @click="emit('applyStatus')">Move selected</FcButton>
      </div>

      <div class="bulk-field">
        <FcSelect :model-value="props.bulkPriority" @update:modelValue="emit('update:bulkPriority', $event as TaskListItem['priority'])">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </FcSelect>
        <FcButton variant="secondary" :disabled="props.busy" @click="emit('applyPriority')">Set priority</FcButton>
      </div>

      <FcButton variant="ghost" :disabled="props.busy" @click="emit('clear')">Clear</FcButton>
    </div>
  </div>
</template>

<style scoped>
.bulk-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.bulk-toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.bulk-field {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

@media (max-width: 1100px) {
  .bulk-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .bulk-toolbar-actions,
  .bulk-field {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
