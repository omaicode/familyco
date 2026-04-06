<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
</script>

<template>
  <select
    v-bind="$attrs"
    class="fc-select"
    :value="modelValue"
    :disabled="disabled"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <slot />
  </select>
</template>
