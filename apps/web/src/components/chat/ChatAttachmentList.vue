<script setup lang="ts">
import { computed } from 'vue';
import { AudioLines, FileText, LoaderCircle, TriangleAlert, X } from 'lucide-vue-next';

import type { ChatAttachmentItem } from '@familyco/ui';

import {
  buildChatAttachmentUrl,
  formatAttachmentSize,
  type DraftChatAttachment
} from '../../composables/executiveChat.shared';
import { useI18n } from '../../composables/useI18n';

const props = withDefaults(defineProps<{
  agentId: string;
  attachments: Array<ChatAttachmentItem | DraftChatAttachment>;
  compact?: boolean;
  removable?: boolean;
  disabled?: boolean;
}>(), {
  compact: false,
  removable: false,
  disabled: false
});

const emit = defineEmits<{
  (event: 'remove', localId: string): void;
}>();

const { t } = useI18n();

interface NormalizedAttachment extends ChatAttachmentItem {
  localId: string;
  uploadState: 'uploading' | 'uploaded' | 'failed';
  errorText?: string;
}

const normalizedAttachments = computed<NormalizedAttachment[]>(() =>
  props.attachments.map((attachment) => ({
    ...attachment,
    localId: 'localId' in attachment ? attachment.localId : attachment.id,
    uploadState: 'uploadState' in attachment ? attachment.uploadState : 'uploaded',
    errorText: 'errorText' in attachment ? attachment.errorText : undefined
  }))
);

const getAttachmentHref = (attachment: ChatAttachmentItem): string =>
  buildChatAttachmentUrl(props.agentId, attachment.id);
</script>

<template>
  <div v-if="normalizedAttachments.length > 0" class="chat-attachment-list" :class="{ compact: props.compact }">
    <div
      v-for="attachment in normalizedAttachments"
      :key="attachment.localId"
      class="chat-attachment-card"
      :data-state="attachment.uploadState"
    >
      <div class="chat-attachment-main">
        <span class="chat-attachment-icon" aria-hidden="true">
          <LoaderCircle v-if="attachment.uploadState === 'uploading'" :size="15" class="chat-attachment-spinner" />
          <TriangleAlert v-else-if="attachment.uploadState === 'failed'" :size="15" />
          <AudioLines v-else-if="attachment.kind === 'audio'" :size="15" />
          <FileText v-else :size="15" />
        </span>

        <div class="chat-attachment-copy">
          <div class="chat-attachment-header">
            <strong class="chat-attachment-name">{{ attachment.name }}</strong>
            <button
              v-if="props.removable"
              type="button"
              class="chat-attachment-remove"
              :aria-label="t('chat.attachment.remove')"
              :disabled="props.disabled"
              @click="emit('remove', attachment.localId)"
            >
              <X :size="14" />
            </button>
          </div>

          <p class="chat-attachment-meta">
            <span>{{ attachment.kind === 'audio' ? t('chat.attachment.kind.audio') : t('chat.attachment.kind.file') }}</span>
            <span>•</span>
            <span>{{ formatAttachmentSize(attachment.sizeBytes) }}</span>
            <span v-if="attachment.uploadState === 'uploading'">• {{ t('chat.attachment.uploading') }}</span>
            <span v-else-if="attachment.uploadState === 'failed'">• {{ t('chat.attachment.failed') }}</span>
          </p>

          <p v-if="attachment.uploadState === 'failed' && attachment.errorText" class="chat-attachment-error">
            {{ attachment.errorText }}
          </p>

          <audio
            v-if="attachment.kind === 'audio' && attachment.uploadState === 'uploaded' && !props.compact"
            class="chat-attachment-audio"
            controls
            preload="metadata"
            :src="getAttachmentHref(attachment)"
          />

          <a
            v-else-if="attachment.uploadState === 'uploaded'"
            class="chat-attachment-link"
            :href="getAttachmentHref(attachment)"
            target="_blank"
            rel="noreferrer"
          >
            {{ t('chat.attachment.open') }}
          </a>

          <p v-if="attachment.kind === 'audio' && attachment.transcript?.trim()" class="chat-attachment-transcript">
            {{ attachment.transcript }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.chat-attachment-list.compact {
  margin-top: 0;
}

.chat-attachment-card {
  border: 1px solid color-mix(in srgb, var(--fc-border-subtle) 72%, transparent);
  border-radius: 12px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 62%, var(--fc-surface));
}

.chat-attachment-card[data-state='uploading'] {
  border-color: color-mix(in srgb, var(--fc-info) 30%, var(--fc-border-subtle));
}

.chat-attachment-card[data-state='failed'] {
  border-color: color-mix(in srgb, var(--fc-danger) 34%, var(--fc-border-subtle));
}

.chat-attachment-main {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.chat-attachment-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface));
  color: var(--fc-primary);
  flex-shrink: 0;
}

.chat-attachment-copy {
  min-width: 0;
  flex: 1;
}

.chat-attachment-header {
  display: flex;
  gap: 8px;
  align-items: start;
  justify-content: space-between;
}

.chat-attachment-name {
  display: block;
  color: var(--fc-text-main);
  font-size: 0.88rem;
  line-height: 1.4;
  word-break: break-word;
}

.chat-attachment-meta {
  margin: 2px 0 0;
  color: var(--fc-text-muted);
  font-size: 0.74rem;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chat-attachment-link {
  display: inline-flex;
  margin-top: 8px;
  color: var(--fc-primary);
  font-size: 0.8rem;
  font-weight: 600;
}

.chat-attachment-audio {
  width: 100%;
  margin-top: 8px;
}

.chat-attachment-transcript {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--fc-border-subtle) 60%, transparent);
  color: var(--fc-text-muted);
  font-size: 0.8rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.chat-attachment-error {
  margin: 6px 0 0;
  color: var(--fc-danger);
  font-size: 0.76rem;
  line-height: 1.45;
}

.chat-attachment-remove {
  border: 0;
  background: transparent;
  color: var(--fc-text-muted);
  padding: 0;
  cursor: pointer;
}

.chat-attachment-spinner {
  animation: chat-attachment-spin 0.9s linear infinite;
}

@keyframes chat-attachment-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
