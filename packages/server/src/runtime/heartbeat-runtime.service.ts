import type {
  AgentRunRequest,
  AgentRunResult,
  AgentService,
  QueueService,
  SettingsService
} from '@familyco/core';
import { renderHeartbeatRunPrompt } from '../prompts/index.js';
import type { SkillsService } from '../modules/skills/skills.service.js';

const DEFAULT_HEARTBEAT_MINUTES = 60;
const DEFAULT_POLL_MS = 30_000;
const DEFAULT_RUN_HISTORY_LIMIT = 20;

type HeartbeatRunStatus = 'queued' | 'running' | 'completed' | 'blocked' | 'failed';

export interface AgentHeartbeatState {
  inFlight: boolean;
  lastStatus?: HeartbeatRunStatus;
  lastScheduledAt?: string;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  nextHeartbeatAt?: string;
  lastError?: string;
  lastAction?: string;
  lastToolName?: string;
  inputPreview?: string;
}

export interface AgentHeartbeatRunRecord {
  id: string;
  agentId: string;
  status: Exclude<HeartbeatRunStatus, 'queued' | 'running'>;
  action: string;
  toolName: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt: string;
  summary: string;
  error?: string;
}

export interface HeartbeatRuntimeOptions {
  queueService: QueueService;
  agentService: AgentService;
  settingsService: SettingsService;
  skillsService?: SkillsService;
  pollMs?: number;
  defaultHeartbeatMinutes?: number;
}

export class HeartbeatRuntimeService {
  private timer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  constructor(private readonly options: HeartbeatRuntimeOptions) {}

