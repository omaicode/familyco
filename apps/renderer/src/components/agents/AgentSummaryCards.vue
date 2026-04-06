<script setup lang="ts">
defineProps<{
  metrics: {
    total: number;
    active: number;
    paused: number;
    leads: number;
    readiness: number;
  };
  attentionSummary: {
    paused: number;
    missingManager: number;
  };
}>();
</script>

<template>
  <div class="fc-grid-kpi">
    <div class="fc-kpi-card" data-highlight="primary">
      <p class="fc-kpi-label">Headcount</p>
      <p class="fc-kpi-value">{{ metrics.total }}</p>
      <p class="fc-kpi-sub">Total agents in the control plane</p>
    </div>

    <div class="fc-kpi-card" data-highlight="success">
      <p class="fc-kpi-label">Active now</p>
      <p class="fc-kpi-value">{{ metrics.active }}</p>
      <p class="fc-kpi-sub">{{ metrics.paused }} paused and awaiting attention</p>
    </div>

    <div class="fc-kpi-card" data-highlight="info">
      <p class="fc-kpi-label">Leads in place</p>
      <p class="fc-kpi-value">{{ metrics.leads }}</p>
      <p class="fc-kpi-sub">Executive and department coverage</p>
    </div>

    <div
      class="fc-kpi-card"
      :data-highlight="attentionSummary.paused || attentionSummary.missingManager ? 'warning' : 'success'"
    >
      <p class="fc-kpi-label">Deploy-ready</p>
      <p class="fc-kpi-value">{{ metrics.readiness }}%</p>
      <p class="fc-kpi-sub">Agents with a clear reporting line</p>
    </div>
  </div>
</template>
