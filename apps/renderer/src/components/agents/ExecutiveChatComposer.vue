<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Send, Sparkles } from 'lucide-vue-next';

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

    <div v-if="isSlashMode" class="chat-slash-panel">
      <div class="chat-slash-header">
        <div>
          <p class="chat-slash-title">Slash commands</p>
          <p class="chat-slash-copy">Type to filter, then use ↑ ↓ and Enter or Tab to insert quickly.</p>
        </div>
        <span class="chat-slash-count">{{ filteredSlashCommands.length }} match<span v-if="filteredSlashCommands.length !== 1">es</span></span>
      </div>

      <div v-if="filteredSlashCommands.length > 0" class="chat-slash-list">
        <button
          v-for="(command, index) in filteredSlashCommands"
          :key="command.command"
          type="button"
          class="chat-slash-item"
          :data-active="index === activeSlashIndex"
          @mouseenter="activeSlashIndex = index"
          @mousedown.prevent="applySlashCommand(command)"
        >
          <div class="chat-slash-item-top">
            <code>{{ command.command }}</code>
            <span>{{ command.label }}</span>
          </div>
          <p>{{ command.description }}</p>
        </button>
      </div>

      <p v-else class="chat-slash-empty">
        No commands match <code>{{ draftValue.trim() }}</code>. Try <code>/help</code> or <code>/create-task</code>.
      </p>
    </div>

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

.chat-slash-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--fc-primary) 22%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
}

.chat-slash-header {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: flex-start;
}

.chat-slash-title {
  margin: 0 0 2px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.chat-slash-copy,
.chat-slash-empty {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.chat-slash-count {
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.chat-slash-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-slash-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  text-align: left;
  border-radius: 10px;
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
  color: var(--fc-text-main);
  padding: 8px 10px;
  cursor: pointer;
}

.chat-slash-item[data-active='true'] {
  border-color: color-mix(in srgb, var(--fc-primary) 40%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 8%, var(--fc-surface));
}

.chat-slash-item-top {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 600;
}

.chat-slash-item p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
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
