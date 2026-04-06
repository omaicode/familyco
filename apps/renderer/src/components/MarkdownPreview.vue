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
    class="fc-markdown"
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

.fc-markdown :deep(*) {
  margin-top: 0;
}

.fc-markdown :deep(p),
.fc-markdown :deep(ul),
.fc-markdown :deep(ol),
.fc-markdown :deep(blockquote),
.fc-markdown :deep(pre) {
  margin: 0 0 0.75rem;
}

.fc-markdown :deep(ul),
.fc-markdown :deep(ol) {
  padding-left: 1.1rem;
}

.fc-markdown :deep(li + li) {
  margin-top: 0.2rem;
}

.fc-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.85em;
  background: color-mix(in srgb, var(--fc-surface-muted) 70%, var(--fc-surface));
  border-radius: 6px;
  padding: 0.1rem 0.35rem;
}

.fc-markdown :deep(pre) {
  overflow-x: auto;
  padding: 0.75rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--fc-surface-muted) 80%, var(--fc-surface));
  border: 1px solid var(--fc-border-subtle);
}

.fc-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
}

.fc-markdown :deep(blockquote) {
  border-left: 3px solid var(--fc-primary);
  padding-left: 0.75rem;
  color: var(--fc-text-muted);
}

.fc-markdown :deep(a) {
  color: var(--fc-primary);
  text-decoration: underline;
}
</style>
