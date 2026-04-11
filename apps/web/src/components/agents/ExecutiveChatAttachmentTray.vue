<script setup lang="ts">
import { computed, ref } from 'vue';
import { Paperclip } from 'lucide-vue-next';

import type { DraftChatAttachment } from '../../composables/executiveChat.shared';
import { useI18n } from '../../composables/useI18n';
import ChatAttachmentList from '../chat/ChatAttachmentList.vue';
import FcButton from '../FcButton.vue';

const props = defineProps<{
  agentId: string;
  attachments: DraftChatAttachment[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: 'pick', files: FileList): void;
  (event: 'remove', localId: string): void;
}>();

const { t } = useI18n();
const inputRef = ref<HTMLInputElement | null>(null);

const hasPendingUploads = computed(() =>
  props.attachments.some((attachment) => attachment.uploadState === 'uploading')
);

const openFilePicker = (): void => {
  if (!props.disabled) {
    inputRef.value?.click();
  }
};

const handleFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    emit('pick', input.files);
  }
  input.value = '';
};
</script>

<template>
  <div class="chat-attachment-tray">
    <div class="chat-attachment-actions">
      <FcButton variant="secondary" size="sm" :disabled="props.disabled" @click="openFilePicker">
        <Paperclip :size="14" />
        {{ t('chat.attachment.add') }}
      </FcButton>
      <span v-if="hasPendingUploads" class="chat-attachment-uploading">{{ t('chat.attachment.uploading') }}</span>
    </div>

    <input
      ref="inputRef"
      class="chat-attachment-input"
      type="file"
      multiple
      @change="handleFileChange"
    />

    <ChatAttachmentList
      v-if="props.attachments.length > 0"
      :agent-id="props.agentId"
      :attachments="props.attachments"
      compact
      removable
      :disabled="props.disabled"
      @remove="emit('remove', $event)"
    />
  </div>
</template>

<style scoped>
.chat-attachment-tray {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-attachment-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.chat-attachment-input {
  display: none;
}

.chat-attachment-uploading {
  color: var(--fc-text-muted);
  font-size: 0.75rem;
}
</style>
