<script setup lang="ts">
import { computed, ref } from 'vue';
import { Activity, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, X, Zap } from 'lucide-vue-next';

import { translate } from '@familyco/ui';

import { uiRuntime } from '../runtime';
import { useAgentActivity, type ActiveAgentRun, type AgentRunStatus } from '../composables/useAgentActivity';

const { runs, activeCount } = useAgentActivity();

const isOpen = ref(false);
const t = (key: string, params?: Record<string, string | number>): string =>
  translate(uiRuntime.stores.app.state.locale, key, params);

const hasActivity = computed(() => runs.value.length > 0);

function statusIcon(status: AgentRunStatus) {
  if (status === 'active') return Zap;
  if (status === 'completed') return CheckCircle2;
  if (status === 'failed') return XCircle;
  return Clock;
}

function statusClass(status: AgentRunStatus): string {
  if (status === 'active') return 'fc-activity-run--active';
  if (status === 'completed') return 'fc-activity-run--completed';
  if (status === 'failed') return 'fc-activity-run--failed';
  return 'fc-activity-run--waiting';
}

function statusLabel(status: AgentRunStatus): string {
  const map: Record<AgentRunStatus, string> = {
    active: t('activity.widget.run.started'),
    completed: t('activity.widget.run.completed'),
    failed: t('activity.widget.run.failed'),
    waiting_approval: t('activity.widget.run.waiting_approval'),
    waiting_input: t('activity.widget.run.waiting_input')
  };
  return map[status] ?? status;
}

function lastStep(run: ActiveAgentRun): string | null {
  const step = run.steps[run.steps.length - 1];
  if (!step) return null;
  return t('activity.widget.tool', { tool: step.toolName });
}

function elapsedSeconds(run: ActiveAgentRun): string {
  const ref = run.endedAt ?? run.startedAt;
  const diff = Math.round((Date.now() - Date.parse(ref)) / 1000);
  return t('activity.widget.elapsed', { seconds: diff });
}
</script>

<template>
  <div class="fc-activity-widget" :class="{ 'fc-activity-widget--open': isOpen }">
    <!-- Expandable panel -->
    <Transition name="fc-activity-panel">
      <div v-if="isOpen" class="fc-activity-panel" role="dialog" :aria-label="t('activity.widget.title')">
        <!-- Header -->
        <div class="fc-activity-panel__header">
          <Activity :size="15" />
          <span>{{ t('activity.widget.title') }}</span>
          <button
            class="fc-activity-panel__close"
            :aria-label="t('activity.widget.close')"
            @click="isOpen = false"
          >
            <X :size="14" />
          </button>
        </div>

        <!-- Run list -->
        <div class="fc-activity-panel__body">
          <p v-if="!hasActivity" class="fc-activity-empty">
            {{ t('activity.widget.empty') }}
          </p>

          <div
            v-for="run in runs"
            :key="run.sessionId"
            class="fc-activity-run"
            :class="statusClass(run.status)"
          >
            <div class="fc-activity-run__meta">
              <component :is="statusIcon(run.status)" :size="13" class="fc-activity-run__icon" />
              <span class="fc-activity-run__agent">{{ run.agentName }}</span>
              <span class="fc-activity-run__status">{{ statusLabel(run.status) }}</span>
              <span class="fc-activity-run__elapsed">{{ elapsedSeconds(run) }}</span>
            </div>
            <p class="fc-activity-run__task">{{ run.taskTitle }}</p>
            <p v-if="run.status === 'active' && lastStep(run)" class="fc-activity-run__tool">
              {{ lastStep(run) }}
            </p>
            <p v-if="run.status === 'failed' && run.error" class="fc-activity-run__error">
              {{ run.error }}
            </p>
            <p v-if="(run.status === 'completed' || run.status === 'waiting_approval' || run.status === 'waiting_input') && run.summary" class="fc-activity-run__summary">
              {{ run.summary }}
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Trigger button -->
    <button
      class="fc-activity-trigger"
      :class="{ 'fc-activity-trigger--pulsing': activeCount > 0 }"
      :aria-label="t('activity.widget.title')"
      @click="isOpen = !isOpen"
    >
      <Activity :size="18" />
      <span v-if="activeCount > 0" class="fc-activity-badge">{{ activeCount }}</span>
      <component :is="isOpen ? ChevronUp : ChevronDown" :size="12" class="fc-activity-trigger__chevron" />
    </button>
  </div>
</template>

