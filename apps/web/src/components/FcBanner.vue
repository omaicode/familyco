<script setup lang="ts">
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-vue-next';

const props = defineProps<{
  type: 'success' | 'error' | 'info';
  /** Show a close (×) button on the right */
  closable?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const iconMap = { success: CheckCircle2, error: AlertTriangle, info: Info };
const classMap = { success: 'fc-banner-success', error: 'fc-banner-error', info: 'fc-banner-info' };
</script>

<template>
  <div class="fc-banner" :class="classMap[props.type]">
    <component :is="iconMap[props.type]" :size="15" style="flex-shrink:0;" />
    <span style="flex:1;"><slot /></span>
    <button
      v-if="props.closable"
      type="button"
      class="fc-btn-ghost fc-btn-icon"
      style="margin-left:auto;"
      @click="emit('close')"
    >
      <X :size="12" />
    </button>
  </div>
</template>
