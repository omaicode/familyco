<script setup lang="ts">
import type { AgentChatMessage } from '@familyco/ui';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  ArrowRight,
  Bot,
  LoaderCircle,
  MessagesSquare,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcSelect from '../components/FcSelect.vue';
import SkeletonList from '../components/SkeletonList.vue';

interface ChatSocketEvent {
  type: string;
  payload?: Record<string, unknown>;
}

const thread = ref<AgentChatMessage[]>([]);
const selectedAgentId = ref('');
const draftMessage = ref('');
const isLoading = ref(false);
const isRefreshing = ref(false);
const isSending = ref(false);
const isStreaming = ref(false);
const connectionState = ref<'connecting' | 'connected' | 'disconnected'>('disconnected');
const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
const socket = ref<WebSocket | null>(null);
const activeStreamId = ref<string | null>(null);

const promptSuggestions = [
  'Review the current backlog and outline the next steps for the company this week.',
  'Create a task to follow up on onboarding improvements and keep it in the executive queue.',
  'Open a project for the Q2 operating cadence and summarize what it should cover.'
];

const agentState = computed(() => uiRuntime.stores.agents.state.agents);
const executiveAgents = computed(() =>
  agentState.value.data.filter((agent) => agent.level === 'L0' && agent.status !== 'archived')
);
const selectedAgent = computed(
  () => executiveAgents.value.find((agent) => agent.id === selectedAgentId.value) ?? executiveAgents.value[0] ?? null
);
const connectionLabel = computed(() => {
  if (connectionState.value === 'connected') {
    return 'Connected';
  }

  if (connectionState.value === 'connecting') {
    return 'Connecting…';
  }

  return 'Offline';
});

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

watch(selectedAgentId, () => {
  if (!isLoading.value) {
    connectSocket();
  }
});

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
    await refreshThread();
    connectSocket();
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to load the executive thread');
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
};

const refreshThread = async (): Promise<void> => {
  if (!selectedAgentId.value) {
    thread.value = [];
    return;
  }

  thread.value = sortThread(await uiRuntime.api.getAgentChat(selectedAgentId.value));
};

const applyPrompt = (prompt: string): void => {
  draftMessage.value = prompt;
};

