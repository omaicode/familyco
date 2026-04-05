<script setup lang="ts">
import { Construction } from 'lucide-vue-next';

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
      <Construction :size="36" class="fc-empty-icon" />
      <h4>Coming soon</h4>
      <p>This section is being built. Check back soon.</p>
    </div>
  </section>
</template>
