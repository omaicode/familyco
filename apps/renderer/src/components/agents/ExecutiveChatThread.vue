<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { AlertTriangle, ArrowDown, CircleCheckBig, LoaderCircle, MessagesSquare } from 'lucide-vue-next';

import type { ChatToolCallDetails, ThreadMessage } from '../../composables/executiveChat.shared';

const props = defineProps<{
  thread: ThreadMessage[];
  selectedAgentName: string;
  isStreaming?: boolean;
  isLoadingOlder?: boolean;
  hasMoreHistory?: boolean;
}>();

const emit = defineEmits<{
  (event: 'loadOlder'): void;
}>();

const scrollRef = ref<HTMLDivElement | null>(null);
const showJumpToLatest = ref(false);
const historyStatusCopy = computed(() => {
  if (props.isLoadingOlder) {
    return 'Loading earlier messages…';
  }

  if (props.hasMoreHistory) {
    return 'Scroll up to load earlier messages';
  }

  return 'You are viewing the earliest available messages';
});

let pendingRestoreFromTop = false;
let previousScrollHeight = 0;
let previousScrollTop = 0;
let stickToBottom = true;

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

const isStreamingMessage = (message: ThreadMessage): boolean => {
  if (!props.isStreaming || message.direction !== 'agent_to_founder') {
    return false;
  }

  const lastAgentMessage = [...props.thread].reverse().find((entry) => entry.direction === 'agent_to_founder');
  return lastAgentMessage?.id === message.id;
};

const scrollToBottom = (behavior: ScrollBehavior = 'smooth'): void => {
  const scroller = scrollRef.value;
  if (!scroller) {
    return;
  }

  scroller.scrollTo({
    top: scroller.scrollHeight,
    behavior
  });
  stickToBottom = true;
  showJumpToLatest.value = false;
};

const handleScroll = (): void => {
  const scroller = scrollRef.value;
  if (!scroller) {
    return;
  }

  stickToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 72;
  showJumpToLatest.value = !stickToBottom && scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 120;

  if (scroller.scrollTop > 40 || props.isLoadingOlder || !props.hasMoreHistory) {
    return;
  }

  pendingRestoreFromTop = true;
  previousScrollHeight = scroller.scrollHeight;
  previousScrollTop = scroller.scrollTop;
  emit('loadOlder');
};

watch(
  () => [props.thread.length, props.isStreaming],
  async () => {
    await nextTick();

    const scroller = scrollRef.value;
    if (!scroller) {
      return;
    }

    if (pendingRestoreFromTop) {
      const delta = scroller.scrollHeight - previousScrollHeight;
      scroller.scrollTop = previousScrollTop + delta;
      pendingRestoreFromTop = false;
      showJumpToLatest.value = true;
      return;
    }

    if (stickToBottom || props.isStreaming) {
      scrollToBottom(props.isStreaming ? 'auto' : 'smooth');
    }
  },
  { immediate: true }
);
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

    <div v-else ref="scrollRef" class="chat-thread-scroll" @scroll.passive="handleScroll">
      <div class="chat-history-status" :data-loading="props.isLoadingOlder ? 'true' : 'false'">
        <template v-if="props.isLoadingOlder">
          <LoaderCircle :size="12" class="chat-streaming-spinner" />
          <span>{{ historyStatusCopy }}</span>
        </template>
        <template v-else>
          <span>{{ historyStatusCopy }}</span>
        </template>
      </div>

      <div v-if="props.isLoadingOlder" class="chat-history-skeletons" aria-hidden="true">
        <span class="chat-history-skeleton short"></span>
        <span class="chat-history-skeleton"></span>
      </div>

      <TransitionGroup tag="div" name="chat-bubble-list" class="chat-thread-list">
        <article
          v-for="message in props.thread"
          :key="message.id"
          class="chat-bubble"
          :class="[
            message.direction,
            {
              'chat-bubble-alert': hasToolError(message),
              'chat-bubble-streaming': isStreamingMessage(message)
            }
          ]"
        >
          <div class="chat-bubble-meta">
            <span>{{ message.direction === 'founder_to_agent' ? 'Founder' : props.selectedAgentName }}</span>
            <span>{{ new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
          <p class="chat-bubble-body">{{ message.body }}</p>

          <div v-if="isStreamingMessage(message)" class="chat-streaming-indicator">
            <LoaderCircle :size="12" class="chat-streaming-spinner" />
            <span>Agent is responding…</span>
          </div>

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
      </TransitionGroup>

      <button
        v-if="showJumpToLatest"
        type="button"
        class="chat-jump-latest"
        @click="scrollToBottom()"
      >
        <ArrowDown :size="14" />
        Latest
      </button>
    </div>
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

.chat-thread-scroll {
  position: relative;
  max-height: min(50vh, 680px);
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-gutter: stable;
}

.chat-thread-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-history-status {
  position: sticky;
  top: 0;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 auto 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fc-surface) 88%, white 12%);
  color: var(--fc-text-muted);
  font-size: 0.72rem;
  box-shadow: 0 8px 18px -16px rgba(15, 23, 42, 0.5);
}

.chat-history-skeletons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.chat-history-skeleton {
  display: block;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--fc-surface-muted) 90%, white 10%) 0%, color-mix(in srgb, var(--fc-primary) 8%, var(--fc-surface)) 50%, color-mix(in srgb, var(--fc-surface-muted) 90%, white 10%) 100%);
  background-size: 180% 100%;
  animation: chat-skeleton-shimmer 1.1s linear infinite;
}

.chat-history-skeleton.short {
  width: 68%;
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
  line-height: 1.6;
  white-space: pre-wrap;
  font-size: 0.875rem;
}

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

.chat-bubble-list-enter-active,
.chat-bubble-list-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.chat-bubble-list-enter-from,
.chat-bubble-list-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
}

.chat-jump-latest {
  position: sticky;
  bottom: 12px;
  left: calc(100% - 108px);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  margin-left: auto;
  border: 1px solid color-mix(in srgb, var(--fc-primary) 24%, var(--fc-border-subtle));
  border-radius: 999px;
  padding: 7px 10px;
  background: color-mix(in srgb, var(--fc-surface) 90%, white 10%);
  color: var(--fc-primary);
  font-size: 0.76rem;
  font-weight: 700;
  box-shadow: 0 12px 24px -20px rgba(59, 130, 246, 0.5);
  cursor: pointer;
}

@keyframes chat-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes chat-sheen {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

@keyframes chat-skeleton-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
</style>
