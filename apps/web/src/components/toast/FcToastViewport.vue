<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-vue-next';

import { useI18n } from '../../composables/useI18n';
import { useToast, type ToastItem } from '../../plugins/toast.plugin';

const { t } = useI18n();
const { toasts, dismiss } = useToast();

const iconMap: Record<ToastItem['type'], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
};

const classMap: Record<ToastItem['type'], string> = {
  success: 'fc-toast-success',
  error: 'fc-toast-error',
  info: 'fc-toast-info'
};
</script>

<template>
  <TransitionGroup
    v-if="toasts.length > 0"
    tag="section"
    class="fc-toast-viewport"
    name="fc-toast"
    :aria-label="t('toast.notifications')"
    aria-live="polite"
  >
    <article
      v-for="toast in toasts"
      :key="toast.id"
      class="fc-toast-card"
      :class="classMap[toast.type]"
      :role="toast.type === 'error' ? 'alert' : 'status'"
    >
      <component :is="iconMap[toast.type]" :size="16" class="fc-toast-icon" />
      <p class="fc-toast-message">{{ toast.message }}</p>
      <button
        type="button"
        class="fc-toast-close"
        :aria-label="t('toast.dismiss')"
        @click="dismiss(toast.id)"
      >
        <X :size="13" />
      </button>
    </article>
  </TransitionGroup>
</template>

<style scoped>
.fc-toast-viewport {
  position: fixed;
  top: calc(var(--fc-topbar-height, 0px) + 12px);
  right: clamp(12px, 2vw, 24px);
  z-index: 220;
  display: flex;
  width: min(360px, calc(100vw - 24px));
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.fc-toast-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
  border-radius: 12px;
  border: 1px solid var(--fc-border-subtle);
  background: color-mix(in srgb, var(--fc-surface) 92%, white 8%);
  padding: 12px 12px 12px 14px;
  box-shadow: 0 18px 40px -28px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  pointer-events: auto;
}

.fc-toast-success {
  border-color: color-mix(in srgb, var(--fc-success) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-success) 9%, var(--fc-surface));
  color: color-mix(in srgb, var(--fc-success) 82%, var(--fc-text-main));
}

.fc-toast-error {
  border-color: color-mix(in srgb, var(--fc-error) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-error) 8%, var(--fc-surface));
  color: color-mix(in srgb, var(--fc-error) 82%, var(--fc-text-main));
}

.fc-toast-info {
  border-color: color-mix(in srgb, var(--fc-info) 32%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-info) 8%, var(--fc-surface));
  color: color-mix(in srgb, var(--fc-info) 82%, var(--fc-text-main));
}

.fc-toast-icon {
  margin-top: 1px;
  flex-shrink: 0;
}

.fc-toast-message {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.45;
  color: inherit;
}

.fc-toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  cursor: pointer;
  padding: 2px;
  border-radius: 999px;
}

.fc-toast-close:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.fc-toast-enter-active,
.fc-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fc-toast-enter-from,
.fc-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.985);
}

.fc-toast-move {
  transition: transform 0.2s ease;
}

@media (max-width: 767px) {
  .fc-toast-viewport {
    right: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
