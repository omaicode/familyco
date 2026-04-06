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

const {
  thread,
  selectedAgentId,
  draftMessage,
  isLoading,
  isRefreshing,
  isSending,
  isStreaming,
  connectionState,
  connectionLabel,
  feedback,
  executiveAgents,
  selectedAgent,
  reload,
  sendMessage
} = useExecutiveChat();
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Executive Chat</h3>
        <p>Talk to your L0 agent over a live socket stream. It can reply immediately and call tools when you explicitly need a task or project.</p>
      </div>
      <div class="fc-inline-actions">
        <FcButton variant="secondary" :disabled="isRefreshing" @click="reload">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
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
              <p class="chat-caption">Primary interaction lane</p>
              <h4 style="margin: 0 0 6px;">Founder → L0 chat</h4>
              <div class="chat-status-pill" :data-state="connectionState">
                <component :is="connectionState === 'connecting' ? LoaderCircle : PlugZap" :size="13" :class="{ 'fc-spin': connectionState === 'connecting' }" />
                <span>Socket {{ connectionLabel }}</span>
              </div>
            </div>

            <div class="chat-select-wrap">
              <label class="fc-label" for="chat-agent">Executive agent</label>
              <FcSelect id="chat-agent" v-model="selectedAgentId" :disabled="executiveAgents.length <= 1">
                <option v-for="agent in executiveAgents" :key="agent.id" :value="agent.id">
                  {{ agent.name }} · {{ agent.role }}
                </option>
              </FcSelect>
            </div>
          </div>

          <div v-if="isLoading" class="fc-loading">
            <p style="margin: 0 0 12px; color: var(--fc-text-muted); font-size: 0.875rem;">Loading conversation…</p>
            <SkeletonList />
          </div>

          <div v-else-if="!selectedAgent" class="fc-empty">
            <Bot :size="34" class="fc-empty-icon" />
            <h4>No executive agent yet</h4>
            <p>Complete setup first so FamilyCo can route founder requests through the L0 layer.</p>
            <RouterLink to="/setup" class="fc-btn-primary">Open setup</RouterLink>
          </div>

          <template v-else>
            <ExecutiveChatThread :thread="thread" :selected-agent-name="selectedAgent.name" />
            <ExecutiveChatComposer
              v-model="draftMessage"
              :connection-state="connectionState"
              :is-sending="isSending"
              :is-streaming="isStreaming"
              @send="sendMessage"
            />
          </template>
        </FcCard>
      </div>

      <div class="chat-side-column">
        <FcCard>
          <div class="fc-section-header">
            <div>
              <h4>How this lane works</h4>
              <p class="fc-card-desc">One L0 executive is the default operating model. This lane streams live and only creates work when tools are explicitly called.</p>
            </div>
          </div>

          <div class="chat-side-list">
            <div class="chat-side-item">
              <ArrowRight :size="15" />
              <span>Use <strong>Chat</strong> for discussion, planning, and setting direction for the executive agent.</span>
            </div>
            <div class="chat-side-item">
              <Wrench :size="15" />
              <span>Use slash commands like <code>/create-task</code>, <code>/create-project</code>, <code>/reset</code>, and <code>/help</code> for explicit chat actions.</span>
            </div>
            <div class="chat-side-item">
              <ShieldCheck :size="15" />
              <span>Use <strong>Inbox</strong> whenever a separate approval needs founder review.</span>
            </div>
          </div>
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
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
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
  gap: 14px;
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
  line-height: 1.5;
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
}
</style>