<style scoped>
/* ── Widget container ─────────────────────────────────── */
.fc-activity-widget {
  --fc-activity-bg: var(--fc-primary, #127A70);
  --fc-activity-bg-hover: var(--fc-primary-hover, #0f6a61);
  --fc-activity-fg: var(--fc-primary-foreground, #f5fffd);
  --fc-activity-fg-muted: color-mix(in srgb, var(--fc-activity-fg) 72%, transparent);
  --fc-activity-fg-soft: color-mix(in srgb, var(--fc-activity-fg) 86%, transparent);
  --fc-activity-border: color-mix(in srgb, var(--fc-activity-fg) 16%, var(--fc-activity-bg) 84%);
  --fc-activity-border-strong: color-mix(in srgb, var(--fc-activity-fg) 24%, var(--fc-activity-bg) 76%);
  --fc-activity-surface: color-mix(in srgb, var(--fc-activity-fg) 8%, var(--fc-activity-bg) 92%);
  --fc-activity-surface-hover: color-mix(in srgb, var(--fc-activity-fg) 12%, var(--fc-activity-bg) 88%);
  --fc-activity-shadow: 0 18px 42px -24px color-mix(in srgb, black 72%, var(--fc-activity-bg) 28%);
  display: inline-flex;
  align-items: flex-end;
  position: relative;
}

/* ── Trigger button ───────────────────────────────────── */
.fc-activity-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  background: var(--fc-activity-bg);
  color: var(--fc-activity-fg);
  border: 1px solid var(--fc-activity-border);
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  box-shadow: var(--fc-activity-shadow);
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  position: relative;
}

.fc-activity-trigger:hover {
  background: var(--fc-activity-bg-hover);
  border-color: var(--fc-activity-border-strong);
  box-shadow: 0 22px 44px -26px color-mix(in srgb, black 74%, var(--fc-activity-bg) 26%);
}

.fc-activity-trigger--pulsing {
  border-color: color-mix(in srgb, var(--fc-activity-fg) 34%, var(--fc-activity-bg) 66%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--fc-activity-fg) 8%, transparent), var(--fc-activity-shadow);
  animation: fc-activity-pulse 2s ease infinite;
}

.fc-activity-trigger__chevron {
  opacity: 0.72;
}

/* ── Active badge ─────────────────────────────────────── */
.fc-activity-badge {
  background: color-mix(in srgb, var(--fc-activity-fg) 92%, var(--fc-activity-bg) 8%);
  color: var(--fc-activity-bg);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.4;
  min-width: 18px;
  text-align: center;
}

/* ── Panel ────────────────────────────────────────────── */
.fc-activity-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 320px;
  max-height: 420px;
  background: var(--fc-activity-bg);
  border: 1px solid var(--fc-activity-border);
  border-radius: 12px;
  box-shadow: 0 28px 56px -28px color-mix(in srgb, black 74%, var(--fc-activity-bg) 26%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fc-activity-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--fc-activity-border);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--fc-activity-fg);
}

.fc-activity-panel__header span {
  flex: 1;
}

.fc-activity-panel__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fc-activity-fg-muted);
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}

.fc-activity-panel__close:hover {
  color: var(--fc-activity-fg);
  background: color-mix(in srgb, var(--fc-activity-fg) 10%, transparent);
}

.fc-activity-panel__body {
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

/* ── Empty state ─────────────────────────────────────── */
.fc-activity-empty {
  font-size: 0.8rem;
  color: var(--fc-activity-fg-muted);
  text-align: center;
  padding: 24px 16px;
}

/* ── Run item ─────────────────────────────────────────── */
.fc-activity-run {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--fc-activity-border);
  background: var(--fc-activity-surface);
  font-size: 0.8rem;
}

.fc-activity-run--active {
  background: color-mix(in srgb, var(--fc-info, #6bb7ff) 14%, var(--fc-activity-bg) 86%);
  border-color: color-mix(in srgb, var(--fc-info, #6bb7ff) 32%, var(--fc-activity-bg) 68%);
}

.fc-activity-run--completed {
  background: color-mix(in srgb, var(--fc-success, #6fd09c) 14%, var(--fc-activity-bg) 86%);
  border-color: color-mix(in srgb, var(--fc-success, #6fd09c) 28%, var(--fc-activity-bg) 72%);
}

.fc-activity-run--failed {
  background: color-mix(in srgb, var(--fc-error, #ff7d91) 14%, var(--fc-activity-bg) 86%);
  border-color: color-mix(in srgb, var(--fc-error, #ff7d91) 28%, var(--fc-activity-bg) 72%);
}

.fc-activity-run--waiting {
  background: color-mix(in srgb, var(--fc-warning, #ffd17f) 16%, var(--fc-activity-bg) 84%);
  border-color: color-mix(in srgb, var(--fc-warning, #ffd17f) 30%, var(--fc-activity-bg) 70%);
}

.fc-activity-run__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
}

.fc-activity-run__icon {
  flex-shrink: 0;
}

.fc-activity-run--active .fc-activity-run__icon {
  color: color-mix(in srgb, var(--fc-info, #6bb7ff) 86%, white 14%);
  animation: fc-activity-pulse 1.6s ease infinite;
}

.fc-activity-run--completed .fc-activity-run__icon {
  color: color-mix(in srgb, var(--fc-success, #6fd09c) 88%, white 12%);
}

.fc-activity-run--failed .fc-activity-run__icon {
  color: color-mix(in srgb, var(--fc-error, #ff7d91) 88%, white 12%);
}

.fc-activity-run--waiting .fc-activity-run__icon {
  color: color-mix(in srgb, var(--fc-warning, #ffd17f) 92%, white 8%);
}

.fc-activity-run__agent {
  font-weight: 600;
  color: var(--fc-activity-fg);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fc-activity-run__status {
  font-size: 0.7rem;
  color: var(--fc-activity-fg-muted);
  white-space: nowrap;
}

.fc-activity-run__elapsed {
  font-size: 0.7rem;
  color: var(--fc-activity-fg-muted);
  white-space: nowrap;
}

.fc-activity-run__task {
  color: var(--fc-activity-fg-soft);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fc-activity-run__tool {
  color: color-mix(in srgb, var(--fc-info, #6bb7ff) 88%, white 12%);
  margin: 3px 0 0;
  font-size: 0.75rem;
  opacity: 0.95;
}

.fc-activity-run__error {
  color: color-mix(in srgb, var(--fc-error, #ff7d91) 90%, white 10%);
  margin: 3px 0 0;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fc-activity-run__summary {
  color: var(--fc-activity-fg-soft);
  margin: 4px 0 0;
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  line-clamp: 4;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Panel transition ─────────────────────────────────── */
.fc-activity-panel-enter-active {
  animation: fc-activity-panel-in 0.2s ease;
}

.fc-activity-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fc-activity-panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@keyframes fc-activity-panel-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fc-activity-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
</style>
