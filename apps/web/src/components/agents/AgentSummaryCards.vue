<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';

defineProps<{
  metrics: {
    total: number;
    heartbeatReady: number;
    running: number;
    attention: number;
    leads: number;
    readiness: number;
  };
  attentionSummary: {
    paused: number;
    error: number;
    terminated: number;
    missingManager: number;
  };
}>();

const { t } = useI18n();
</script>

<template>
  <div class="fc-grid-kpi">
    <div class="fc-kpi-card" data-highlight="primary">
      <p class="fc-kpi-label">{{ t('Headcount') }}</p>
      <p class="fc-kpi-value">{{ metrics.total }}</p>
      <p class="fc-kpi-sub">{{ t('Total agents in the control plane') }}</p>
    </div>

    <div class="fc-kpi-card" data-highlight="success">
      <p class="fc-kpi-label">{{ t('Heartbeat-ready') }}</p>
      <p class="fc-kpi-value">{{ metrics.heartbeatReady }}</p>
      <p class="fc-kpi-sub">
        {{ t('Heartbeat summary', { running: metrics.running, attention: metrics.attention }) }}
      </p>
    </div>

    <div class="fc-kpi-card" data-highlight="info">
      <p class="fc-kpi-label">{{ t('Leads in place') }}</p>
      <p class="fc-kpi-value">{{ metrics.leads }}</p>
      <p class="fc-kpi-sub">{{ t('Executive and department coverage') }}</p>
    </div>

    <div
      class="fc-kpi-card"
      :data-highlight="attentionSummary.error || attentionSummary.paused || attentionSummary.missingManager ? 'warning' : 'success'"
    >
      <p class="fc-kpi-label">{{ t('Org mapped') }}</p>
      <p class="fc-kpi-value">{{ metrics.readiness }}%</p>
      <p class="fc-kpi-sub">
        {{
          attentionSummary.missingManager > 0
            ? t('Manager assignment summary', { count: attentionSummary.missingManager })
            : t('Reporting lines are clear across the active org.')
        }}
      </p>
    </div>
  </div>
</template>
