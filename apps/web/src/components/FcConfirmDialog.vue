<script setup lang="ts">
import FcModalShell from './FcModalShell.vue';
import FcButton from './FcButton.vue';

withDefaults(defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  confirmVariant: 'danger',
  busy: false
});

const emit = defineEmits<{
  (event: 'confirm'): void;
  (event: 'cancel'): void;
}>();
</script>

<template>
  <FcModalShell
    :open="open"
    :ariaLabel="title"
    panel-class="fc-confirm-dialog"
    @close="emit('cancel')"
  >
    <div class="fc-confirm-dialog__body">
      <h4>{{ title }}</h4>
      <p>{{ message }}</p>
    </div>
    <div class="fc-confirm-dialog__actions">
      <FcButton variant="secondary" :disabled="busy" @click="emit('cancel')">
        {{ cancelLabel }}
      </FcButton>
      <FcButton :variant="confirmVariant" :disabled="busy" @click="emit('confirm')">
        {{ confirmLabel }}
      </FcButton>
    </div>
  </FcModalShell>
</template>

<style scoped>
.fc-confirm-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fc-confirm-dialog__body h4 {
  margin: 0;
  font-size: 1rem;
}

.fc-confirm-dialog__body p {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.fc-confirm-dialog__actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
