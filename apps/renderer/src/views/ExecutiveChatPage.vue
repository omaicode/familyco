<script setup lang="ts">
import type { AgentChatMessage } from '@familyco/ui';
import { computed, ref, watch } from 'vue';
import { ArrowRight, Bot, MessagesSquare, RefreshCw, Send, ShieldCheck, Sparkles } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcSelect from '../components/FcSelect.vue';
import SkeletonList from '../components/SkeletonList.vue';

const thread = ref<AgentChatMessage[]>([]);
const selectedAgentId = ref('');
const draftMessage = ref('');
const isLoading = ref(false);
const isRefreshing = ref(false);
const isSending = ref(false);
const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

const promptSuggestions = [
  'Review the current backlog and propose a recovery plan for delayed tasks.',
  'Set up a PM-focused agent proposal for project management support.',
  'Summarize the top blockers this week and tell me what needs approval.'
];

const agentState = computed(() => uiRuntime.stores.agents.state.agents);
const executiveAgents = computed(() =>
  agentState.value.data.filter((agent) => agent.level === 'L0' && agent.status !== 'archived')
);
const selectedAgent = computed(
  () => executiveAgents.value.find((agent) => agent.id === selectedAgentId.value) ?? executiveAgents.value[0] ?? null
);

watch(
  executiveAgents,
  (nextAgents) => {
    if (!nextAgents.length) {
      selectedAgentId.value = '';
      return;
    }

    if (!selectedAgentId.value || !nextAgents.some((agent) => agent.id === selectedAgentId.value)) {
      selectedAgentId.value = nextAgents[0].id;
    }
  },
  { immediate: true }
);

const setFeedback = (type: 'success' | 'error' | 'info', text: string): void => {
  feedback.value = { type, text };
  setTimeout(() => {
    if (feedback.value?.text === text) {
      feedback.value = null;
    }
  }, 4000);
};

const sortThread = (messages: AgentChatMessage[]): AgentChatMessage[] =>
  [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

const reload = async (): Promise<void> => {
  isLoading.value = true;
  isRefreshing.value = true;

  try {
    await uiRuntime.stores.agents.loadAgents();
    if (selectedAgentId.value) {
      thread.value = sortThread(await uiRuntime.api.getAgentChat(selectedAgentId.value));
    } else {
      thread.value = [];
    }
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to load the executive thread');
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
};

const applyPrompt = (prompt: string): void => {
  draftMessage.value = prompt;
};

const sendMessage = async (): Promise<void> => {
  if (!selectedAgent.value || !draftMessage.value.trim()) {
    return;
  }

  isSending.value = true;

  try {
    const result = await uiRuntime.api.sendAgentChat({
      agentId: selectedAgent.value.id,
      message: draftMessage.value.trim()
    });

    thread.value = sortThread([...thread.value, result.founderMessage, result.replyMessage]);
    draftMessage.value = '';

    if (result.approvalRequest?.id) {
      setFeedback('info', `Approval request ${result.approvalRequest.id} is now waiting in Inbox.`);
    } else if (result.task?.id) {
      setFeedback('success', `Task “${result.task.title}” is now pending under ${selectedAgent.value.name}.`);
    } else {
      setFeedback('success', 'Message delivered to the executive thread.');
    }
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to send the message');
  } finally {
    isSending.value = false;
  }
};

useAutoReload(reload);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Executive Chat</h3>
        <p>Talk directly with your L0 agent. It can turn requests into tracked tasks or agent proposals.</p>
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
              <h4 style="margin: 0;">Founder → L0 chat</h4>
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
            <div class="chat-thread">
              <div v-if="thread.length === 0" class="chat-empty-state">
                <MessagesSquare :size="26" />
                <div>
                  <p class="chat-empty-title">Start the first conversation</p>
                  <p class="chat-empty-copy">Use chat for planning, follow-ups, and new agent proposals. Use Tasks when you need explicit delivery tracking.</p>
                </div>
              </div>

              <article
                v-for="message in thread"
                :key="message.id"
                class="chat-bubble"
                :class="message.direction"
              >
                <div class="chat-bubble-meta">
                  <span>{{ message.direction === 'founder_to_agent' ? 'Founder' : selectedAgent.name }}</span>
                  <span>{{ new Date(message.createdAt).toLocaleString() }}</span>
                </div>
                <p class="chat-bubble-title">{{ message.title }}</p>
                <p class="chat-bubble-body">{{ message.body }}</p>
              </article>
            </div>

            <div class="chat-compose">
              <label class="fc-label" for="founder-message">Message</label>
              <textarea
                id="founder-message"
                v-model="draftMessage"
                class="chat-textarea"
                rows="5"
                placeholder="Ask the executive agent to review blockers, make a plan, or propose a new department agent…"
              ></textarea>

              <div class="chat-compose-actions">
                <div class="chat-suggestions">
                  <button
                    v-for="prompt in promptSuggestions"
                    :key="prompt"
                    type="button"
                    class="chat-suggestion-chip"
                    @click="applyPrompt(prompt)"
                  >
                    <Sparkles :size="12" />
                    {{ prompt }}
                  </button>
                </div>

                <FcButton variant="primary" :disabled="isSending || !draftMessage.trim()" @click="sendMessage">
                  <Send :size="14" />
                  {{ isSending ? 'Sending…' : 'Send to executive' }}
                </FcButton>
              </div>
            </div>
          </template>
        </FcCard>
      </div>

      <div class="chat-side-column">
        <FcCard>
          <div class="fc-section-header">
            <div>
              <h4>How this lane works</h4>
              <p class="fc-card-desc">The system should run with one L0 by default; extra agents are optional and approval-gated.</p>
            </div>
          </div>

          <div class="chat-side-list">
            <div class="chat-side-item">
              <ArrowRight :size="15" />
              <span>Use <strong>Chat</strong> for discussion, planning, and asking the executive agent to organize work.</span>
            </div>
            <div class="chat-side-item">
              <ShieldCheck :size="15" />
              <span>Use <strong>Inbox</strong> to approve any proposed new agent before it is actually created.</span>
            </div>
            <div class="chat-side-item">
              <Bot :size="15" />
              <span>Only the L0 executive agent should recommend new L1/L2 roles such as PM, Ops, or Research.</span>
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

.chat-select-wrap {
  min-width: 240px;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
  min-height: 220px;
}

.chat-empty-state {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 12px;
  background: var(--fc-surface-muted);
  color: var(--fc-text-muted);
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

.chat-bubble {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--fc-surface);
}

.chat-bubble.agent_to_founder {
  border-color: color-mix(in srgb, var(--fc-primary) 28%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface));
}

.chat-bubble-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  margin-bottom: 6px;
}

.chat-bubble-title {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.chat-bubble-body {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}

.chat-compose {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid var(--fc-border-subtle);
  padding: 10px 12px;
  background: var(--fc-surface);
  color: var(--fc-text-main);
}

.chat-compose-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
}

.chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface-muted);
  color: var(--fc-text-main);
  padding: 6px 10px;
  font-size: 0.75rem;
  cursor: pointer;
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

  .chat-toolbar,
  .chat-compose-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .chat-select-wrap {
    min-width: 0;
  }
}
</style>
