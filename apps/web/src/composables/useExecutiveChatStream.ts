import { onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue';

import { translate, type SendAgentChatPayload } from '@familyco/ui';

import { uiRuntime } from '../runtime';
import {
  buildChatTitle,
  formatToolFeedback,
  isChatConfirmRequest,
  isToolCallDetails,
  sortThread,
  type ChatConfirmRequest,
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

interface SendStreamingMessageOptions {
  meta?: SendAgentChatPayload['meta'];
  founderPayload?: ThreadMessage['payload'];
}

export function useExecutiveChatStream(options: UseExecutiveChatStreamOptions) {
  const { selectedAgent, draftMessage, thread, refreshThread, setFeedback } = options;
  const t = (key: string): string => translate(uiRuntime.stores.app.state.locale, key);

  const isSending = ref(false);
  const isStreaming = ref(false);
  const isCancelling = ref(false);
  const connectionState = ref<ChatConnectionState>('disconnected');
  const socket = ref<WebSocket | null>(null);
  const activeStreamId = ref<string | null>(null);
  const streamToolCalls = ref<Record<string, ChatToolCallDetails[]>>({});
  const streamToolsInProgress = ref<Record<string, ChatToolInProgress[]>>({});
  const pendingConfirmRequestId = ref<string | null>(null);

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
        setFeedback('error', t('chat.stream.invalidPayload'));
      }
    });

    socket.value = nextSocket;
  };

  const sendMessage = (options?: SendStreamingMessageOptions): boolean => {
    const message = draftMessage.value.trim();
    if (!selectedAgent.value || (message.length === 0 && !(options?.meta?.attachments?.length))) {
      return false;
    }

    if (!socket.value || connectionState.value !== 'connected') {
      connectSocket();
      setFeedback('info', t('chat.socket.reconnect'));
      return false;
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
        direction: 'founder_to_agent',
        ...(options?.founderPayload ? { payload: options.founderPayload } : {})
      }
    ]);

    socket.value.send(JSON.stringify({
      message,
      ...(options?.meta ? { meta: options.meta } : {})
    }));
    draftMessage.value = '';
    isSending.value = true;
    isCancelling.value = false;
    return true;
  };

  const cancelMessage = (): void => {
    if (!socket.value || connectionState.value !== 'connected' || !activeStreamId.value || !isStreaming.value) {
      return;
    }

    socket.value.send(JSON.stringify({
      action: 'cancel',
      requestId: activeStreamId.value
    }));
  };

  const handleSocketEvent = (event: ChatSocketEvent): void => {
    if (event.type === 'chat.ready') {
      connectionState.value = 'connected';
      // Refresh the thread to catch any messages that completed while disconnected.
      // Only safe when we're not about to receive chat.resumed (the server sends one or the other).
      void refreshThread();
      return;
    }

    if (event.type === 'chat.resumed') {
      // The server has an active stream for this agent — reconnect mid-flight.
      const requestId = typeof event.payload?.requestId === 'string'
        ? event.payload.requestId
        : `resumed-${Date.now()}`;

      activeStreamId.value = requestId;
      streamToolCalls.value = { ...streamToolCalls.value, [requestId]: [] };
      streamToolsInProgress.value = { ...streamToolsInProgress.value, [requestId]: [] };
      pendingConfirmRequestId.value = null;
      isSending.value = false;
      isStreaming.value = true;
      isCancelling.value = false;
      upsertStreamingReply(requestId, '', undefined, true);
      return;
    }

    if (event.type === 'chat.started') {
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : `stream-${Date.now()}`;
      activeStreamId.value = requestId;
      streamToolCalls.value = { ...streamToolCalls.value, [requestId]: [] };
      streamToolsInProgress.value = { ...streamToolsInProgress.value, [requestId]: [] };
      pendingConfirmRequestId.value = null;
      isSending.value = false;
      isStreaming.value = true;
      isCancelling.value = false;
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
          [requestId]: appendUniqueToolCall(streamToolCalls.value[requestId] ?? [], toolCall)
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
      const toolName = typeof event.payload?.toolName === 'string' ? event.payload.toolName : null;
      const toolCall = isToolCallDetails(event.payload) ? event.payload : null;

      if (requestId && toolName) {
        streamToolsInProgress.value = {
          ...streamToolsInProgress.value,
          [requestId]: removeLatestInProgressTool(streamToolsInProgress.value[requestId] ?? [], toolName)
        };
        if (toolCall) {
          streamToolCalls.value = {
            ...streamToolCalls.value,
            [requestId]: appendUniqueToolCall(streamToolCalls.value[requestId] ?? [], toolCall)
          };
        }
        const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
        upsertStreamingReply(requestId, existingBody);
      }
      return;
    }

    if (event.type === 'chat.completed') {
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;
      const completedToolCalls = Array.isArray(event.payload?.toolCalls)
        ? event.payload.toolCalls.filter(isToolCallDetails)
        : [];
      const failedToolCalls = completedToolCalls.filter((toolCall) => !toolCall.ok);
      const confirmRequest = isChatConfirmRequest(event.payload?.confirmRequest)
        ? (event.payload.confirmRequest as ChatConfirmRequest)
        : undefined;

      if (requestId) {
        if (completedToolCalls.length > 0) {
          streamToolCalls.value = { ...streamToolCalls.value, [requestId]: completedToolCalls };
        }

        const existingBody = thread.value.find((message) => message.id === requestId)?.body ?? '';
        upsertStreamingReply(requestId, existingBody, confirmRequest);

        if (confirmRequest) {
          pendingConfirmRequestId.value = requestId;
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
      isCancelling.value = false;
      activeStreamId.value = null;

      if (!confirmRequest) {
        void refreshThread();
      }

      if (failedToolCalls.length > 0) {
        setFeedback('error', failedToolCalls.map((toolCall) => formatToolFeedback(toolCall)).join(' • '));
      }
      return;
    }

    if (event.type === 'chat.cancelling') {
      isCancelling.value = true;
      return;
    }

    if (event.type === 'chat.cancelled') {
      const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : activeStreamId.value;

      if (requestId) {
        thread.value = thread.value.filter((message) => message.id !== requestId);
      }

      isSending.value = false;
      isStreaming.value = false;
      isCancelling.value = false;
      activeStreamId.value = null;
      void refreshThread();
      setFeedback('info', t('chat.cancelled'));
      return;
    }

    if (event.type === 'chat.error') {
      const message = typeof event.payload?.message === 'string'
        ? event.payload.message
        : 'Failed to stream the executive reply';
      isSending.value = false;
      isStreaming.value = false;
      isCancelling.value = false;
      activeStreamId.value = null;
      appendLocalIssueMessage(message);
      setFeedback('error', message);
    }
  };

  const upsertStreamingReply = (requestId: string, body: string, confirmRequest?: ChatConfirmRequest, resuming?: boolean): void => {
    if (!selectedAgent.value) {
      return;
    }

    const existingMessage = thread.value.find((message) => message.id === requestId);
    const toolCalls = streamToolCalls.value[requestId] ?? [];
    const toolsInProgress = streamToolsInProgress.value[requestId] ?? [];

    // Keep resuming flag unless explicitly cleared (body arriving means stream resumed)
    const isResuming = resuming ?? (body.length === 0 && (existingMessage?.payload?.resuming === true));

    const payload = {
      ...(existingMessage?.payload ?? {}),
      toolCalls,
      toolsInProgress,
      resuming: isResuming,
      ...(confirmRequest !== undefined ? { confirmRequest } : {})
    };

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

  const sendConfirmOption = (option: string): void => {
    if (!selectedAgent.value || !socket.value || connectionState.value !== 'connected') {
      return;
    }

    if (pendingConfirmRequestId.value) {
      const confirmedId = pendingConfirmRequestId.value;
      pendingConfirmRequestId.value = null;
      thread.value = thread.value.map((msg) => {
        if (msg.id !== confirmedId || !msg.payload) {
          return msg;
        }
        const { confirmRequest: _removed, ...rest } = msg.payload;
        return { ...msg, payload: rest };
      });
    }

    thread.value = sortThread([
      ...thread.value,
      {
        id: `local-confirm-${Date.now()}`,
        senderId: 'founder',
        recipientId: selectedAgent.value.id,
        type: 'info',
        title: buildChatTitle(option),
        body: option,
        createdAt: new Date().toISOString(),
        direction: 'founder_to_agent'
      }
    ]);

    socket.value.send(JSON.stringify({ message: option }));
    isSending.value = true;
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
    isCancelling,
    connectionState,
    connectSocket,
    sendMessage,
    cancelMessage,
    sendConfirmOption
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

function appendUniqueToolCall(
  existing: ChatToolCallDetails[],
  next: ChatToolCallDetails
): ChatToolCallDetails[] {
  return existing.some((entry) => isSameToolCall(entry, next))
    ? existing
    : [...existing, next];
}

function removeLatestInProgressTool(
  existing: ChatToolInProgress[],
  toolName: string
): ChatToolInProgress[] {
  for (let index = existing.length - 1; index >= 0; index -= 1) {
    if (existing[index]?.toolName === toolName) {
      return [...existing.slice(0, index), ...existing.slice(index + 1)];
    }
  }

  return existing;
}

function isSameToolCall(left: ChatToolCallDetails, right: ChatToolCallDetails): boolean {
  return left.toolName === right.toolName
    && left.ok === right.ok
    && left.summary === right.summary
    && left.error?.code === right.error?.code
    && left.error?.message === right.error?.message;
}
