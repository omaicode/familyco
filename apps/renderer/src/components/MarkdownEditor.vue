<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { Eye, PencilLine } from 'lucide-vue-next';

import MarkdownPreview from './MarkdownPreview.vue';

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  previewEmptyText?: string;
}>(), {
  placeholder: 'Write in Markdown…',
  previewEmptyText: 'Start writing to preview the description.'
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const mode = ref<'write' | 'preview'>('write');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const focusRange = (start: number, end: number): void => {
  void nextTick(() => {
    if (!textareaRef.value) {
      return;
    }

    textareaRef.value.focus();
    textareaRef.value.setSelectionRange(start, end);
  });
};

const getSelectionState = () => {
  const current = props.modelValue ?? '';
  const start = textareaRef.value?.selectionStart ?? current.length;
  const end = textareaRef.value?.selectionEnd ?? current.length;
  const selected = current.slice(start, end);

  return { current, start, end, selected };
};

const updateValue = (value: string): void => {
  emit('update:modelValue', value);
};

const applyInline = (prefix: string, suffix: string, placeholder: string): void => {
  const { current, start, end, selected } = getSelectionState();
  const content = selected || placeholder;
  const nextValue = `${current.slice(0, start)}${prefix}${content}${suffix}${current.slice(end)}`;

  updateValue(nextValue);
  focusRange(start + prefix.length, start + prefix.length + content.length);
};

const applyLinePrefix = (prefix: string, placeholder: string): void => {
  const { current, start, end } = getSelectionState();
  const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = current.indexOf('\n', end);
  const safeLineEnd = lineEndIndex === -1 ? current.length : lineEndIndex;
  const selectedBlock = current.slice(lineStart, safeLineEnd);
  const lines = (selectedBlock || placeholder).split('\n');
  const nextBlock = lines.map((line) => `${prefix}${line || placeholder}`).join('\n');
  const nextValue = `${current.slice(0, lineStart)}${nextBlock}${current.slice(safeLineEnd)}`;

  updateValue(nextValue);
  focusRange(lineStart, lineStart + nextBlock.length);
};

const insertSnippet = (snippet: string, cursorOffset?: number): void => {
  const { current, start, end } = getSelectionState();
  const nextValue = `${current.slice(0, start)}${snippet}${current.slice(end)}`;

  updateValue(nextValue);
  const nextCursor = typeof cursorOffset === 'number' ? start + cursorOffset : start + snippet.length;
  focusRange(nextCursor, nextCursor);
};

const insertLink = (): void => {
  applyInline('[', '](https://example.com)', 'link text');
};

const insertCodeBlock = (): void => {
  const { current, start, end, selected } = getSelectionState();
  const content = selected || 'Write details here';
  const prefix = start > 0 && !current.slice(0, start).endsWith('\n') ? '\n' : '';
  const snippet = `${prefix}\`\`\`md\n${content}\n\`\`\`\n`;
  const nextValue = `${current.slice(0, start)}${snippet}${current.slice(end)}`;

  updateValue(nextValue);
  const contentStart = start + prefix.length + 6;
  focusRange(contentStart, contentStart + content.length);
};

const insertDivider = (): void => {
  const { current, start, end } = getSelectionState();
  const prefix = start > 0 && !current.slice(0, start).endsWith('\n') ? '\n' : '';
  const suffix = end < current.length && !current.slice(end).startsWith('\n') ? '\n' : '';
  const snippet = `${prefix}---\n${suffix}`;

  updateValue(`${current.slice(0, start)}${snippet}${current.slice(end)}`);
  focusRange(start + snippet.length, start + snippet.length);
};
</script>

<template>
  <div class="markdown-editor">
    <div class="markdown-editor-header">
      <div class="fc-tabs" role="tablist" aria-label="Markdown editor tabs">
        <button class="fc-tab" :class="{ 'fc-tab-active': mode === 'write' }" @click="mode = 'write'">
          <PencilLine :size="14" />
          Write
        </button>
        <button class="fc-tab" :class="{ 'fc-tab-active': mode === 'preview' }" @click="mode = 'preview'">
          <Eye :size="14" />
          Preview
        </button>
      </div>
      <p class="markdown-editor-hint">Use the toolbar for fast headings, lists, links, quotes, and code blocks.</p>
    </div>

    <div v-if="mode === 'write'" class="markdown-toolbar" role="toolbar" aria-label="Markdown formatting toolbar">
      <div class="markdown-toolbar-group">
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn" title="Heading 1" @mousedown.prevent @click="applyLinePrefix('# ', 'Heading')">H1</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn" title="Heading 2" @mousedown.prevent @click="applyLinePrefix('## ', 'Heading')">H2</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn" title="Heading 3" @mousedown.prevent @click="applyLinePrefix('### ', 'Heading')">H3</button>
      </div>

      <div class="markdown-toolbar-group">
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn" title="Bold" @mousedown.prevent @click="applyInline('**', '**', 'bold text')">B</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn" title="Italic" @mousedown.prevent @click="applyInline('*', '*', 'italic text')">I</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Quote" @mousedown.prevent @click="applyLinePrefix('> ', 'Quoted note')">Quote</button>
      </div>

      <div class="markdown-toolbar-group">
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Bullet list" @mousedown.prevent @click="applyLinePrefix('- ', 'List item')">• List</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Numbered list" @mousedown.prevent @click="applyLinePrefix('1. ', 'First item')">1. List</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Checklist" @mousedown.prevent @click="applyLinePrefix('- [ ] ', 'Checklist item')">Todo</button>
      </div>

      <div class="markdown-toolbar-group">
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Link" @mousedown.prevent @click="insertLink">Link</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Inline code" @mousedown.prevent @click="applyInline('`', '`', 'code')">Code</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Code block" @mousedown.prevent @click="insertCodeBlock">Block</button>
        <button type="button" class="fc-btn-ghost fc-btn-sm markdown-tool-btn markdown-tool-btn-wide" title="Divider" @mousedown.prevent @click="insertDivider">Rule</button>
      </div>
    </div>

    <textarea
      v-if="mode === 'write'"
      ref="textareaRef"
      :value="props.modelValue"
      class="fc-textarea markdown-editor-input"
      :placeholder="props.placeholder"
      @input="updateValue(($event.target as HTMLTextAreaElement).value)"
    />

    <div v-else class="markdown-editor-preview">
      <MarkdownPreview :source="props.modelValue" :empty-text="props.previewEmptyText" />
    </div>
  </div>
</template>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.markdown-editor-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.markdown-editor-hint {
  margin: 0;
  font-size: 0.76rem;
  color: var(--fc-text-muted);
}

.markdown-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: color-mix(in srgb, var(--fc-surface-muted) 45%, var(--fc-surface));
}

.markdown-toolbar-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.markdown-tool-btn {
  min-width: 36px;
  justify-content: center;
}

.markdown-tool-btn-wide {
  min-width: auto;
}

.markdown-editor-input {
  min-height: 168px;
}

.markdown-editor-preview {
  min-height: 168px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: color-mix(in srgb, var(--fc-surface-muted) 35%, var(--fc-surface));
  padding: 12px;
}

@media (max-width: 720px) {
  .markdown-toolbar {
    padding: 6px;
  }

  .markdown-toolbar-group {
    width: 100%;
  }
}
</style>
