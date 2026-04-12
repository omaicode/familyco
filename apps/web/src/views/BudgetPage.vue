<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { RefreshCw, Wallet, AlertTriangle } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
const isRefreshing = ref(false);

const refresh = async () => {
  isRefreshing.value = true;
  try {
    await uiRuntime.stores.budget.load();
  } finally {
    isRefreshing.value = false;
  }
};

onMounted(() => {
  void uiRuntime.stores.budget.load();
});

const state = computed(() => uiRuntime.stores.budget.state);
const report = computed(() => state.value.data);

const maxDailyCost = computed(() => {
  const data = report.value?.dailyBreakdown ?? [];
  return data.reduce((max, item) => Math.max(max, item.estimatedCostUSD), 0);
});

const shouldShowWarning = computed(() => {
  const budget = report.value?.budget;
  if (!budget || budget.usedPercent === null) return false;
  return budget.usedPercent >= budget.alertThresholdPercent;
});

const warningText = computed(() => {
  const budget = report.value?.budget;
  if (!budget || budget.usedPercent === null) return '';
  const percent = String(budget.usedPercent);
  return budget.usedPercent >= 100
    ? t('budget.alert.over', { percent })
    : t('budget.alert.warn', { percent });
});

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatTokensK = (value: number): string => (value / 1000).toFixed(1);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Budget & Usage') }}</h3>
        <p>{{ t('Track AI token consumption and estimated spend for the current month.') }}</p>
      </div>
      <div class="fc-inline-actions">
        <RouterLink class="fc-btn-secondary" to="/settings">
          <Wallet :size="14" /> {{ t('Go to Budget settings') }}
        </RouterLink>
        <button class="fc-btn-primary" :disabled="isRefreshing" @click="refresh">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          {{ isRefreshing ? t('Refreshing…') : t('Refresh') }}
        </button>
      </div>
    </div>

    <div v-if="state.isLoading" class="fc-loading">
      <p style="margin:0 0 10px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading budget report…') }}</p>
      <SkeletonList />
    </div>

    <div v-else-if="state.errorMessage" class="fc-error">
      <p>{{ state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="refresh">{{ t('Retry') }}</button>
    </div>

    <template v-else-if="report">
      <div v-if="shouldShowWarning" class="fc-budget-alert">
        <AlertTriangle :size="16" />
        <span>{{ warningText }}</span>
      </div>

      <div class="fc-budget-grid">
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Estimated cost') }}</h4>
          <p class="fc-budget-metric">{{ formatCurrency(report.totals.estimatedCostUSD) }}</p>
          <p class="fc-card-desc">{{ t('Monthly period') }}</p>
        </article>
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Total tokens') }}</h4>
          <p class="fc-budget-metric">{{ report.totals.totalTokens.toLocaleString() }}</p>
          <p class="fc-card-desc">
            {{ t('Prompt tokens') }}: {{ report.totals.promptTokens.toLocaleString() }} ·
            {{ t('Completion tokens') }}: {{ report.totals.completionTokens.toLocaleString() }}
          </p>
        </article>
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('AI requests') }}</h4>
          <p class="fc-budget-metric">{{ report.totals.requestCount.toLocaleString() }}</p>
          <p class="fc-card-desc">{{ report.budget.enforceMode.toUpperCase() }} mode</p>
        </article>
      </div>

      <article class="fc-card" style="margin-top: 14px;">
        <h4 class="fc-card-title">{{ t('Monthly spend vs limit') }}</h4>
        <template v-if="report.budget.monthlyLimitUSD && report.budget.monthlyLimitUSD > 0">
          <p class="fc-card-desc">
            {{ formatCurrency(report.totals.estimatedCostUSD) }} / {{ formatCurrency(report.budget.monthlyLimitUSD) }}
            ({{ report.budget.usedPercent ?? 0 }}% {{ t('of limit') }})
          </p>
          <div class="fc-budget-progress">
            <div
              class="fc-budget-progress-fill"
              :style="{ width: `${Math.min(report.budget.usedPercent ?? 0, 100)}%` }"
            />
          </div>
        </template>
        <template v-else>
          <p class="fc-card-desc">{{ t('No budget limit set') }}</p>
          <p class="fc-card-desc">{{ t('Set a limit in Settings → Budget to track spend.') }}</p>
        </template>
      </article>

      <div class="fc-budget-split">
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Usage by adapter') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Adapter') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Total tokens (K)') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.byAdapter" :key="row.adapterId">
                <td>{{ row.adapterId }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatTokensK(row.totalTokens) }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.byAdapter.length === 0">
                <td colspan="4">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Daily usage — current month') }}</h4>
          <div v-if="report.dailyBreakdown.length > 0" class="fc-budget-bars">
            <div v-for="entry in report.dailyBreakdown" :key="entry.date" class="fc-budget-bar-row">
              <span class="fc-budget-bar-date">{{ entry.date.slice(5) }}</span>
              <div class="fc-budget-bar-track">
                <div
                  class="fc-budget-bar-fill"
                  :style="{ width: `${maxDailyCost === 0 ? 0 : (entry.estimatedCostUSD / maxDailyCost) * 100}%` }"
                />
              </div>
              <span class="fc-budget-bar-value">{{ formatCurrency(entry.estimatedCostUSD) }}</span>
            </div>
          </div>
        </article>
      </div>

      <div class="fc-budget-split" style="margin-top: 14px;">
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Usage by model') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Model') }}</th>
                <th>{{ t('Provider') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.byModel" :key="`${row.provider}-${row.model}`">
                <td>{{ row.model }}</td>
                <td>{{ row.provider }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.byModel.length === 0">
                <td colspan="4">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Top costly runs') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Run') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Total tokens (K)') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.byRun.slice(0, 10)" :key="row.runId">
                <td>{{ row.runId }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatTokensK(row.totalTokens) }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.byRun.length === 0">
                <td colspan="4">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </div>

      <div class="fc-budget-split" style="margin-top: 14px;">
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Weekly usage') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Week') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.byWeek" :key="row.bucket">
                <td>{{ row.bucket }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.byWeek.length === 0">
                <td colspan="3">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Monthly usage') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Month') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.byMonth" :key="row.bucket">
                <td>{{ row.bucket }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.byMonth.length === 0">
                <td colspan="3">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </div>

      <div class="fc-budget-split" style="margin-top: 14px;">
        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Top costly agents') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Agent') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.topCostlyAgents" :key="row.entityId">
                <td>{{ row.entityId }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.topCostlyAgents.length === 0">
                <td colspan="3">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="fc-card">
          <h4 class="fc-card-title">{{ t('Top costly projects') }}</h4>
          <table class="fc-budget-table">
            <thead>
              <tr>
                <th>{{ t('Project') }}</th>
                <th>{{ t('Requests') }}</th>
                <th>{{ t('Est. cost (USD)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.topCostlyProjects" :key="row.entityId">
                <td>{{ row.entityId }}</td>
                <td>{{ row.requestCount }}</td>
                <td>{{ formatCurrency(row.estimatedCostUSD) }}</td>
              </tr>
              <tr v-if="report.topCostlyProjects.length === 0">
                <td colspan="3">{{ t('No data yet') }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </div>

      <div v-if="state.isEmpty" class="fc-empty" style="margin-top: 14px;">
        <Wallet :size="22" class="fc-empty-icon" />
        <h4>{{ t('No data yet') }}</h4>
        <p>{{ t('No AI requests have been tracked this month.') }}</p>
      </div>
    </template>
  </section>
</template>
