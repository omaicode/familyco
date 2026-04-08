<script setup lang="ts">
import FamilyCoIcon from '../assets/familyco-icon.svg';

defineProps<{
  show: boolean;
}>();
</script>

<template>
  <Transition name="fc-splash">
    <div v-if="show" class="fc-splash">
      <div class="fc-splash-logo">
        <FamilyCoIcon/>
      </div>
      <h2>FamilyCo</h2>
      <p>AI-native operating system</p>
      <div class="fc-splash-bar">
        <div class="fc-splash-bar-fill"></div>
      </div>
    </div>
  </Transition>
</template>
