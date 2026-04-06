<script setup lang="ts">
defineProps<{
  /** status badge (active, pending, blocked, approved, rejected…) */
  status?: string;
  /** level badge (L0, L1, L2) */
  level?: string;
}>();
</script>

<template>
  <span v-if="level" class="fc-level-badge" :data-level="level">
    <slot />
  </span>
  <span v-else class="fc-badge" :data-status="status">
    <slot />
  </span>
</template>
