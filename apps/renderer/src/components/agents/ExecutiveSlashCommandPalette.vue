<script setup lang="ts">
import { Command } from 'lucide-vue-next';

import type { SlashCommandSuggestion } from '../../composables/useExecutiveSlashCommands';

const props = defineProps<{
  draftValue: string;
  commands: SlashCommandSuggestion[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  (event: 'hover', index: number): void;
  (event: 'select', command: SlashCommandSuggestion): void;
}>();
</script>

<template>
  <div class="chat-slash-panel">
    <div class="chat-slash-header">
      <span class="chat-slash-title">
        <Command :size="12" />
        Commands
      </span>
      <span class="chat-slash-count">{{ props.commands.length }}</span>
    </div>

    <div v-if="props.commands.length > 0" class="chat-slash-list">
      <button
        v-for="(command, index) in props.commands"
        :key="command.command"
        type="button"
        class="chat-slash-item"
        :data-active="index === props.activeIndex"
        @mouseenter="emit('hover', index)"
        @mousedown.prevent="emit('select', command)"
      >
        <div class="chat-slash-item-top">
          <code>{{ command.command }}</code>
          <span>{{ command.label }}</span>
        </div>
        <p>{{ command.description }}</p>
      </button>
    </div>

    <p v-else class="chat-slash-empty">
      No commands match <code>{{ props.draftValue.trim() }}</code>. Try <code>/help</code> or <code>/create-task</code>.
    </p>
  </div>
</template>

<style scoped>
.chat-slash-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--fc-primary) 24%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-surface) 92%, white 8%);
  box-shadow: 0 20px 40px -28px rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(10px);
}

.chat-slash-header {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

.chat-slash-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fc-text-main);
}

.chat-slash-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fc-primary) 12%, transparent);
  color: var(--fc-primary);
  font-size: 0.72rem;
  font-weight: 700;
}

.chat-slash-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-slash-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  text-align: left;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fc-text-main);
  padding: 8px 9px;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.chat-slash-item:hover,
.chat-slash-item[data-active='true'] {
  border-color: color-mix(in srgb, var(--fc-primary) 32%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 7%, var(--fc-surface));
  transform: translateY(-1px);
}

.chat-slash-item-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
}

.chat-slash-item code {
  font-size: 0.72rem;
}

.chat-slash-item p,
.chat-slash-empty {
  margin: 0;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
  line-height: 1.45;
}

.chat-slash-empty {
  padding: 4px;
}
</style>
