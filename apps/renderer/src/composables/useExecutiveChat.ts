import type { AgentChatMessage } from '@familyco/ui';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { uiRuntime } from '../runtime';
import { useAutoReload } from './useAutoReload';

export interface ChatSocketEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export interface ChatToolCallDetails {
  toolName: string;
  ok: boolean;
  summary: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export type ThreadMessage = AgentChatMessage & {
  payload?: {
    taskId?: string;
    projectId?: string;
    toolCalls?: ChatToolCallDetails[];
    [key: string]: unknown;
  };
};
export type ChatConnectionState = 'connecting' | 'connected' | 'disconnected';
export type ChatFeedback = { type: 'success' | 'error' | 'info'; text: string } | null;

export function useExecutiveChat() {
  const thread = ref<ThreadMessage[]>([]);
  const selectedAgentId = ref('');
  const draftMessage = ref('');
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isSending = ref(false);
  const isStreaming = ref(false);
  const connectionState = ref<ChatConnectionState>('disconnected');
  const feedback = ref<ChatFeedback>(null);
  const socket = ref<WebSocket | null>(null);
  const activeStreamId = ref<string | null>(null);
  const streamToolCalls = ref<Record<string, ChatToolCallDetails[]>>({});

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

  const sortThread = (messages: ThreadMessage[]): ThreadMessage[] => {
    return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  };

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

    const founderMessage: ThreadMessage = {
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
      streamToolCalls.value = {
        ...streamToolCalls.value,
        [requestId]: []
      };
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
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;
      const toolCall = isToolCallDetails(event.payload) ? event.payload : null;

      if (requestId && toolCall) {
        streamToolCalls.value = {
          ...streamToolCalls.value,
          [requestId]: [...(streamToolCalls.value[requestId] ?? []), toolCall]
        };
        const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
        upsertStreamingReply(requestId, existingBody);
      }

      setFeedback(
        toolCall?.ok === false ? 'error' : 'info',
        toolCall ? formatToolFeedback(toolCall) : 'A tool was used from the executive lane.'
      );
      return;
    }

    if (event.type === 'chat.completed') {
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;
      const completedToolCalls = Array.isArray(event.payload?.toolCalls)
        ? event.payload.toolCalls.filter(isToolCallDetails)
        : [];
      const failedToolCalls = completedToolCalls.filter((toolCall) => !toolCall.ok);

      if (requestId) {
        if (completedToolCalls.length > 0) {
          streamToolCalls.value = {
            ...streamToolCalls.value,
            [requestId]: completedToolCalls
          };
          const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
          upsertStreamingReply(requestId, existingBody);
        }

        const nextToolCalls = { ...streamToolCalls.value };
        delete nextToolCalls[requestId];
        streamToolCalls.value = nextToolCalls;
      }

      isSending.value = false;
      isStreaming.value = false;
      activeStreamId.value = null;
      void refreshThread();
      setFeedback(
        failedToolCalls.length > 0 ? 'error' : 'success',
        failedToolCalls.length > 0
          ? failedToolCalls.map((toolCall) => formatToolFeedback(toolCall)).join(' • ')
          : 'Streaming response completed.'
      );
      return;
    }

    if (event.type === 'chat.error') {
      const message = typeof event.payload?.message === 'string'
        ? event.payload.message
        : 'Failed to stream the executive reply';
      isSending.value = false;
      isStreaming.value = false;
      activeStreamId.value = null;
      appendLocalIssueMessage(message);
      setFeedback('error', message);
    }
  };

  const upsertStreamingReply = (requestId: string, body: string): void => {
    if (!selectedAgent.value) {
      return;
    }

    const existingMessage = thread.value.find((message) => message.id === requestId);
    const toolCalls = streamToolCalls.value[requestId] ?? [];
    const streamingMessage: ThreadMessage = {
      id: requestId,
      senderId: selectedAgent.value.id,
      recipientId: 'founder',
      type: toolCalls.some((toolCall) => !toolCall.ok) ? 'alert' : toolCalls.length > 0 ? 'report' : 'info',
      title: `Reply from ${selectedAgent.value.name}`,
      body,
      createdAt: existingMessage?.createdAt ?? new Date().toISOString(),
      direction: 'agent_to_founder',
      payload: toolCalls.length > 0 ? { ...(existingMessage?.payload ?? {}), toolCalls } : existingMessage?.payload
    };

    const remainingMessages = thread.value.filter((message) => message.id !== requestId);
    thread.value = sortThread([...remainingMessages, streamingMessage]);
  };

  const appendLocalIssueMessage = (message: string): void => {
    if (!selectedAgent.value) {
      return;
    }

    thread.value = sortThread([
      ...thread.value,
      {
        id: `local-issue-${Date.now()}`,
        senderId: selectedAgent.value.id,
        recipientId: 'founder',
        type: 'alert',
        title: `Issue from ${selectedAgent.value.name}`,
        body: message,
        createdAt: new Date().toISOString(),
        direction: 'agent_to_founder'
      }
    ]);
  };

  useAutoReload(reload);
  onBeforeUnmount(() => closeSocket());

  return {
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
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isToolCallDetails(value: unknown): value is ChatToolCallDetails {
  return isRecord(value)
    && typeof value.toolName === 'string'
    && typeof value.ok === 'boolean'
    && typeof value.summary === 'string';
}

function formatToolFeedback(toolCall: ChatToolCallDetails): string {
  if (toolCall.ok) {
    return `Tool ${toolCall.toolName}: ${toolCall.summary}`;
  }

  const errorMessage = typeof toolCall.error?.message === 'string' && toolCall.error.message.trim().length > 0
    ? toolCall.error.message.trim()
    : toolCall.summary;
  const errorCode = typeof toolCall.error?.code === 'string' && toolCall.error.code.trim().length > 0
    ? ` (${toolCall.error.code.trim()})`
    : '';

  return `Tool ${toolCall.toolName} failed${errorCode}: ${errorMessage}`;
}

function buildChatTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }

  return `${compact.slice(0, 53).trimEnd()}...`;
}
