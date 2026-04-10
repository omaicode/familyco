<script setup lang="ts">
import type { ChatToolCallDetails, ChatToolInProgress, ThreadMessage } from '../../composables/executiveChat.shared';
import { isRecord, isToolCallDetails } from '../../composables/executiveChat.shared';
import { useI18n } from '../../composables/useI18n';
import MarkdownPreview from '../MarkdownPreview.vue';
import ChatStreamingIndicator from './ChatStreamingIndicator.vue';
import ChatToolCard from './ChatToolCard.vue';

const props = defineProps<{
  message: ThreadMessage;
  agentName: string;
  streaming: boolean;
}>();

const { t } = useI18n();

const getToolCalls = (message: ThreadMessage): ChatToolCallDetails[] => {
  if (!isRecord(message.payload) || !Array.isArray(message.payload.toolCalls)) {
    return [];
  }
  return message.payload.toolCalls.filter(isToolCallDetails);
};

const getToolsInProgress = (message: ThreadMessage): ChatToolInProgress[] => {
  if (!isRecord(message.payload) || !Array.isArray(message.payload.toolsInProgress)) {
    return [];
  }
  return message.payload.toolsInProgress.filter(
    (entry): entry is ChatToolInProgress =>
      isRecord(entry) && typeof entry.toolName === 'string' && typeof entry.startedAt === 'string'
  );
};

const hasError = (message: ThreadMessage): boolean => {
  return message.type === 'alert' || getToolCalls(message).some((tc) => !tc.ok);
};

const getStreamingStatus = (message: ThreadMessage): string => {
  if (getToolsInProgress(message).length > 0) {
    return t('chat.thread.status.tool');
  }
  if (getToolCalls(message).length > 0) {
    return t('chat.thread.status.tool');
  }
  if (message.body.trim().length === 0) {
    return t('chat.thread.status.reasoning');
  }
  return t('chat.thread.status.typing');
};

const formatTime = (date: string): string => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
</script>

<template>
  <article
    class="chat-bubble"
    :class="[
      message.direction,
      {
        'chat-bubble-alert': hasError(message),
        'chat-bubble-streaming': props.streaming
      }
    ]"
  >
    <div class="chat-bubble-meta">
      <span>{{ message.direction === 'founder_to_agent' ? t('chat.bubble.founder') : props.agentName }}</span>
      <span>{{ formatTime(message.createdAt) }}</span>
    </div>

    <MarkdownPreview
      v-if="message.body.trim().length > 0"
      class="chat-bubble-body"
      :source="message.body"
      empty-text=""
    />

    <ChatStreamingIndicator
      v-if="props.streaming"
      :status-text="getStreamingStatus(message)"
    />

    <ChatToolCard
      v-if="message.direction === 'agent_to_founder'"
      :completed-calls="getToolCalls(message)"
      :in-progress-calls="getToolsInProgress(message)"
      :message-id="message.id"
    />
  </article>
</template>

<style scoped>
.chat-bubble {
  position: relative;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 14px;
  padding: 12px 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--fc-surface) 95%, white 5%), var(--fc-surface));
  box-shadow: 0 14px 28px -24px rgba(15, 23, 42, 0.45);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.chat-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px -28px rgba(15, 23, 42, 0.5);
}

.chat-bubble.agent_to_founder {
  border-color: color-mix(in srgb, var(--fc-primary) 30%, var(--fc-border-subtle));
  background: linear-gradient(180deg, color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface)), color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface)));
}

.chat-bubble-streaming {
  overflow: hidden;
}

.chat-bubble-streaming::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 15%, rgba(255, 255, 255, 0.22) 45%, transparent 75%);
  transform: translateX(-100%);
  animation: chat-sheen 1.8s ease-in-out infinite;
  pointer-events: none;
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

.chat-bubble-body {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.65;
}

.chat-bubble-body :deep(p) {
  margin-top: 0.22rem;
  margin-bottom: 0.22rem;
}

.chat-bubble-body :deep(h1),
.chat-bubble-body :deep(h2),
.chat-bubble-body :deep(h3) {
  margin-top: 0.42rem;
  margin-bottom: 0.18rem;
  line-height: 1.35;
}

.chat-bubble-body :deep(h1 + p),
.chat-bubble-body :deep(h2 + p),
.chat-bubble-body :deep(h3 + p) {
  margin-top: 0.14rem;
}

.chat-bubble-body :deep(code) {
  font-size: 0.86em;
}

@keyframes chat-sheen {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
</style>
