import { computed, ref, watch } from 'vue';

import { uiRuntime } from '../runtime';
import { type ChatFeedback, type ThreadMessage, sortThread } from './executiveChat.shared';
import { useAutoReload } from './useAutoReload';
import { useExecutiveChatStream } from './useExecutiveChatStream';

const INITIAL_CHAT_PAGE_SIZE = 40;
const OLDER_CHAT_PAGE_SIZE = 30;

export function useExecutiveChat() {
  const thread = ref<ThreadMessage[]>([]);
  const selectedAgentId = ref('');
  const draftMessage = ref('');
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isLoadingOlder = ref(false);
  const hasMoreHistory = ref(true);
  const feedback = ref<ChatFeedback>(null);

  const agentState = computed(() => uiRuntime.stores.agents.state.agents);
  const executiveAgents = computed(() =>
    agentState.value.data.filter((agent) => agent.level === 'L0' && agent.status !== 'terminated')
  );
  const selectedAgent = computed(
    () => executiveAgents.value.find((agent) => agent.id === selectedAgentId.value) ?? executiveAgents.value[0] ?? null
  );

  const setFeedback = (type: 'success' | 'error' | 'info', text: string): void => {
    feedback.value = { type, text };
    setTimeout(() => {
      if (feedback.value?.text === text) {
        feedback.value = null;
      }
    }, 4000);
  };

  const refreshThread = async (): Promise<void> => {
    if (!selectedAgentId.value) {
      thread.value = [];
      hasMoreHistory.value = false;
      return;
    }

    const recentMessages = sortThread(
      await uiRuntime.api.getAgentChat(selectedAgentId.value, { limit: INITIAL_CHAT_PAGE_SIZE })
    );

    thread.value = recentMessages;
    hasMoreHistory.value = recentMessages.length >= INITIAL_CHAT_PAGE_SIZE;
  };

  const loadOlderMessages = async (): Promise<void> => {
    if (!selectedAgentId.value || isLoadingOlder.value || !hasMoreHistory.value || thread.value.length === 0) {
      return;
    }

    const oldestMessage = thread.value[0];
    isLoadingOlder.value = true;

    try {
      const olderMessages = sortThread(
        await uiRuntime.api.getAgentChat(selectedAgentId.value, {
          limit: OLDER_CHAT_PAGE_SIZE,
          before: oldestMessage.createdAt
        })
      );

      if (olderMessages.length === 0) {
        hasMoreHistory.value = false;
        return;
      }

      const existingIds = new Set(thread.value.map((message) => message.id));
      const uniqueOlderMessages = olderMessages.filter((message) => !existingIds.has(message.id));

      if (uniqueOlderMessages.length === 0) {
        hasMoreHistory.value = false;
        return;
      }

      thread.value = sortThread([...uniqueOlderMessages, ...thread.value]);
      hasMoreHistory.value = olderMessages.length >= OLDER_CHAT_PAGE_SIZE;
    } catch (error) {
      setFeedback('error', error instanceof Error ? error.message : 'Failed to load older messages');
    } finally {
      isLoadingOlder.value = false;
    }
  };

  const { isSending, isStreaming, connectionState, connectSocket, sendMessage } = useExecutiveChatStream({
    selectedAgent,
    draftMessage,
    thread,
    refreshThread,
    setFeedback
  });

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
    hasMoreHistory.value = true;

    if (!isLoading.value) {
      void refreshThread();
      connectSocket();
    }
  });

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

  useAutoReload(reload);

  return {
    thread,
    selectedAgentId,
    draftMessage,
    isLoading,
    isRefreshing,
    isLoadingOlder,
    hasMoreHistory,
    isSending,
    isStreaming,
    connectionState,
    connectionLabel,
    feedback,
    executiveAgents,
    selectedAgent,
    reload,
    loadOlderMessages,
    sendMessage
  };
}
