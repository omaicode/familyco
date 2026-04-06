<script setup lang="ts">
import { AlertTriangle, CircleCheckBig, MessagesSquare } from 'lucide-vue-next';

import type { ChatToolCallDetails, ThreadMessage } from '../../composables/useExecutiveChat';

const props = defineProps<{
  thread: ThreadMessage[];
  selectedAgentName: string;
}>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isToolCallDetails = (value: unknown): value is ChatToolCallDetails => {
  return isRecord(value)
    && typeof value.toolName === 'string'
    && typeof value.ok === 'boolean'
    && typeof value.summary === 'string';
};

const getMessageToolCalls = (message: ThreadMessage): ChatToolCallDetails[] => {
  if (!isRecord(message.payload) || !Array.isArray(message.payload.toolCalls)) {
    return [];
  }

  return message.payload.toolCalls.filter(isToolCallDetails);
};

const hasToolError = (message: ThreadMessage): boolean => {
  return message.type === 'alert' || getMessageToolCalls(message).some((toolCall) => !toolCall.ok);
};
</script>

<template>
  <div class="chat-thread">
    <div v-if="props.thread.length === 0" class="chat-empty-state">
      <MessagesSquare :size="26" />
      <div>
        <p class="chat-empty-title">Start the first conversation</p>
        <p class="chat-empty-copy">
          Use chat for planning and direction. Ask explicitly when you want the agent to call tools for a new task or project.
        </p>
      </div>
    </div>

    <article
      v-for="message in props.thread"
      v-else
      :key="message.id"
      class="chat-bubble"
      :class="[message.direction, { 'chat-bubble-alert': hasToolError(message) }]"
    >
      <div class="chat-bubble-meta">
        <span>{{ message.direction === 'founder_to_agent' ? 'Founder' : props.selectedAgentName }}</span>
        <span>{{ new Date(message.createdAt).toLocaleString() }}</span>
      </div>
      <p class="chat-bubble-title">{{ message.title }}</p>
      <p class="chat-bubble-body">{{ message.body }}</p>

      <div v-if="message.direction === 'agent_to_founder' && getMessageToolCalls(message).length > 0" class="chat-tool-results">
        <div
          v-for="(toolCall, index) in getMessageToolCalls(message)"
          :key="`${message.id}-${toolCall.toolName}-${index}`"
          class="chat-tool-item"
          :data-ok="toolCall.ok"
        >
          <div class="chat-tool-header">
            <span class="chat-tool-status">
              <component :is="toolCall.ok ? CircleCheckBig : AlertTriangle" :size="13" />
              {{ toolCall.ok ? 'Tool completed' : 'Tool failed' }}
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
    </article>
  </div>
</template>

<style scoped>
.chat-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
  min-height: 220px;
}

.chat-empty-state {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 12px;
  background: var(--fc-surface-muted);
  color: var(--fc-text-muted);
}

.chat-empty-title {
  margin: 0 0 4px;
  font-weight: 600;
  color: var(--fc-text-main);
}

.chat-empty-copy {
  margin: 0;
  line-height: 1.5;
}

.chat-bubble {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--fc-surface);
}

.chat-bubble.agent_to_founder {
  border-color: color-mix(in srgb, var(--fc-primary) 28%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface));
}

.chat-bubble-alert {
  border-color: color-mix(in srgb, var(--fc-danger) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-danger) 5%, var(--fc-surface));
}

.chat-bubble-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  margin-bottom: 6px;
}

.chat-bubble-title {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.chat-bubble-body {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}

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
}

.chat-tool-item[data-ok='false'] {
  border-color: color-mix(in srgb, var(--fc-danger) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-danger) 5%, var(--fc-surface));
}

.chat-tool-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 4px;
}

.chat-tool-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
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
</style>
