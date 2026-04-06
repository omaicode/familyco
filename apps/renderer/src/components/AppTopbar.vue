<script setup lang="ts">
import { Menu, X } from 'lucide-vue-next';

const props = defineProps<{
  mobileMenuOpen: boolean;
  pageTitle: string;
  serverReachable: boolean;
  connectionLabel: string;
}>();

const emit = defineEmits<{
  toggleMobile: [];
}>();
</script>

<template>
  <header class="fc-topbar">
    <div class="fc-topbar-left">
      <button class="fc-hamburger" aria-label="Toggle menu" @click="emit('toggleMobile')">
        <component :is="props.mobileMenuOpen ? X : Menu" :size="18" />
      </button>
      <h2 class="fc-topbar-title">{{ props.pageTitle }}</h2>
    </div>

    <div class="fc-topbar-right">
      <!-- Connection status -->
      <div class="fc-connection-dot" :data-online="props.serverReachable">
        <span class="fc-dot-label">{{ props.connectionLabel }}</span>
      </div>
      <!-- Avatar -->
      <div class="fc-avatar" title="Founder">F</div>
    </div>
  </header>
</template>
