<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { ArrowDown, LoaderCircle } from 'lucide-vue-next';

import type { ThreadMessage } from '../../composables/executiveChat.shared';
import { useI18n } from '../../composables/useI18n';
import ChatBubble from '../chat/ChatBubble.vue';
import ChatEmptyState from '../chat/ChatEmptyState.vue';

const props = defineProps<{
  thread: ThreadMessage[];
  selectedAgentName: string;
  isStreaming?: boolean;
  isLoadingOlder?: boolean;
  hasMoreHistory?: boolean;
  onSelectOption?: (option: string) => void;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  (event: 'loadOlder'): void;
}>();

const scrollRef = ref<HTMLDivElement | null>(null);
const showJumpToLatest = ref(false);

let pendingRestoreFromTop = false;
let previousScrollHeight = 0;
let previousScrollTop = 0;
let stickToBottom = true;

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
  scroller.scrollTo({ top: scroller.scrollHeight, behavior });
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
  () => props.thread,
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

    if (stickToBottom) {
      scrollToBottom(props.isStreaming ? 'auto' : 'smooth');
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="chat-thread">
    <ChatEmptyState v-if="props.thread.length === 0" />

    <div v-else ref="scrollRef" class="chat-thread-scroll" @scroll.passive="handleScroll">
      <div v-if="props.isLoadingOlder" class="chat-history-loading">
        <LoaderCircle :size="12" class="chat-history-spinner" />
        <span>{{ t('chat.thread.loadingOlder') }}</span>
      </div>

      <div v-if="props.isLoadingOlder" class="chat-history-skeletons" aria-hidden="true">
        <span class="chat-history-skeleton short" />
        <span class="chat-history-skeleton" />
      </div>

      <TransitionGroup tag="div" name="chat-bubble-list" class="chat-thread-list">
        <ChatBubble
          v-for="message in props.thread"
          :key="message.id"
          :message="message"
          :agent-name="props.selectedAgentName"
          :streaming="isStreamingMessage(message)"
          :on-select-option="props.onSelectOption"
        />
      </TransitionGroup>

      <button
        v-if="showJumpToLatest"
        type="button"
        class="chat-jump-latest"
        @click="scrollToBottom()"
      >
        <ArrowDown :size="14" />
        {{ t('chat.thread.jumpLatest') }}
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

.chat-history-loading {
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

.chat-history-spinner {
  animation: chat-spin 0.9s linear infinite;
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

@keyframes chat-skeleton-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
</style>
