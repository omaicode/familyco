<script setup lang="ts">
import { Zap } from 'lucide-vue-next';

defineProps<{
  show: boolean;
}>();
</script>

<template>
  <Transition name="fc-splash">
    <div v-if="show" class="fc-splash">
      <div class="fc-splash-logo">
        <Zap :size="32" />
      </div>
      <h2>FamilyCo</h2>
      <p>AI-native operating system</p>
      <div class="fc-splash-bar">
        <div class="fc-splash-bar-fill"></div>
      </div>
    </div>
  </Transition>
</template>
