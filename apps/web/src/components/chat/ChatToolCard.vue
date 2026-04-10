<script setup lang="ts">
import { AlertTriangle, CircleCheckBig, LoaderCircle } from 'lucide-vue-next';

import type { ChatToolCallDetails, ChatToolInProgress } from '../../composables/executiveChat.shared';
import { useI18n } from '../../composables/useI18n';

defineProps<{
  completedCalls: ChatToolCallDetails[];
  inProgressCalls: ChatToolInProgress[];
  messageId: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div v-if="inProgressCalls.length > 0 || completedCalls.length > 0" class="chat-tool-results">
    <div
      v-for="tool in inProgressCalls"
      :key="`${messageId}-progress-${tool.toolName}`"
      class="chat-tool-item chat-tool-running"
    >
      <div class="chat-tool-header">
        <span class="chat-tool-status chat-tool-status-running">
          <LoaderCircle :size="13" class="chat-tool-spinner" />
          {{ t('chat.tool.running') }}
        </span>
        <code>{{ tool.toolName }}</code>
      </div>
    </div>

    <div
      v-for="(toolCall, index) in completedCalls"
      :key="`${messageId}-${toolCall.toolName}-${index}`"
      class="chat-tool-item"
      :data-ok="toolCall.ok"
    >
      <div class="chat-tool-header">
        <span class="chat-tool-status" :class="toolCall.ok ? 'chat-tool-status-ok' : 'chat-tool-status-fail'">
          <component :is="toolCall.ok ? CircleCheckBig : AlertTriangle" :size="13" />
          {{ toolCall.ok ? t('chat.tool.completed') : t('chat.tool.failed') }}
        </span>
        <code>{{ toolCall.toolName }}</code>
      </div>
      <p class="chat-tool-summary">{{ toolCall.summary }}</p>
      <p v-if="toolCall.error?.message" class="chat-tool-error">
        {{ toolCall.error.message }}
        <span v-if="toolCall.error.code">({{ toolCall.error.code }})</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.chat-tool-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.chat-tool-item {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--fc-surface-muted) 75%, var(--fc-surface));
  transition: border-color 0.2s ease, background 0.2s ease;
}

.chat-tool-item[data-ok='false'] {
  border-color: color-mix(in srgb, var(--fc-danger) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-danger) 5%, var(--fc-surface));
}

.chat-tool-running {
  border-color: color-mix(in srgb, var(--fc-primary) 30%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 4%, var(--fc-surface));
}

.chat-tool-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 4px;
}

.chat-tool-header code {
  font-size: 0.72rem;
  color: var(--fc-text-muted);
}

.chat-tool-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.chat-tool-status-ok {
  color: var(--fc-success);
}

.chat-tool-status-fail {
  color: var(--fc-danger);
}

.chat-tool-status-running {
  color: var(--fc-primary);
}

.chat-tool-spinner {
  animation: chat-tool-spin 0.9s linear infinite;
}

.chat-tool-summary,
.chat-tool-error {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.chat-tool-error {
  color: var(--fc-danger);
  margin-top: 4px;
}

@keyframes chat-tool-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
