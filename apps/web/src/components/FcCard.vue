<script setup lang="ts">
defineOptions({ inheritAttrs: false });
</script>

<template>
  <div v-bind="$attrs" class="fc-card">
    <slot />
  </div>
</template>
