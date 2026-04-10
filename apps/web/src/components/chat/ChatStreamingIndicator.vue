<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';

defineProps<{
  statusText: string;
}>();
</script>

<template>
  <div class="chat-streaming-indicator">
    <LoaderCircle :size="12" class="chat-streaming-spinner" />
    <span>{{ statusText }}</span>
  </div>
</template>

<style scoped>
.chat-streaming-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--fc-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.chat-streaming-spinner {
  animation: chat-spin 0.9s linear infinite;
}

@keyframes chat-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
