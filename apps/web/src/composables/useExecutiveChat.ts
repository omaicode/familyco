import { computed, ref, watch } from 'vue';

import { translate, type ChatAttachmentItem, type ChatAttachmentReference } from '@familyco/ui';

import { uiRuntime } from '../runtime';
import { type ChatFeedback, type DraftChatAttachment, type ThreadMessage, sortThread } from './executiveChat.shared';
import { useAutoReload } from './useAutoReload';
import { useExecutiveChatStream } from './useExecutiveChatStream';

const INITIAL_CHAT_PAGE_SIZE = 20;
const OLDER_CHAT_PAGE_SIZE = 20;

export function useExecutiveChat() {
  const thread = ref<ThreadMessage[]>([]);
  const selectedAgentId = ref('');
  const draftMessage = ref('');
  const draftAttachments = ref<DraftChatAttachment[]>([]);
  const editingMessageId = ref<string | null>(null);
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isLoadingOlder = ref(false);
  const hasMoreHistory = ref(true);
  const feedback = ref<ChatFeedback>(null);
  const t = (key: string): string => translate(uiRuntime.stores.app.state.locale, key);

  const agentState = computed(() => uiRuntime.stores.agents.state.agents);
  const executiveAgents = computed(() =>
    agentState.value.data.filter((agent) => agent.level === 'L0' && agent.status !== 'terminated')
  );
  const selectedAgent = computed(
    () => executiveAgents.value.find((agent) => agent.id === selectedAgentId.value) ?? executiveAgents.value[0] ?? null
  );
  const isUploadingAttachments = computed(() =>
    draftAttachments.value.some((attachment) => attachment.uploadState === 'uploading')
  );
  const editingMessage = computed(
    () => thread.value.find((message) => message.id === editingMessageId.value) ?? null
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

  const {
    isSending,
    isStreaming,
    isCancelling,
    connectionState,
    connectSocket,
    sendMessage: streamSendMessage,
    cancelMessage,
    sendConfirmOption
  } = useExecutiveChatStream({
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
    draftAttachments.value = [];
    editingMessageId.value = null;

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

  const uploadAttachments = async (files: File[] | FileList): Promise<void> => {
    const selectedFiles = Array.isArray(files) ? files : Array.from(files);
    if (!selectedAgentId.value || selectedFiles.length === 0) {
      return;
    }
    const pendingEntries = selectedFiles.map((file) => createPendingAttachment(file));
    draftAttachments.value = [...draftAttachments.value, ...pendingEntries];

    await Promise.all(
      pendingEntries.map(async (pendingEntry, index) => {
        const file = selectedFiles[index];

        try {
          const uploaded = await uiRuntime.api.uploadAgentChatAttachment({
            agentId: selectedAgentId.value,
            file,
            filename: file.name
          });

          draftAttachments.value = draftAttachments.value.map((attachment) =>
            attachment.localId === pendingEntry.localId
              ? {
                  ...uploaded,
                  localId: pendingEntry.localId,
                  uploadState: 'uploaded'
                }
              : attachment
          );
        } catch (error) {
          draftAttachments.value = draftAttachments.value.map((attachment) =>
            attachment.localId === pendingEntry.localId
              ? {
                  ...attachment,
                  uploadState: 'failed',
                  errorText: error instanceof Error ? error.message : 'Failed to upload attachment'
                }
              : attachment
          );
          setFeedback('error', error instanceof Error ? error.message : 'Failed to upload attachment');
        }
      })
    );
  };

  const removeDraftAttachment = (localId: string): void => {
    draftAttachments.value = draftAttachments.value.filter((attachment) => attachment.localId !== localId);
  };

  const startEditingMessage = (message: ThreadMessage): void => {
    editingMessageId.value = message.id;
    draftMessage.value = message.body;
    draftAttachments.value = readDraftAttachmentsFromMessage(message).map((attachment) => ({
      ...attachment,
      localId: crypto.randomUUID(),
      uploadState: 'uploaded'
    }));
  };

  const cancelEditing = (): void => {
    editingMessageId.value = null;
    draftMessage.value = '';
    draftAttachments.value = [];
  };

  const sendMessage = (): void => {
    if (isUploadingAttachments.value) {
      setFeedback('info', t('chat.attachment.waitUpload'));
      return;
    }

    if (draftAttachments.value.some((attachment) => attachment.uploadState === 'failed')) {
      setFeedback('error', t('chat.attachment.removeFailed'));
      return;
    }

    const uploadedAttachments = draftAttachments.value.filter(
      (attachment): attachment is DraftChatAttachment & { uploadState: 'uploaded' } => attachment.uploadState === 'uploaded'
    );
    const attachmentRefs: ChatAttachmentReference[] = uploadedAttachments.map((attachment) => ({ id: attachment.id }));
    const currentEditingMessage = editingMessage.value;
    const editMeta = editingMessageId.value
      ? {
          editedFromMessageId: editingMessageId.value,
          supersedesMessageId: editingMessageId.value
        }
      : undefined;

    if (currentEditingMessage) {
      const editingIndex = thread.value.findIndex((message) => message.id === currentEditingMessage.id);
      if (editingIndex >= 0) {
        thread.value = thread.value.slice(0, editingIndex);
      }
    }

    const sent = streamSendMessage({
      meta: attachmentRefs.length > 0 || editMeta
        ? {
            ...(attachmentRefs.length > 0 ? { attachments: attachmentRefs } : {}),
            ...(editMeta ?? {})
          }
        : undefined,
      founderPayload: attachmentRefs.length > 0 || editMeta
        ? {
            ...(attachmentRefs.length > 0 ? { attachments: uploadedAttachments } : {}),
            ...(editMeta ?? {})
          }
        : undefined
    });

    if (sent) {
      draftAttachments.value = [];
      editingMessageId.value = null;
    }
  };

  return {
    thread,
    selectedAgentId,
    draftMessage,
    draftAttachments,
    editingMessage,
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
    startEditingMessage,
    cancelEditing,
    sendMessage,
    cancelMessage,
    sendConfirmOption
  };
}

function createPendingAttachment(file: File): DraftChatAttachment {
  return {
    id: `pending-${crypto.randomUUID()}`,
    localId: crypto.randomUUID(),
    kind: file.type.startsWith('audio/') ? 'audio' : 'file',
    name: file.name,
    mediaType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    storageKey: '',
    createdAt: new Date().toISOString(),
    uploadState: 'uploading'
  };
}

function readDraftAttachmentsFromMessage(message: ThreadMessage): ChatAttachmentItem[] {
  if (!Array.isArray(message.payload?.attachments)) {
    return [];
  }

  return message.payload.attachments.filter((attachment): attachment is ChatAttachmentItem =>
    typeof attachment.id === 'string'
    && (attachment.kind === 'file' || attachment.kind === 'audio')
    && typeof attachment.name === 'string'
    && typeof attachment.mediaType === 'string'
    && typeof attachment.sizeBytes === 'number'
    && typeof attachment.storageKey === 'string'
    && typeof attachment.createdAt === 'string'
  );
}
