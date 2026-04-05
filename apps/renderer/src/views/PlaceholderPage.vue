<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
    </div>

    <div class="fc-empty">
      <p>This page skeleton is ready. Next step is wiring dedicated components and actions.</p>
    </div>
  </section>
</template>
