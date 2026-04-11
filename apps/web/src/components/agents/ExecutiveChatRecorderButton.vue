<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Mic, Square } from 'lucide-vue-next';

import { useI18n } from '../../composables/useI18n';
import FcButton from '../FcButton.vue';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: 'recorded', file: File): void;
}>();

const { t } = useI18n();
const isRecording = ref(false);
const isStopping = ref(false);
const errorText = ref('');

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let recordedChunks: BlobPart[] = [];

const isSupported = computed(() =>
  typeof window !== 'undefined'
  && typeof MediaRecorder !== 'undefined'
  && typeof navigator !== 'undefined'
  && !!navigator.mediaDevices?.getUserMedia
);

const buttonLabel = computed(() => {
  if (isStopping.value) {
    return t('chat.attachment.recording');
  }

  if (isRecording.value) {
    return t('chat.attachment.stopRecording');
  }

  return t('chat.attachment.record');
});

const toggleRecording = async (): Promise<void> => {
  if (!isSupported.value || props.disabled || isStopping.value) {
    return;
  }

  if (isRecording.value) {
    isStopping.value = true;
    mediaRecorder?.stop();
    return;
  }

  errorText.value = '';

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, resolveRecorderOptions());
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });
    mediaRecorder.addEventListener('stop', handleRecorderStop, { once: true });
    mediaRecorder.start();
    isRecording.value = true;
  } catch {
    errorText.value = t('chat.attachment.recordFailed');
    cleanup();
  }
};

const handleRecorderStop = (): void => {
  const mimeType = mediaRecorder?.mimeType || 'audio/webm';
  const blob = new Blob(recordedChunks, { type: mimeType });
  cleanup();
  isStopping.value = false;
  isRecording.value = false;

  if (blob.size === 0) {
    errorText.value = t('chat.attachment.recordFailed');
    return;
  }

  const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  emit('recorded', new File([blob], `recording-${Date.now()}.${extension}`, { type: mimeType }));
};

const cleanup = (): void => {
  mediaRecorder = null;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  recordedChunks = [];
};

onBeforeUnmount(cleanup);

function resolveRecorderOptions(): MediaRecorderOptions | undefined {
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];

  const mimeType = preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
}
</script>

<template>
  <div class="chat-recorder">
    <FcButton
      variant="secondary"
      size="sm"
      :disabled="props.disabled || !isSupported || isStopping"
      @click="toggleRecording"
    >
      <Square v-if="isRecording" :size="14" />
      <Mic v-else :size="14" />
      {{ buttonLabel }}
    </FcButton>

    <span v-if="isRecording || isStopping" class="chat-recorder-state">{{ t('chat.attachment.recording') }}</span>
    <span v-else-if="!isSupported" class="chat-recorder-error">{{ t('chat.attachment.recordUnsupported') }}</span>
    <span v-else-if="errorText" class="chat-recorder-error">{{ errorText }}</span>
  </div>
</template>

<style scoped>
.chat-recorder {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chat-recorder-state,
.chat-recorder-error {
  font-size: 0.75rem;
}

.chat-recorder-state {
  color: var(--fc-text-muted);
}

.chat-recorder-error {
  color: var(--fc-danger);
}
</style>
