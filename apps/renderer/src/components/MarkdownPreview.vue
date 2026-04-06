<script setup lang="ts">
import { computed } from 'vue';

import { renderMarkdown } from '../utils/markdown';

const props = withDefaults(defineProps<{
  source: string;
  emptyText?: string;
  compact?: boolean;
}>(), {
  emptyText: 'Nothing to preview yet.',
  compact: false
});

const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <div
    v-if="html"
    class="fc-markdown prose prose-sm max-w-none prose-headings:text-[color:var(--fc-text-main)] prose-p:text-[color:var(--fc-text-main)] prose-strong:text-[color:var(--fc-text-main)] prose-a:text-[color:var(--fc-primary)] prose-code:text-[color:var(--fc-text-main)] prose-pre:border prose-pre:border-[color:var(--fc-border-subtle)] prose-pre:bg-[color:color-mix(in_srgb,var(--fc-surface-muted)_80%,var(--fc-surface))] prose-th:text-[color:var(--fc-text-main)] prose-td:text-[color:var(--fc-text-main)] prose-blockquote:text-[color:var(--fc-text-muted)] prose-blockquote:border-[color:var(--fc-primary)]"
    :class="{ 'fc-markdown-compact': props.compact }"
    v-html="html"
  />
  <p v-else class="fc-markdown-empty">{{ props.emptyText }}</p>
</template>

<style scoped>
.fc-markdown {
  color: var(--fc-text-main);
  line-height: 1.6;
  word-break: break-word;
}

.fc-markdown-compact {
  max-height: 7rem;
  overflow: hidden;
}

.fc-markdown-empty {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.82rem;
}

.fc-markdown :deep(img) {
  border-radius: 10px;
  border: 1px solid var(--fc-border-subtle);
}

.fc-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.fc-markdown :deep(th),
.fc-markdown :deep(td) {
  border: 1px solid var(--fc-border-subtle);
  padding: 0.5rem 0.65rem;
}

.fc-markdown :deep(th) {
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}
</style>