const buildSocketUrl = (agentId: string): string => {
  const baseURL = uiRuntime.stores.app.state.connection.baseURL;
  const url = new URL(`/api/v1/agents/${agentId}/chat/stream`, baseURL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  const runtimeApiKey = window.familycoDesktopConfig?.apiKey?.trim() || import.meta.env.VITE_API_KEY?.trim();
  if (runtimeApiKey) {
    url.searchParams.set('apiKey', runtimeApiKey);
  }

  return url.toString();
};

const closeSocket = (): void => {
  socket.value?.close();
  socket.value = null;
  connectionState.value = 'disconnected';
};

const connectSocket = (): void => {
  if (!selectedAgent.value) {
    closeSocket();
    return;
  }

  const nextUrl = buildSocketUrl(selectedAgent.value.id);
  if (socket.value?.url === nextUrl && connectionState.value !== 'disconnected') {
    return;
  }

  closeSocket();
  connectionState.value = 'connecting';

  const nextSocket = new WebSocket(nextUrl);
  nextSocket.addEventListener('open', () => {
    if (socket.value === nextSocket) {
      connectionState.value = 'connected';
    }
  });
  nextSocket.addEventListener('close', () => {
    if (socket.value === nextSocket) {
      socket.value = null;
      connectionState.value = 'disconnected';
    }
  });
  nextSocket.addEventListener('error', () => {
    if (socket.value === nextSocket) {
      connectionState.value = 'disconnected';
    }
  });
  nextSocket.addEventListener('message', (event) => {
    try {
      handleSocketEvent(JSON.parse(String(event.data)) as ChatSocketEvent);
    } catch {
      setFeedback('error', 'Received an invalid streaming payload from the server.');
    }
  });

  socket.value = nextSocket;
};

const sendMessage = (): void => {
  const message = draftMessage.value.trim();
  if (!selectedAgent.value || message.length === 0) {
    return;
  }

  if (!socket.value || connectionState.value !== 'connected') {
    connectSocket();
    setFeedback('info', 'Reconnecting the executive socket. Send again once it shows connected.');
    return;
  }

  const founderMessage: AgentChatMessage = {
    id: `local-founder-${Date.now()}`,
    senderId: 'founder',
    recipientId: selectedAgent.value.id,
    type: 'info',
    title: buildChatTitle(message),
    body: message,
    createdAt: new Date().toISOString(),
    direction: 'founder_to_agent'
  };

  thread.value = sortThread([...thread.value, founderMessage]);
  socket.value.send(JSON.stringify({ message }));
  draftMessage.value = '';
  isSending.value = true;
};

const handleSocketEvent = (event: ChatSocketEvent): void => {
  if (event.type === 'chat.ready') {
    connectionState.value = 'connected';
    return;
  }

  if (event.type === 'chat.started') {
    const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : `stream-${Date.now()}`;
    activeStreamId.value = requestId;
    isSending.value = false;
    isStreaming.value = true;
    upsertStreamingReply(requestId, '');
    return;
  }

  if (event.type === 'chat.chunk') {
    const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;
    const chunk = typeof event.payload?.chunk === 'string' ? event.payload.chunk : '';
    if (!requestId) {
      return;
    }

    const existing = thread.value.find((message) => message.id === requestId)?.body ?? '';
    upsertStreamingReply(requestId, `${existing}${existing ? ' ' : ''}${chunk}`.trim());
    return;
  }

  if (event.type === 'chat.tool.used') {
    const summary = typeof event.payload?.summary === 'string' ? event.payload.summary : 'A tool was used from the executive lane.';
    setFeedback(event.payload?.ok === false ? 'error' : 'info', summary);
    return;
  }

  if (event.type === 'chat.completed') {
    isSending.value = false;
    isStreaming.value = false;
    activeStreamId.value = null;
    void refreshThread();
    setFeedback('success', 'Streaming response completed.');
    return;
  }

  if (event.type === 'chat.error') {
    isSending.value = false;
    isStreaming.value = false;
    activeStreamId.value = null;
    setFeedback(
      'error',
      typeof event.payload?.message === 'string' ? event.payload.message : 'Failed to stream the executive reply'
    );
  }
};

const upsertStreamingReply = (requestId: string, body: string): void => {
  if (!selectedAgent.value) {
    return;
  }

  const streamingMessage: AgentChatMessage = {
    id: requestId,
    senderId: selectedAgent.value.id,
    recipientId: 'founder',
    type: 'info',
    title: `Reply from ${selectedAgent.value.name}`,
    body,
    createdAt: new Date().toISOString(),
    direction: 'agent_to_founder'
  };

  const remainingMessages = thread.value.filter((message) => message.id !== requestId);
  thread.value = sortThread([...remainingMessages, streamingMessage]);
};

const buildChatTitle = (message: string): string => {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }

  return `${compact.slice(0, 53).trimEnd()}...`;
};

useAutoReload(reload);
onBeforeUnmount(() => closeSocket());
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
            <div class="chat-thread">
              <div v-if="thread.length === 0" class="chat-empty-state">
                <MessagesSquare :size="26" />
                <div>
                  <p class="chat-empty-title">Start the first conversation</p>
                  <p class="chat-empty-copy">Use chat for planning and direction. Ask explicitly when you want the agent to call tools for a new task or project.</p>
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
                placeholder="Ask the executive agent to review blockers, summarize direction, or create a task/project through tools…"
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

                <FcButton
                  variant="primary"
                  :disabled="isSending || isStreaming || connectionState !== 'connected' || !draftMessage.trim()"
                  @click="sendMessage"
                >
                  <Send :size="14" />
                  {{ isStreaming ? 'Streaming…' : isSending ? 'Sending…' : 'Send to executive' }}
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
              <span>Ask clearly when you want the agent to <strong>create a task</strong> or <strong>open a project</strong> through tools.</span>
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
