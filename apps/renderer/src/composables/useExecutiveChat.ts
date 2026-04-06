import { computed, ref, watch } from 'vue';

import { uiRuntime } from '../runtime';
import { type ChatFeedback, type ThreadMessage, sortThread } from './executiveChat.shared';
import { useAutoReload } from './useAutoReload';
import { useExecutiveChatStream } from './useExecutiveChatStream';

export function useExecutiveChat() {
  const thread = ref<ThreadMessage[]>([]);
  const selectedAgentId = ref('');
  const draftMessage = ref('');
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const feedback = ref<ChatFeedback>(null);

  const agentState = computed(() => uiRuntime.stores.agents.state.agents);
  const executiveAgents = computed(() =>
    agentState.value.data.filter((agent) => agent.level === 'L0' && agent.status !== 'archived')
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
      return;
    }

    thread.value = sortThread(await uiRuntime.api.getAgentChat(selectedAgentId.value));
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
    if (!isLoading.value) {
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
