<script setup lang="ts">
import type { ChatAttachmentItem } from '@familyco/ui';

import type { ChatConfirmRequest, ChatToolCallDetails, ChatToolInProgress, ThreadMessage } from '../../composables/executiveChat.shared';
import { isChatAttachmentItem, isChatConfirmRequest, isRecord, isToolCallDetails } from '../../composables/executiveChat.shared';
import { useI18n } from '../../composables/useI18n';
import MarkdownPreview from '../MarkdownPreview.vue';
import ChatAttachmentList from './ChatAttachmentList.vue';
import ChatStreamingIndicator from './ChatStreamingIndicator.vue';
import ChatToolCard from './ChatToolCard.vue';

const props = defineProps<{
  message: ThreadMessage;
  agentName: string;
  agentId: string;
  streaming: boolean;
  onSelectOption?: (option: string) => void;
  onEditMessage?: (message: ThreadMessage) => void;
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

const getConfirmRequest = (message: ThreadMessage): ChatConfirmRequest | null => {
  if (!isRecord(message.payload) || !isChatConfirmRequest(message.payload.confirmRequest)) {
    return null;
  }
  return message.payload.confirmRequest;
};

const hasError = (message: ThreadMessage): boolean => {
  return message.type === 'alert' || getToolCalls(message).some((tc) => !tc.ok);
};

const getAttachments = (message: ThreadMessage): ChatAttachmentItem[] => {
  if (!isRecord(message.payload) || !Array.isArray(message.payload.attachments)) {
    return [];
  }

  return message.payload.attachments.filter(isChatAttachmentItem);
};

const getStreamingStatus = (message: ThreadMessage): string => {
  if (message.payload?.resuming === true) {
    return t('chat.thread.status.resuming');
  }
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

const isEditableFounderMessage = (message: ThreadMessage): boolean =>
  message.direction === 'founder_to_agent'
  && typeof props.onEditMessage === 'function'
  && typeof message.payload?.supersededByMessageId !== 'string';

const getEditBadge = (message: ThreadMessage): string | null => {
  if (typeof message.payload?.supersededByMessageId === 'string') {
    return t('chat.edit.label.superseded');
  }

  if (typeof message.payload?.editedFromMessageId === 'string') {
    return t('chat.edit.label.edited');
  }

  return null;
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
      <span class="chat-bubble-author">
        {{ message.direction === 'founder_to_agent' ? t('chat.bubble.founder') : props.agentName }}
        <span v-if="getEditBadge(message)" class="chat-edit-badge">{{ getEditBadge(message) }}</span>
      </span>
      <span class="chat-bubble-meta-actions">
        <button
          v-if="isEditableFounderMessage(message)"
          type="button"
          class="chat-edit-action"
          @click="props.onEditMessage?.(message)"
        >
          {{ t('chat.edit.action') }}
        </button>
        <span>{{ formatTime(message.createdAt) }}</span>
      </span>
    </div>

    <MarkdownPreview
      v-if="message.body.trim().length > 0"
      class="chat-bubble-body"
      :source="message.body"
      empty-text=""
    />

    <ChatAttachmentList
      v-if="getAttachments(message).length > 0"
      :agent-id="props.agentId"
      :attachments="getAttachments(message)"
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

    <div
      v-if="message.direction === 'agent_to_founder' && getConfirmRequest(message)"
      class="chat-confirm-options"
    >
      <p class="chat-confirm-label">{{ t('chat.confirm.chooseOption') }}</p>
      <div class="chat-confirm-buttons">
        <button
          v-for="option in getConfirmRequest(message)!.options"
          :key="option"
          type="button"
          class="chat-confirm-btn"
          :disabled="props.streaming"
          @click="props.onSelectOption?.(option)"
        >
          {{ option }}
        </button>
      </div>
    </div>
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

.chat-bubble-author,
.chat-bubble-meta-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chat-edit-badge {
  border-radius: 999px;
  padding: 2px 7px;
  background: color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface));
  color: var(--fc-primary);
  font-size: 0.68rem;
  font-weight: 700;
}

.chat-edit-action {
  border: 0;
  background: transparent;
  color: var(--fc-primary);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
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

.chat-confirm-options {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--fc-border-subtle) 60%, transparent);
}

.chat-confirm-label {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fc-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chat-confirm-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chat-confirm-btn {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--fc-primary) 40%, var(--fc-border-subtle));
  border-radius: 999px;
  background: color-mix(in srgb, var(--fc-primary) 8%, var(--fc-surface));
  color: var(--fc-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
}

.chat-confirm-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--fc-primary) 16%, var(--fc-surface));
  border-color: var(--fc-primary);
  transform: translateY(-1px);
}

.chat-confirm-btn:active:not(:disabled) {
  transform: translateY(0);
}

.chat-confirm-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
