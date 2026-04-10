<script setup lang="ts">
import { computed, toRef } from 'vue';
import { CornerDownLeft, Send } from 'lucide-vue-next';

import { useExecutiveSlashCommands } from '../../composables/useExecutiveSlashCommands';
import ExecutiveSlashCommandPalette from './ExecutiveSlashCommandPalette.vue';
import FcButton from '../FcButton.vue';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const props = defineProps<{
  modelValue: string;
  agentId: string;
  connectionState: ConnectionState;
  isSending: boolean;
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'send'): void;
}>();

const draftValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
});

const {
  composerRef,
  activeSlashIndex,
  isSlashMode,
  isSlashPopoverVisible,
  filteredSlashCommands,
  slashPopoverStyle,
  applySlashCommand,
  onDraftInput,
  onCaretInteraction,
  onDraftKeydown
} = useExecutiveSlashCommands(draftValue, toRef(props, 'agentId'));

const handleDraftKeydown = (event: KeyboardEvent): void => {
  onDraftKeydown(event, () => emit('send'));
};
</script>

<template>
  <div class="chat-compose">
    <label class="fc-label" for="founder-message">Message</label>

    <div class="chat-compose-shell">
      <textarea
        id="founder-message"
        ref="composerRef"
        v-model="draftValue"
        class="chat-textarea"
        rows="5"
        placeholder="Ask the executive agent for guidance, or type / for commands like /help, /create-task, /create-project, and /reset …"
        @input="onDraftInput"
        @click="onCaretInteraction"
        @keyup="onCaretInteraction"
        @scroll="onCaretInteraction"
        @keydown="handleDraftKeydown"
      ></textarea>

      <ExecutiveSlashCommandPalette
        v-if="isSlashPopoverVisible"
        class="chat-slash-floating"
        :style="slashPopoverStyle"
        :draft-value="draftValue"
        :commands="filteredSlashCommands"
        :active-index="activeSlashIndex"
        @hover="activeSlashIndex = $event"
        @select="applySlashCommand"
      />
    </div>

    <div class="chat-compose-footer">
      <p class="chat-compose-hint">
        <CornerDownLeft :size="13" />
        <span><strong>Enter</strong> send · <strong>Shift + Enter</strong> newline · Type <code>/</code> to open command</span>
      </p>

      <FcButton
        variant="primary"
        class="chat-send-button"
        :disabled="props.isSending || props.isStreaming || props.connectionState !== 'connected' || !draftValue.trim()"
        @click="emit('send')"
      >
        <Send :size="14" />
        {{ props.isStreaming ? 'Streaming…' : props.isSending ? 'Sending…' : 'Send' }}
      </FcButton>
    </div>
  </div>
</template>

<style scoped>
.chat-compose {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-compose-shell {
  position: relative;
}

.chat-textarea {
  width: 100%;
  min-height: 128px;
  resize: vertical;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--fc-primary) 14%, var(--fc-border-subtle));
  padding: 12px 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--fc-surface) 92%, white 8%), var(--fc-surface));
  color: var(--fc-text-main);
  box-shadow: 0 14px 28px -24px rgba(15, 23, 42, 0.45);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.chat-textarea:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--fc-primary) 48%, var(--fc-border-subtle));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fc-primary) 12%, transparent), 0 18px 36px -28px rgba(59, 130, 246, 0.45);
}

.chat-slash-floating {
  position: absolute;
  z-index: 30;
}

.chat-compose-footer {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}

.chat-compose-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.chat-compose-hint code {
  font-size: 0.72rem;
}

.chat-send-button {
  flex-shrink: 0;
}

@media (max-width: 980px) {
  .chat-compose-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
