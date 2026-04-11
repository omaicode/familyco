<script setup lang="ts">
import { ArrowRight, Bot, LoaderCircle, PlugZap, RefreshCw, ShieldCheck, Wrench } from 'lucide-vue-next';

import ExecutiveChatComposer from '../components/agents/ExecutiveChatComposer.vue';
import ExecutiveChatThread from '../components/agents/ExecutiveChatThread.vue';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcSelect from '../components/FcSelect.vue';
import SkeletonList from '../components/SkeletonList.vue';
import { useExecutiveChat } from '../composables/useExecutiveChat';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

  const {
    thread,
    selectedAgentId,
    draftMessage,
    draftAttachments,
    isLoading,
    isRefreshing,
    isLoadingOlder,
    hasMoreHistory,
    isSending,
    isStreaming,
    isCancelling,
    isUploadingAttachments,
    connectionState,
    connectionLabel,
    feedback,
    executiveAgents,
    selectedAgent,
    reload,
    loadOlderMessages,
    uploadAttachments,
    removeDraftAttachment,
    sendMessage,
    cancelMessage,
    sendConfirmOption
  } = useExecutiveChat();
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Chat') }}</h3>
        <p>{{ t('Talk to your agents over a live socket stream. It can reply immediately and call tools when you explicitly need a task or project.') }}</p>
      </div>
      <div class="fc-inline-actions">
        <FcButton variant="secondary" :disabled="isRefreshing" @click="reload">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          {{ isRefreshing ? t('Refreshing…') : t('Refresh') }}
        </FcButton>
      </div>
    </div>

    <Transition name="fc-banner">
      <FcBanner
        v-if="feedback"
        :type="feedback.type"
        closable
        style="margin-bottom: 14px;"
        @close="feedback = null"
      >
        {{ feedback.text }}
      </FcBanner>
    </Transition>

    <div class="chat-layout">
      <div>
        <FcCard style="margin-bottom: 14px;">
          <div class="chat-toolbar">
            <div>
              <p class="chat-caption">{{ t('Primary interaction lane') }}</p>
              <div class="chat-status-pill" :data-state="connectionState">
                <component :is="connectionState === 'connecting' ? LoaderCircle : PlugZap" :size="13" :class="{ 'fc-spin': connectionState === 'connecting' }" />
                <span>{{ t('Socket status', { label: connectionLabel }) }}</span>
              </div>
            </div>

            <div class="chat-select-wrap">
              <label class="fc-label" for="chat-agent">{{ t('Executive agent') }}</label>
              <FcSelect id="chat-agent" v-model="selectedAgentId" :disabled="executiveAgents.length <= 1">
                <option v-for="agent in executiveAgents" :key="agent.id" :value="agent.id">
                  {{ agent.name }} · {{ agent.role }}
                </option>
              </FcSelect>
            </div>
          </div>

          <div v-if="isLoading" class="fc-loading">
            <p style="margin: 0 0 12px; color: var(--fc-text-muted); font-size: 0.875rem;">{{ t('Loading conversation…') }}</p>
            <SkeletonList />
          </div>

          <div v-else-if="!selectedAgent" class="fc-empty">
            <Bot :size="34" class="fc-empty-icon" />
            <h4>{{ t('No executive agent yet') }}</h4>
            <p>{{ t('Complete setup first so FamilyCo can route founder requests through the L0 layer.') }}</p>
            <RouterLink to="/setup" class="fc-btn-primary">{{ t('Open setup') }}</RouterLink>
          </div>

          <template v-else>
            <ExecutiveChatThread
              :thread="thread"
              :selected-agent-name="selectedAgent.name"
              :selected-agent-id="selectedAgent.id"
              :is-streaming="isStreaming"
              :is-loading-older="isLoadingOlder"
              :has-more-history="hasMoreHistory"
              :on-select-option="sendConfirmOption"
              @load-older="loadOlderMessages"
            />
            <ExecutiveChatComposer
              v-model="draftMessage"
              :agent-id="selectedAgent?.id ?? ''"
              :attachments="draftAttachments"
              :connection-state="connectionState"
              :is-sending="isSending"
              :is-streaming="isStreaming"
              :is-cancelling="isCancelling"
              :is-uploading-attachments="isUploadingAttachments"
              @pick-attachments="uploadAttachments"
              @remove-attachment="removeDraftAttachment"
              @send="sendMessage"
              @cancel="cancelMessage"
            />
          </template>
        </FcCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fc-spin {
  animation: fc-rotate 0.8s linear infinite;
}

@keyframes fc-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.chat-toolbar {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: end;
  margin-bottom: 14px;
}

.chat-caption {
  margin: 0 0 4px;
  color: var(--fc-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chat-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid var(--fc-border-subtle);
  padding: 4px 8px;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.chat-status-pill[data-state='connected'] {
  color: var(--fc-success);
  border-color: color-mix(in srgb, var(--fc-success) 35%, var(--fc-border-subtle));
}

.chat-status-pill[data-state='connecting'] {
  color: var(--fc-info);
  border-color: color-mix(in srgb, var(--fc-info) 35%, var(--fc-border-subtle));
}

.chat-select-wrap {
  min-width: 240px;
}

.chat-side-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 300px;
  justify-self: end;
}

.chat-side-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-side-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--fc-text-muted);
  line-height: 1.45;
  font-size: 0.82rem;
}

@media (max-width: 980px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }

  .chat-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .chat-select-wrap {
    min-width: 0;
  }

  .chat-side-column {
    max-width: none;
    justify-self: stretch;
  }
}
</style>
