import { computed, onBeforeUnmount, ref } from 'vue';

import { subscribeEventsStream } from './useEventsSocket';

export type AgentRunStatus =
  | 'active'
  | 'completed'
  | 'failed'
  | 'waiting_approval'
  | 'waiting_input';

export interface AgentRunStep {
  step: number;
  toolName: string;
  summary: string;
  at: string;
}

export interface ActiveAgentRun {
  sessionId: string;
  agentId: string;
  agentName: string;
  taskId: string;
  taskTitle: string;
  status: AgentRunStatus;
  steps: AgentRunStep[];
  startedAt: string;
  endedAt?: string;
  summary?: string;
  error?: string;
}

const MAX_COMPLETED_RETAIN_MS = 30_000;
const MAX_RUNS = 20;

const runs = ref<ActiveAgentRun[]>([]);
let purgeTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let unsubscribeEvents: (() => void) | null = null;

function upsertRun(patch: Partial<ActiveAgentRun> & { sessionId: string }): void {
  const idx = runs.value.findIndex((r) => r.sessionId === patch.sessionId);
  if (idx === -1) {
    runs.value = [
      ...runs.value,
      {
        sessionId: patch.sessionId,
        agentId: patch.agentId ?? '',
        agentName: patch.agentName ?? '',
        taskId: patch.taskId ?? '',
        taskTitle: patch.taskTitle ?? '',
        status: patch.status ?? 'active',
        steps: patch.steps ?? [],
        startedAt: patch.startedAt ?? new Date().toISOString(),
        endedAt: patch.endedAt,
        summary: patch.summary,
        error: patch.error
      }
    ].slice(-MAX_RUNS);
    return;
  }

  runs.value = runs.value.map((r, i) => (i === idx ? { ...r, ...patch } : r));
}

function handleEventMessage(data: { type?: string; payload?: unknown }): void {
  if (!data.payload || typeof data.payload !== 'object') {
    return;
  }

  const p = data.payload as Record<string, unknown>;

  if (data.type === 'agent.run.started') {
    upsertRun({
      sessionId: String(p.sessionId ?? ''),
      agentId: String(p.agentId ?? ''),
      agentName: String(p.agentName ?? ''),
      taskId: String(p.taskId ?? ''),
      taskTitle: String(p.taskTitle ?? ''),
      status: 'active',
      steps: [],
      startedAt: new Date().toISOString()
    });
    return;
  }

  if (data.type === 'agent.run.step') {
    const sessionId = String(p.sessionId ?? '');
    const run = runs.value.find((r) => r.sessionId === sessionId);
    const newStep: AgentRunStep = {
      step: typeof p.step === 'number' ? p.step : (run?.steps.length ?? 0) + 1,
      toolName: String(p.toolName ?? ''),
      summary: String(p.summary ?? ''),
      at: new Date().toISOString()
    };
    upsertRun({
      sessionId,
      agentId: String(p.agentId ?? run?.agentId ?? ''),
      agentName: String(p.agentName ?? run?.agentName ?? ''),
      status: 'active',
      steps: [...(run?.steps ?? []), newStep]
    });
    return;
  }

  if (data.type === 'agent.run.completed') {
    const sessionId = String(p.sessionId ?? '');
    const rawStatus = String(p.status ?? 'completed');
    const status: AgentRunStatus =
      rawStatus === 'waiting_for_approval'
        ? 'waiting_approval'
        : rawStatus === 'waiting_for_input'
          ? 'waiting_input'
          : rawStatus === 'failed'
            ? 'failed'
            : 'completed';
    upsertRun({
      sessionId,
      agentId: String(p.agentId ?? ''),
      agentName: String(p.agentName ?? runs.value.find((r) => r.sessionId === sessionId)?.agentName ?? ''),
      status,
      endedAt: new Date().toISOString(),
      summary: String(p.summary ?? '')
    });
    return;
  }

  if (data.type === 'agent.run.failed') {
    upsertRun({
      sessionId: String(p.sessionId ?? ''),
      agentId: String(p.agentId ?? ''),
      agentName: String(p.agentName ?? runs.value.find((r) => r.sessionId === String(p.sessionId ?? ''))?.agentName ?? ''),
      status: 'failed',
      endedAt: new Date().toISOString(),
      error: String(p.error ?? 'Unknown error')
    });
  }
}

function startPurge(): void {
  if (purgeTimer) {
    return;
  }

  purgeTimer = setInterval(() => {
    const cutoff = Date.now() - MAX_COMPLETED_RETAIN_MS;
    runs.value = runs.value.filter((r) => {
      if (r.status === 'active') return true;
      if (!r.endedAt) return true;
      return Date.parse(r.endedAt) > cutoff;
    });
  }, 5_000);
}

function stopPurge(): void {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}

export function useAgentActivity() {
  refCount += 1;
  if (refCount === 1) {
    unsubscribeEvents = subscribeEventsStream(handleEventMessage);
    startPurge();
  }

  onBeforeUnmount(() => {
    refCount -= 1;
    if (refCount <= 0) {
      refCount = 0;
      unsubscribeEvents?.();
      unsubscribeEvents = null;
      stopPurge();
    }
  });

  const activeRuns = computed(() => runs.value.filter((r) => r.status === 'active'));
  const recentRuns = computed(() => runs.value.filter((r) => r.status !== 'active'));
  const activeCount = computed(() => activeRuns.value.length);
  const allRuns = computed(() => [...runs.value].reverse());

  return { runs: allRuns, activeRuns, recentRuns, activeCount };
}
