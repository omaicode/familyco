<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Send, Sparkles } from 'lucide-vue-next';

import ExecutiveSlashCommandPalette from './ExecutiveSlashCommandPalette.vue';
import FcButton from '../FcButton.vue';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

interface SlashCommandSuggestion {
  command: string;
  label: string;
  description: string;
  insertValue: string;
}

const props = defineProps<{
  modelValue: string;
  connectionState: ConnectionState;
  isSending: boolean;
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'send'): void;
}>();

const composerRef = ref<HTMLTextAreaElement | null>(null);
const activeSlashIndex = ref(0);

const promptSuggestions = [
  '/help',
  '/create-task Follow up on onboarding improvements for the executive queue',
  '/create-project Launch the Q2 operating cadence workspace',
  '/reset'
];

const slashCommandCatalog: SlashCommandSuggestion[] = [
  {
    command: '/help',
    label: 'Show help',
    description: 'List the available chat commands and how to use them.',
    insertValue: '/help'
  },
  {
    command: '/create-task',
    label: 'Create a task',
    description: 'Open a new task directly from the executive chat lane.',
    insertValue: '/create-task '
  },
  {
    command: '/create-project',
    label: 'Create a project',
    description: 'Spin up a new project workspace from a short description.',
    insertValue: '/create-project '
  },
  {
    command: '/reset',
    label: 'Start fresh',
    description: 'Clear the current conversation history and working memory.',
    insertValue: '/reset'
  }
];

const draftValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
});
const slashDraft = computed(() => draftValue.value.trimStart());
const isSlashMode = computed(() => slashDraft.value.startsWith('/'));
const filteredSlashCommands = computed(() => {
  if (!isSlashMode.value) {
    return [];
  }

  const normalized = slashDraft.value.toLowerCase();
  const query = normalized.replace(/^\//, '');

  return slashCommandCatalog.filter((command) => {
    return command.command.includes(normalized)
      || command.label.toLowerCase().includes(query)
      || command.description.toLowerCase().includes(query);
  });
});

watch(filteredSlashCommands, (nextCommands) => {
  if (nextCommands.length === 0) {
    activeSlashIndex.value = 0;
    return;
  }

  if (activeSlashIndex.value > nextCommands.length - 1) {
    activeSlashIndex.value = 0;
  }
});

watch(draftValue, (nextMessage) => {
  if (!nextMessage.trimStart().startsWith('/')) {
    activeSlashIndex.value = 0;
  }
});

const applyPrompt = async (prompt: string): Promise<void> => {
  draftValue.value = prompt;
  await focusComposer();
};

const applySlashCommand = async (command: SlashCommandSuggestion): Promise<void> => {
  draftValue.value = command.insertValue;
  activeSlashIndex.value = 0;
  await focusComposer();
};

const draftMatchesKnownCommand = (): boolean => {
  const normalized = draftValue.value.trim();
  return slashCommandCatalog.some((command) => {
    return normalized === command.command || normalized.startsWith(`${command.command} `);
  });
};

const focusComposer = async (): Promise<void> => {
  await nextTick();
  composerRef.value?.focus();
};

const onDraftKeydown = (event: KeyboardEvent): void => {
  if (isSlashMode.value && filteredSlashCommands.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeSlashIndex.value = (activeSlashIndex.value + 1) % filteredSlashCommands.value.length;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeSlashIndex.value = activeSlashIndex.value === 0
        ? filteredSlashCommands.value.length - 1
        : activeSlashIndex.value - 1;
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      void applySlashCommand(filteredSlashCommands.value[activeSlashIndex.value]);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && !draftMatchesKnownCommand()) {
      event.preventDefault();
      void applySlashCommand(filteredSlashCommands.value[activeSlashIndex.value]);
      return;
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    emit('send');
  }
};
</script>

<template>
  <div class="chat-compose">
    <label class="fc-label" for="founder-message">Message</label>
    <textarea
      id="founder-message"
      ref="composerRef"
      v-model="draftValue"
      class="chat-textarea"
      rows="5"
      placeholder="Ask the executive agent for guidance, or type / to browse commands like /help, /create-task, /create-project, and /reset …"
      @keydown="onDraftKeydown"
    ></textarea>

    <ExecutiveSlashCommandPalette
      v-if="isSlashMode"
      :draft-value="draftValue"
      :commands="filteredSlashCommands"
      :active-index="activeSlashIndex"
      @hover="activeSlashIndex = $event"
      @select="applySlashCommand"
    />

    <div class="chat-compose-actions">
      <div class="chat-suggestions">
        <button
          v-for="prompt in promptSuggestions"
          :key="prompt"
          type="button"
          class="chat-suggestion-chip"
          @click="applyPrompt(prompt)"
        >
          <Sparkles :size="12" />
          {{ prompt }}
        </button>
      </div>

      <FcButton
        variant="primary"
        :disabled="props.isSending || props.isStreaming || props.connectionState !== 'connected' || !draftValue.trim()"
        @click="emit('send')"
      >
        <Send :size="14" />
        {{ props.isStreaming ? 'Streaming…' : props.isSending ? 'Sending…' : 'Send to executive' }}
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

.chat-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid var(--fc-border-subtle);
  padding: 10px 12px;
  background: var(--fc-surface);
  color: var(--fc-text-main);
}

.chat-compose-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
}

.chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface-muted);
  color: var(--fc-text-main);
  padding: 6px 10px;
  font-size: 0.75rem;
  cursor: pointer;
}

@media (max-width: 980px) {
  .chat-compose-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
