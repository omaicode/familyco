<template>
  <div class="fc-skeleton-wrap">
    <div v-for="(w, index) in ['85%', '60%', '75%', '50%', '68%']" :key="index" class="fc-skeleton-row" :style="{ width: w }"></div>
  </div>
</template>
