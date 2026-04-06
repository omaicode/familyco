<script setup lang="ts">
import { ref } from 'vue';
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
      <p class="markdown-editor-hint">Supports <code>**bold**</code>, lists, headings, links, and code blocks.</p>
    </div>

    <textarea
      v-if="mode === 'write'"
      :value="props.modelValue"
      class="fc-textarea markdown-editor-input"
      :placeholder="props.placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
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
</style>
