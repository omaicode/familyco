<script setup lang="ts">
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'icon';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}>(), { variant: 'secondary', type: 'button' });
</script>

<template>
  <button
    v-bind="$attrs"
    :class="[
      `fc-btn-${variant}`,
      size ? `fc-btn-${size}` : null,
    ]"
    :disabled="disabled"
    :type="type"
  >
    <slot />
  </button>
</template>
