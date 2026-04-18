<script setup lang="ts">
import { computed, watch } from 'vue';

import { useI18n } from '../composables/useI18n';

interface Props {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: readonly number[];
  hidePageSize?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [10, 20, 50],
  hidePageSize: false
});

const emit = defineEmits<{
  'update:currentPage': [value: number];
  'update:pageSize': [value: number];
}>();

const { t } = useI18n();

const normalizedPageSizeOptions = computed(() => {
  const values = props.pageSizeOptions
    .map((value) => Math.floor(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique : [10, 20, 50];
});

const normalizedPageSize = computed(() => {
  const value = Math.floor(props.pageSize);
  if (!Number.isFinite(value) || value < 1) {
    return normalizedPageSizeOptions.value[0];
  }

  return value;
});

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(props.totalItems / normalizedPageSize.value));
});

const normalizedCurrentPage = computed(() => {
  const value = Math.floor(props.currentPage);
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(totalPages.value, Math.max(1, value));
});

const pageSizeModel = computed({
  get: () => normalizedPageSize.value,
  set: (value: number) => {
    const parsed = Math.floor(value);
    const fallback = normalizedPageSizeOptions.value[0];
    emit('update:pageSize', Number.isFinite(parsed) && parsed > 0 ? parsed : fallback);
  }
});

const goToPreviousPage = (): void => {
  emit('update:currentPage', Math.max(1, normalizedCurrentPage.value - 1));
};

const goToNextPage = (): void => {
  emit('update:currentPage', Math.min(totalPages.value, normalizedCurrentPage.value + 1));
};

watch(
  () => props.pageSize,
  (value) => {
    if (value !== normalizedPageSize.value) {
      emit('update:pageSize', normalizedPageSize.value);
    }
  },
  { immediate: true }
);

watch(
  () => props.currentPage,
  (value) => {
    if (value !== normalizedCurrentPage.value) {
      emit('update:currentPage', normalizedCurrentPage.value);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="totalItems > 0" class="fc-toolbar" style="margin-top: 12px; align-items: center;">
    <label v-if="!hidePageSize" class="fc-list-meta" style="display:flex; align-items:center; gap:6px; margin: 0;">
      {{ t('Items per page') }}
      <select v-model.number="pageSizeModel" class="fc-input" style="width: 92px; min-width: 92px;">
        <option v-for="option in normalizedPageSizeOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>
    <span class="fc-toolbar-spacer"></span>
    <span class="fc-list-meta" style="margin: 0;">{{ t('Page') }} {{ normalizedCurrentPage }} / {{ totalPages }}</span>
    <button class="fc-btn-ghost fc-btn-sm" :disabled="normalizedCurrentPage <= 1" @click="goToPreviousPage">
      {{ t('Previous') }}
    </button>
    <button class="fc-btn-ghost fc-btn-sm" :disabled="normalizedCurrentPage >= totalPages" @click="goToNextPage">
      {{ t('Next') }}
    </button>
  </div>
</template>