  async start(): Promise<void> {
    await this.ensureDefaults();

    if (this.timer) {
      return;
    }

    const pollMs = this.resolvePollMs();
    this.timer = setInterval(() => {
      void this.pollDueHeartbeats();
    }, pollMs);

    void this.pollDueHeartbeats();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollDueHeartbeats(now: Date = new Date()): Promise<void> {
    if (this.pollInFlight) {
      return;
    }

    this.pollInFlight = true;

    try {
      if (!(await this.isEnabled())) {
        return;
      }

      const intervalMs = await this.resolveHeartbeatIntervalMs();
      const agents = await this.options.agentService.listAgents();

      for (const agent of agents) {
        if (agent.status === 'paused' || agent.status === 'terminated') {
          continue;
        }

        const state = await this.getState(agent.id);
        if (state.inFlight) {
          if (this.isStaleInFlight(state, now, intervalMs)) {
            await this.options.agentService.setAgentStatus(agent.id, 'error');
            await this.writeState(agent.id, {
              ...state,
              inFlight: false,
              lastStatus: 'failed',
              lastCompletedAt: now.toISOString(),
              lastError: 'Heartbeat lease expired before completion and was recovered automatically.'
            });
          } else {
            continue;
          }
        }

        if (state.nextHeartbeatAt) {
          const nextRunAt = Date.parse(state.nextHeartbeatAt);
          if (Number.isFinite(nextRunAt) && nextRunAt > now.getTime()) {
            continue;
          }
        }

        const request: AgentRunRequest = {
          agentId: agent.id,
          approvalMode: 'auto',
          action: 'heartbeat.tick',
          toolName: 'task.log',
          toolArguments: {
            message: `Heartbeat check for ${agent.name} at ${now.toISOString()}`
          },
          input: renderHeartbeatRunPrompt({
            agentName: agent.name,
            agentRole: agent.role,
            agentDepartment: agent.department,
            skills: await this.resolveSkillsForAgent(agent),
            timestamp: now.toISOString()
          })
        };

        try {
          await this.markQueued(request, now, intervalMs);
          await this.options.queueService.enqueue({
            type: 'agent.run',
            payload: {
              request
            }
          });
        } catch (error) {
          await this.markFailed(request, toError(error), new Date());
        }
      }
    } finally {
      this.pollInFlight = false;
    }
  }

  async markQueued(
    request: AgentRunRequest,
    scheduledAt: Date = new Date(),
    intervalMs?: number
  ): Promise<void> {
    const previousState = await this.getState(request.agentId);
    const resolvedIntervalMs = intervalMs ?? (await this.resolveHeartbeatIntervalMs());

    await this.writeState(request.agentId, {
      ...previousState,
      inFlight: true,
      lastStatus: 'queued',
      lastScheduledAt: scheduledAt.toISOString(),
      nextHeartbeatAt: new Date(scheduledAt.getTime() + resolvedIntervalMs).toISOString(),
      lastError: undefined,
      lastAction: request.action,
      lastToolName: request.toolName,
      inputPreview: request.input.slice(0, 200)
    });
  }

  async markStarted(request: AgentRunRequest, startedAt: Date = new Date()): Promise<void> {
    await this.options.agentService.setAgentStatus(request.agentId, 'running');
    const previousState = await this.getState(request.agentId);

    await this.writeState(request.agentId, {
      ...previousState,
      inFlight: true,
      lastStatus: 'running',
      lastStartedAt: startedAt.toISOString(),
      lastAction: request.action,
      lastToolName: request.toolName,
      inputPreview: request.input.slice(0, 200)
    });
  }

  async markCompleted(
    request: AgentRunRequest,
    result: AgentRunResult,
    completedAt: Date = new Date()
  ): Promise<void> {
    await this.options.agentService.setAgentStatus(
      request.agentId,
      result.status === 'blocked' ? 'paused' : 'idle'
    );

    const previousState = await this.getState(request.agentId);
    await this.writeState(request.agentId, {
      ...previousState,
      inFlight: false,
      lastStatus: result.status,
      lastCompletedAt: completedAt.toISOString(),
      lastError: undefined,
      lastAction: request.action,
      lastToolName: request.toolName
    });

    await this.appendRunRecord(request.agentId, {
      id: `heartbeat-${request.agentId}-${completedAt.getTime()}`,
      agentId: request.agentId,
      status: result.status,
      action: request.action,
      toolName: request.toolName,
      scheduledAt: previousState.lastScheduledAt,
      startedAt: previousState.lastStartedAt,
      completedAt: completedAt.toISOString(),
      summary:
        result.status === 'blocked'
          ? result.reason ?? 'Heartbeat blocked pending approval'
          : `Heartbeat completed via ${request.toolName}`
    });
  }

  async markFailed(
    request: AgentRunRequest,
    error: Error,
    completedAt: Date = new Date()
  ): Promise<void> {
    await this.options.agentService.setAgentStatus(request.agentId, 'error');
    const previousState = await this.getState(request.agentId);

    await this.writeState(request.agentId, {
      ...previousState,
      inFlight: false,
      lastStatus: 'failed',
      lastCompletedAt: completedAt.toISOString(),
      lastError: error.message,
      lastAction: request.action,
      lastToolName: request.toolName
    });

    await this.appendRunRecord(request.agentId, {
      id: `heartbeat-${request.agentId}-${completedAt.getTime()}`,
      agentId: request.agentId,
      status: 'failed',
      action: request.action,
      toolName: request.toolName,
      scheduledAt: previousState.lastScheduledAt,
      startedAt: previousState.lastStartedAt,
      completedAt: completedAt.toISOString(),
      summary: error.message,
      error: error.message
    });
  }

  async getState(agentId: string): Promise<AgentHeartbeatState> {
    const setting = await this.options.settingsService.get(this.toStateKey(agentId));
    const value = setting?.value;

    if (!isRecord(value)) {
      return {
        inFlight: false
      };
    }

    return {
      inFlight: value.inFlight === true,
      lastStatus: asHeartbeatRunStatus(value.lastStatus),
      lastScheduledAt: asOptionalString(value.lastScheduledAt),
      lastStartedAt: asOptionalString(value.lastStartedAt),
      lastCompletedAt: asOptionalString(value.lastCompletedAt),
      nextHeartbeatAt: asOptionalString(value.nextHeartbeatAt),
      lastError: asOptionalString(value.lastError),
      lastAction: asOptionalString(value.lastAction),
      lastToolName: asOptionalString(value.lastToolName),
      inputPreview: asOptionalString(value.inputPreview)
    };
  }

  private async appendRunRecord(agentId: string, record: AgentHeartbeatRunRecord): Promise<void> {
    const setting = await this.options.settingsService.get(this.toRunHistoryKey(agentId));
    const current = Array.isArray(setting?.value)
      ? setting?.value.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];

    const nextValue = [...current, record].slice(-DEFAULT_RUN_HISTORY_LIMIT);
    await this.options.settingsService.upsert({
      key: this.toRunHistoryKey(agentId),
      value: nextValue
    });
  }

