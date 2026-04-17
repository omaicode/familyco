<script setup lang="ts">
import { MessagesSquare } from 'lucide-vue-next';

import { useI18n } from '../../composables/useI18n';

const { t } = useI18n();
</script>

<template>
  <div class="chat-empty-state">
    <MessagesSquare :size="26" />
    <div>
      <p class="chat-empty-title">{{ t('chat.empty.title') }}</p>
      <p class="chat-empty-copy">{{ t('chat.empty.copy') }}</p>
    </div>
  </div>
</template>

<style scoped>
.chat-empty-state {
  display: flex;
  flex: 1;
  gap: 10px;
  align-items: center;
  justify-content: center;
  padding: 14px;
  min-height: 100%;
  border-radius: 12px;
  background: var(--fc-surface-muted);
  color: var(--fc-text-muted);
  text-align: center;
}

.chat-empty-title {
  margin: 0 0 4px;
  font-weight: 600;
  color: var(--fc-text-main);
}

.chat-empty-copy {
  margin: 0;
  line-height: 1.5;
}
</style>
