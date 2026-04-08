<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  autocomplete?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: string] }>();
</script>

<template>
  <input
    v-bind="$attrs"
    class="fc-input"
    :value="modelValue"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :autocomplete="autocomplete"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