  private async writeState(agentId: string, state: AgentHeartbeatState): Promise<void> {
    await this.options.settingsService.upsert({
      key: this.toStateKey(agentId),
      value: state
    });
  }

  private async ensureDefaults(): Promise<void> {
    const enabled = await this.options.settingsService.get('agent.heartbeat.enabled');
    if (enabled === null) {
      await this.options.settingsService.upsert({
        key: 'agent.heartbeat.enabled',
        value: true
      });
    }

    const interval = await this.options.settingsService.get('agent.defaultHeartbeatMinutes');
    if (interval === null) {
      await this.options.settingsService.upsert({
        key: 'agent.defaultHeartbeatMinutes',
        value: this.options.defaultHeartbeatMinutes ?? DEFAULT_HEARTBEAT_MINUTES
      });
    }
  }

  private async isEnabled(): Promise<boolean> {
    const setting = await this.options.settingsService.get('agent.heartbeat.enabled');
    if (typeof setting?.value === 'boolean') {
      return setting.value;
    }

    if (typeof setting?.value === 'string') {
      return setting.value !== '0' && setting.value.toLowerCase() !== 'false';
    }

    return true;
  }

  private async resolveSkillsForAgent(agent: { id: string; name: string; level: string }) {
    if (!this.options.skillsService) {
      return [];
    }

    return this.options.skillsService.listForAgent({
      level: agent.level,
      id: agent.id,
      name: agent.name
    });
  }

  private async resolveHeartbeatIntervalMs(): Promise<number> {
    const setting = await this.options.settingsService.get('agent.defaultHeartbeatMinutes');
    const rawValue =
      typeof setting?.value === 'number'
        ? setting.value
        : typeof setting?.value === 'string'
          ? Number(setting.value)
          : this.options.defaultHeartbeatMinutes ?? DEFAULT_HEARTBEAT_MINUTES;

    const minutes = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_HEARTBEAT_MINUTES;
    return Math.max(1_000, Math.round(minutes * 60_000));
  }

  private resolvePollMs(): number {
    const rawValue =
      this.options.pollMs ?? Number(process.env.AGENT_HEARTBEAT_POLL_MS ?? DEFAULT_POLL_MS);

    return Number.isFinite(rawValue) && rawValue >= 25 ? rawValue : DEFAULT_POLL_MS;
  }

  private isStaleInFlight(state: AgentHeartbeatState, now: Date, intervalMs: number): boolean {
    const reference = state.lastStartedAt ?? state.lastScheduledAt;
    if (!reference) {
      return true;
    }

    const referenceTime = Date.parse(reference);
    if (!Number.isFinite(referenceTime)) {
      return true;
    }

    const staleAfterMs = Math.max(intervalMs * 2, 5 * 60_000);
    return now.getTime() - referenceTime >= staleAfterMs;
  }

  private toStateKey(agentId: string): string {
    return `agent.heartbeat.state.${agentId}`;
  }

  private toRunHistoryKey(agentId: string): string {
    return `agent.heartbeat.runs.${agentId}`;
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asHeartbeatRunStatus(value: unknown): HeartbeatRunStatus | undefined {
  return value === 'queued' || value === 'running' || value === 'completed' || value === 'blocked' || value === 'failed'
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
