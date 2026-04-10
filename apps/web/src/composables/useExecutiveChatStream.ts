import { onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue';

import { uiRuntime } from '../runtime';
import {
  buildChatTitle,
  formatToolFeedback,
  isToolCallDetails,
  sortThread,
  type ChatConnectionState,
  type ChatSocketEvent,
  type ChatToolCallDetails,
  type ChatToolInProgress,
  type ThreadMessage
} from './executiveChat.shared';

interface ExecutiveAgentSummary {
  id: string;
  name: string;
}

interface UseExecutiveChatStreamOptions {
  selectedAgent: ComputedRef<ExecutiveAgentSummary | null>;
  draftMessage: Ref<string>;
  thread: Ref<ThreadMessage[]>;
  refreshThread: () => Promise<void>;
  setFeedback: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function useExecutiveChatStream(options: UseExecutiveChatStreamOptions) {
  const { selectedAgent, draftMessage, thread, refreshThread, setFeedback } = options;

  const isSending = ref(false);
  const isStreaming = ref(false);
  const connectionState = ref<ChatConnectionState>('disconnected');
  const socket = ref<WebSocket | null>(null);
  const activeStreamId = ref<string | null>(null);
  const streamToolCalls = ref<Record<string, ChatToolCallDetails[]>>({});
  const streamToolsInProgress = ref<Record<string, ChatToolInProgress[]>>({});

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

    thread.value = sortThread([
      ...thread.value,
      {
        id: `local-founder-${Date.now()}`,
        senderId: 'founder',
        recipientId: selectedAgent.value.id,
        type: 'info',
        title: buildChatTitle(message),
        body: message,
        createdAt: new Date().toISOString(),
        direction: 'founder_to_agent'
      }
    ]);

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
      streamToolCalls.value = { ...streamToolCalls.value, [requestId]: [] };
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
      upsertStreamingReply(requestId, `${existing}${chunk}`);
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

    if (event.type === 'chat.tool.start') {
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;
      const toolName = typeof event.payload?.toolName === 'string' ? event.payload.toolName : null;

      if (requestId && toolName) {
        const entry: ChatToolInProgress = { toolName, startedAt: new Date().toISOString() };
        streamToolsInProgress.value = {
          ...streamToolsInProgress.value,
          [requestId]: [...(streamToolsInProgress.value[requestId] ?? []), entry]
        };
        const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
        upsertStreamingReply(requestId, existingBody);
      }
      return;
    }

    if (event.type === 'chat.tool.complete') {
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;
      const toolCall = isToolCallDetails(event.payload) ? event.payload : null;

      if (requestId && toolCall) {
        // Move from in-progress to completed
        const inProgress = streamToolsInProgress.value[requestId] ?? [];
        streamToolsInProgress.value = {
          ...streamToolsInProgress.value,
          [requestId]: inProgress.filter((entry) => entry.toolName !== toolCall.toolName)
        };
        streamToolCalls.value = {
          ...streamToolCalls.value,
          [requestId]: [...(streamToolCalls.value[requestId] ?? []), toolCall]
        };
        const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
        upsertStreamingReply(requestId, existingBody);
      }

      if (toolCall) {
        setFeedback(
          toolCall.ok === false ? 'error' : 'info',
          formatToolFeedback(toolCall)
        );
      }
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
          streamToolCalls.value = { ...streamToolCalls.value, [requestId]: completedToolCalls };
          const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
          upsertStreamingReply(requestId, existingBody);
        }

        const nextToolCalls = { ...streamToolCalls.value };
        delete nextToolCalls[requestId];
        streamToolCalls.value = nextToolCalls;

        const nextInProgress = { ...streamToolsInProgress.value };
        delete nextInProgress[requestId];
        streamToolsInProgress.value = nextInProgress;
      }

      isSending.value = false;
      isStreaming.value = false;
      activeStreamId.value = null;
      void refreshThread();
      if (failedToolCalls.length > 0) {
        setFeedback('error', failedToolCalls.map((toolCall) => formatToolFeedback(toolCall)).join(' • '));
      }
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
    const toolsInProgress = streamToolsInProgress.value[requestId] ?? [];
    const payload = (toolCalls.length > 0 || toolsInProgress.length > 0)
      ? {
          ...(existingMessage?.payload ?? {}),
          toolCalls,
          toolsInProgress
        }
      : existingMessage?.payload;

    thread.value = sortThread([
      ...thread.value.filter((message) => message.id !== requestId),
      {
        id: requestId,
        senderId: selectedAgent.value.id,
        recipientId: 'founder',
        type: toolCalls.some((toolCall) => !toolCall.ok) ? 'alert' : toolCalls.length > 0 ? 'report' : 'info',
        title: `Reply from ${selectedAgent.value.name}`,
        body,
        createdAt: existingMessage?.createdAt ?? new Date().toISOString(),
        direction: 'agent_to_founder',
        payload
      }
    ]);
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

  onBeforeUnmount(closeSocket);

  return {
    isSending,
    isStreaming,
    connectionState,
    connectSocket,
    sendMessage
  };
}

function buildSocketUrl(agentId: string): string {
  const baseURL = uiRuntime.stores.app.state.connection.baseURL;
  const url = new URL(`/api/v1/agents/${agentId}/chat/stream`, baseURL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  const runtimeApiKey = window.familycoDesktopConfig?.apiKey?.trim() || import.meta.env.VITE_API_KEY?.trim();
  if (runtimeApiKey) {
    url.searchParams.set('apiKey', runtimeApiKey);
  }

  return url.toString();
}
