<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  ariaLabel: string;
  panelClass?: string;
  overlayClass?: string;
  zIndex?: number;
  closeOnOverlay?: boolean;
  align?: 'center' | 'top';
}>(), {
  panelClass: '',
  overlayClass: '',
  zIndex: 70,
  closeOnOverlay: true,
  align: 'center'
});

const emit = defineEmits<{
  close: [];
}>();

const overlayAlignClass = computed(() =>
  props.align === 'top' ? 'fc-modal-shell__overlay--top' : 'fc-modal-shell__overlay--center'
);

const handleOverlayClick = (): void => {
  if (props.closeOnOverlay) {
    emit('close');
  }
};
</script>

<template>
  <Transition name="fc-page">
    <div
      v-if="open"
      class="fc-modal-shell__overlay"
      :class="[overlayAlignClass, overlayClass]"
      :style="{ zIndex: String(zIndex) }"
      @click.self="handleOverlayClick"
    >
      <div
        class="fc-modal-shell__panel"
        :class="panelClass"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel"
      >
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fc-modal-shell__overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(4px);
}

.fc-modal-shell__overlay--center {
  align-items: center;
}

.fc-modal-shell__overlay--top {
  align-items: flex-start;
}

.fc-modal-shell__panel {
  width: min(760px, 100%);
  max-height: calc(100dvh - 40px);
  overflow: auto;
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-card-radius);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

@media (max-width: 720px) {
  .fc-modal-shell__overlay {
    padding: 12px;
  }

  .fc-modal-shell__panel {
    max-height: calc(100dvh - 24px);
  }
}
</style>
