<script setup lang="ts">
import { computed } from 'vue';

import { type AgentChatSession } from '@familyco/ui';

import { useI18n } from '../../composables/useI18n';
import FcButton from '../FcButton.vue';

const props = defineProps<{
  sessions: AgentChatSession[];
  selectedSessionId: string;
  isLoading: boolean;
  isCreating: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', sessionId: string): void;
  (event: 'create'): void;
}>();

const { t } = useI18n();

const visibleSessions = computed(() => props.sessions.slice(0, 30));

const formatTimestamp = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString();
};

const readSessionTitle = (session: AgentChatSession): string => {
  const trimmed = session.title.trim();
  return trimmed.length > 0 ? trimmed : t('chat.session.untitled');
};
</script>

<template>
  <aside class="chat-sessions">
    <header class="chat-sessions-header">
      <div>
        <h4>{{ t('chat.session.title') }}</h4>
        <p>{{ t('chat.session.subtitle') }}</p>
      </div>
      <FcButton
        variant="secondary"
        size="sm"
        :disabled="isCreating"
        @click="emit('create')"
      >
        {{ isCreating ? t('chat.session.creating') : t('chat.session.new') }}
      </FcButton>
    </header>

    <div v-if="isLoading" class="chat-sessions-empty">
      {{ t('chat.session.loading') }}
    </div>

    <div v-else-if="visibleSessions.length === 0" class="chat-sessions-empty">
      {{ t('chat.session.empty') }}
    </div>

    <ul v-else class="chat-sessions-list">
      <li v-for="session in visibleSessions" :key="session.id">
        <button
          class="chat-session-item"
          type="button"
          :class="{ 'is-active': session.id === selectedSessionId }"
          @click="emit('select', session.id)"
        >
          <strong>{{ readSessionTitle(session) }}</strong>
          <span>{{ formatTimestamp(session.lastMessageAt) }}</span>
        </button>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.chat-sessions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-right: 1px solid var(--fc-border-subtle);
  padding-right: 12px;
  min-width: 250px;
  max-width: 300px;
}

.chat-sessions-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.chat-sessions-header h4 {
  margin: 0;
  font-size: 0.95rem;
}

.chat-sessions-header p {
  margin: 2px 0 0;
  color: var(--fc-text-muted);
  font-size: 0.76rem;
}

.chat-sessions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 64vh;
  overflow-y: auto;
}

.chat-session-item {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border: 1px solid var(--fc-border-subtle);
  background: color-mix(in srgb, var(--fc-surface) 82%, transparent);
  border-radius: 10px;
  padding: 8px 10px;
  color: var(--fc-text);
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.chat-session-item strong {
  font-size: 0.83rem;
  line-height: 1.4;
}

.chat-session-item span {
  color: var(--fc-text-muted);
  font-size: 0.72rem;
}

.chat-session-item:hover {
  border-color: color-mix(in srgb, var(--fc-info) 40%, var(--fc-border-subtle));
  transform: translateY(-1px);
}

.chat-session-item.is-active {
  border-color: color-mix(in srgb, var(--fc-info) 55%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
}

.chat-sessions-empty {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px;
  color: var(--fc-text-muted);
  font-size: 0.82rem;
}

@media (max-width: 980px) {
  .chat-sessions {
    min-width: 0;
    max-width: none;
    border-right: none;
    border-bottom: 1px solid var(--fc-border-subtle);
    padding-right: 0;
    padding-bottom: 10px;
  }

  .chat-sessions-list {
    max-height: 220px;
  }
}
</style>
