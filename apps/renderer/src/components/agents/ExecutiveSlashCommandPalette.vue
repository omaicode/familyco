<script setup lang="ts">
interface SlashCommandSuggestion {
  command: string;
  label: string;
  description: string;
  insertValue: string;
}

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
      <div>
        <p class="chat-slash-title">Slash commands</p>
        <p class="chat-slash-copy">Type to filter, then use ↑ ↓ and Enter or Tab to insert quickly.</p>
      </div>
      <span class="chat-slash-count">{{ props.commands.length }} match<span v-if="props.commands.length !== 1">es</span></span>
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
</style>
