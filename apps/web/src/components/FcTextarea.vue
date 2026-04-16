<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
</script>

<template>
  <textarea
    v-bind="$attrs"
    class="fc-textarea"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>