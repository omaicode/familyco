<script setup lang="ts">
import { computed, toRef } from 'vue';
import { CornerDownLeft, Send } from 'lucide-vue-next';

import { useExecutiveSlashCommands } from '../../composables/useExecutiveSlashCommands';
import { useI18n } from '../../composables/useI18n';
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
const { t } = useI18n();

const {
  isSlashMode,
  slashSuggestion,
  applySlashSuggestion,
  onDraftKeydown
} = useExecutiveSlashCommands(draftValue, toRef(props, 'agentId'));

const handleDraftKeydown = (event: KeyboardEvent): void => {
  onDraftKeydown(event, () => emit('send'));
};
</script>

<template>
  <div class="chat-compose">
    <label class="fc-label" for="founder-message">{{ t('Message') }}</label>

    <div class="chat-compose-shell">
      <textarea
        id="founder-message"
        v-model="draftValue"
        class="chat-textarea"
        rows="5"
        :placeholder="t('chat.composer.placeholder.inline-slash')"
        @keydown="handleDraftKeydown"
      ></textarea>
    </div>

    <p v-if="isSlashMode && slashSuggestion" class="chat-inline-suggestion" @mousedown.prevent="applySlashSuggestion">
      <span>{{ t('chat.composer.suggest.prefix') }}</span>
      <code>{{ slashSuggestion }}</code>
      <span class="chat-inline-suggestion-meta">{{ t('chat.composer.suggest.accept') }}</span>
    </p>

    <div class="chat-compose-footer">
      <p class="chat-compose-hint">
        <CornerDownLeft :size="13" />
        <span>{{ t('chat.composer.hint.inline-slash') }}</span>
      </p>

      <FcButton
        variant="primary"
        class="chat-send-button"
        :disabled="props.isSending || props.isStreaming || props.connectionState !== 'connected' || !draftValue.trim()"
        @click="emit('send')"
      >
        <Send :size="14" />
        {{ props.isStreaming ? t('Streaming…') : props.isSending ? t('Sending…') : t('Send') }}
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

.chat-inline-suggestion {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: -2px 0 2px;
  font-size: 0.76rem;
  color: var(--fc-text-muted);
  user-select: none;
}

.chat-inline-suggestion code {
  font-size: 0.72rem;
  color: var(--fc-text-main);
}

.chat-inline-suggestion-meta {
  color: var(--fc-text-faint);
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
