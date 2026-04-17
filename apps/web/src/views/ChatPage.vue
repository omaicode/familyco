<script setup lang="ts">
import { Bot, LoaderCircle, PanelLeftClose, PanelLeftOpen, PlugZap, RefreshCw } from 'lucide-vue-next';

import ExecutiveChatComposer from '../components/agents/ExecutiveChatComposer.vue';
import ExecutiveChatSessionsSidebar from '../components/agents/ExecutiveChatSessionsSidebar.vue';
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
  sessions,
  selectedAgentId,
  selectedSessionId,
  isSessionSidebarOpen,
  draftMessage,
  draftAttachments,
  editingMessage,
  isLoading,
  isLoadingSessions,
  isCreatingSession,
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
  createNewSession,
  toggleSessionSidebar,
  selectSession,
  loadOlderMessages,
  uploadAttachments,
  removeDraftAttachment,
  startEditingMessage,
  cancelEditing,
  sendMessage,
  cancelMessage,
  sendConfirmOption
} = useExecutiveChat();
</script>

<template>
  <section class="chat-page">
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
      <div class="chat-layout-panel">
        <FcCard class="chat-card">
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

            <FcButton v-if="!isSessionSidebarOpen" variant="secondary" size="sm" @click="toggleSessionSidebar">
              <component :is="isSessionSidebarOpen ? PanelLeftClose : PanelLeftOpen" :size="14" />
              {{ isSessionSidebarOpen ? t('chat.session.hideSidebar') : t('chat.session.showSidebar') }}
            </FcButton>
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
            <div class="chat-shell" :class="{ 'chat-shell--with-sidebar': isSessionSidebarOpen }">
              <ExecutiveChatSessionsSidebar
                v-if="isSessionSidebarOpen"
                :sessions="sessions"
                :selected-session-id="selectedSessionId"
                :is-loading="isLoadingSessions"
                :is-creating="isCreatingSession"
                :show-hide-action="isSessionSidebarOpen"
                @create="createNewSession"
                @toggle-sidebar="toggleSessionSidebar"
                @select="selectSession"
              />

              <div class="chat-main">
                <ExecutiveChatThread
                  :thread="thread"
                  :selected-agent-name="selectedAgent.name"
                  :selected-agent-id="selectedAgent.id"
                  :is-streaming="isStreaming"
                  :is-loading-older="isLoadingOlder"
                  :has-more-history="hasMoreHistory"
                  :on-select-option="sendConfirmOption"
                  :on-edit-message="startEditingMessage"
                  @load-older="loadOlderMessages"
                />
                <ExecutiveChatComposer
                  v-model="draftMessage"
                  :agent-id="selectedAgent?.id ?? ''"
                  :attachments="draftAttachments"
                  :editing-preview="editingMessage?.body"
                  :connection-state="connectionState"
                  :is-sending="isSending"
                  :is-streaming="isStreaming"
                  :is-cancelling="isCancelling"
                  :is-uploading-attachments="isUploadingAttachments"
                  @pick-attachments="uploadAttachments"
                  @remove-attachment="removeDraftAttachment"
                  @send="sendMessage"
                  @cancel="cancelMessage"
                  @cancel-edit="cancelEditing"
                />
              </div>
            </div>
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
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--fc-topbar-height) - 2rem);
  min-height: calc(100dvh - var(--fc-topbar-height) - 2rem);
  overflow: hidden;
}

.chat-layout-panel {
  min-height: 0;
}

.chat-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
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

.chat-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  flex: 1;
  height: 100%;
  min-height: 0;
}

.chat-shell--with-sidebar {
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
}

.chat-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
}

:deep(.chat-sessions) {
  min-height: 0;
}

:deep(.chat-thread) {
  flex: 1;
  min-height: 0;
}

:deep(.chat-thread-scroll) {
  flex: 1;
  min-height: 0;
  max-height: none;
}

:deep(.chat-compose) {
  flex-shrink: 0;
}

:deep(.fc-card) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 980px) {
  .chat-page {
    height: auto;
    min-height: auto;
    overflow: visible;
  }

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

  .chat-shell,
  .chat-shell--with-sidebar {
    grid-template-columns: 1fr;
  }
}
</style>
