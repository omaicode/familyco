import { randomUUID } from 'node:crypto';

import type {
  CronJob,
  CronRunRecord,
  CreateCronJobInput,
  RecordCronRunInput,
  UpdateCronJobInput
} from './cron.types.js';
import type { CronRepository } from './cron.repository.js';

interface ParsedCronSchedule {
  minute: CronFieldMatcher;
  hour: CronFieldMatcher;
  dayOfMonth: CronFieldMatcher;
  month: CronFieldMatcher;
  dayOfWeek: CronFieldMatcher;
}

interface CronFieldMatcher {
  matches(value: number): boolean;
}

class SetMatcher implements CronFieldMatcher {
  constructor(private readonly accepted: Set<number>) {}

  matches(value: number): boolean {
    return this.accepted.has(value);
  }
}

export class CronService {
  constructor(private readonly repository: CronRepository) {}

  async listJobs(): Promise<CronJob[]> {
    const jobs = await this.repository.listJobs();
    return jobs.sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1));
  }

  async getJobById(id: string): Promise<CronJob | null> {
    return this.repository.findJobById(id);
  }

  async listDueJobs(now: Date): Promise<CronJob[]> {
    const nowIso = now.toISOString();
    const jobs = await this.repository.listJobs();
    return jobs.filter((job) => {
      if (!job.enabled) {
        return false;
      }
      return !job.nextRunAt || job.nextRunAt <= nowIso;
    });
  }

  async createJob(input: CreateCronJobInput): Promise<CronJob> {
    const now = new Date();
    const parsedSchedule = parseCronSchedule(input.schedule);
    return this.repository.createJob({
      id: randomUUID(),
      name: normalizeName(input.name),
      prompt: normalizePrompt(input.prompt),
      schedule: normalizeSchedule(input.schedule),
      agentId: input.agentId,
      enabled: input.enabled ?? true,
      sessionId: null,
      lastRunAt: null,
      nextRunAt: nextRunAtIso(parsedSchedule, now)
    });
  }

  async updateJob(id: string, input: UpdateCronJobInput): Promise<CronJob> {
    const current = await this.repository.findJobById(id);
    if (!current) {
      throw new Error(`CRON_NOT_FOUND:${id}`);
    }

    const now = new Date();
    const nextName = input.name !== undefined ? normalizeName(input.name) : current.name;
    const nextPrompt = input.prompt !== undefined ? normalizePrompt(input.prompt) : current.prompt;
    const nextScheduleRaw = input.schedule !== undefined ? normalizeSchedule(input.schedule) : current.schedule;
    const nextSchedule = parseCronSchedule(nextScheduleRaw);
    const nextEnabled = input.enabled ?? current.enabled;
    const shouldRecalculateNextRun = input.schedule !== undefined || input.enabled !== undefined;

    return this.repository.updateJob(id, {
      name: nextName,
      prompt: nextPrompt,
      schedule: nextScheduleRaw,
      enabled: nextEnabled,
      sessionId: input.sessionId !== undefined ? input.sessionId : current.sessionId,
      agentId: input.agentId ?? current.agentId,
      nextRunAt: shouldRecalculateNextRun
        ? (nextEnabled ? nextRunAtIso(nextSchedule, now) : null)
        : current.nextRunAt
    });
  }

  async markRunScheduled(jobId: string, completedAt: Date): Promise<CronJob> {
    const current = await this.repository.findJobById(jobId);
    if (!current) {
      throw new Error(`CRON_NOT_FOUND:${jobId}`);
    }

    const schedule = parseCronSchedule(current.schedule);
    return this.repository.updateJob(jobId, {
      lastRunAt: completedAt.toISOString(),
      nextRunAt: current.enabled ? nextRunAtIso(schedule, completedAt) : null
    });
  }

  async setJobSession(jobId: string, sessionId: string): Promise<CronJob> {
    return this.repository.updateJob(jobId, { sessionId });
  }

  async deleteJob(id: string): Promise<{ id: string }> {
    const existing = await this.repository.findJobById(id);
    if (!existing) {
      throw new Error(`CRON_NOT_FOUND:${id}`);
    }

    await this.repository.deleteJob(id);
    return { id };
  }

  async listRuns(cronId: string, limit = 50): Promise<CronRunRecord[]> {
    return this.repository.listRuns(cronId, Math.max(1, Math.min(200, limit)));
  }

  async recordRun(input: RecordCronRunInput): Promise<CronRunRecord> {
    return this.repository.createRun({
      cronId: input.cronId,
      status: input.status,
      scheduledAt: input.scheduledAt.toISOString(),
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.finishedAt.toISOString(),
      input: input.input,
      ...(input.output ? { output: input.output } : {}),
      ...(input.error ? { error: input.error } : {})
    });
  }

  parseSchedule(schedule: string): void {
    parseCronSchedule(schedule);
  }
}

function normalizeName(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('CRON_INVALID_NAME');
  }
  return normalized.length > 120 ? normalized.slice(0, 120) : normalized;
}

function normalizePrompt(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error('CRON_INVALID_PROMPT');
  }
  return normalized;
}

function normalizeSchedule(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function nextRunAtIso(schedule: ParsedCronSchedule, from: Date): string {
  const next = findNextRun(schedule, from);
  return next ? next.toISOString() : from.toISOString();
}

function parseCronSchedule(raw: string): ParsedCronSchedule {
  const normalized = normalizeSchedule(raw);
  const parts = normalized.split(' ');
  if (parts.length !== 5) {
    throw new Error(`CRON_INVALID_SCHEDULE:${raw}`);
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6)
  };
}

function parseCronField(raw: string, min: number, max: number): CronFieldMatcher {
  const accepted = new Set<number>();
  for (const segment of raw.split(',')) {
    const token = segment.trim();
    if (token === '*') {
      for (let i = min; i <= max; i += 1) {
        accepted.add(i);
      }
      continue;
    }

    if (token.startsWith('*/')) {
      const step = Number(token.slice(2));
      if (!Number.isInteger(step) || step <= 0) {
        throw new Error(`CRON_INVALID_SCHEDULE:${raw}`);
      }
      for (let i = min; i <= max; i += step) {
        accepted.add(i);
      }
      continue;
    }

    if (token.includes('-')) {
      const [fromRaw, toRaw] = token.split('-');
      const from = Number(fromRaw);
      const to = Number(toRaw);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from > to || from < min || to > max) {
        throw new Error(`CRON_INVALID_SCHEDULE:${raw}`);
      }
      for (let i = from; i <= to; i += 1) {
        accepted.add(i);
      }
      continue;
    }

    const asNumber = Number(token);
    if (!Number.isInteger(asNumber) || asNumber < min || asNumber > max) {
      throw new Error(`CRON_INVALID_SCHEDULE:${raw}`);
    }
    accepted.add(asNumber);
  }

  if (accepted.size === 0) {
    throw new Error(`CRON_INVALID_SCHEDULE:${raw}`);
  }
  return new SetMatcher(accepted);
}

function findNextRun(schedule: ParsedCronSchedule, from: Date): Date | null {
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const maxIterations = 60 * 24 * 366;
  for (let i = 0; i < maxIterations; i += 1) {
    if (matchesSchedule(schedule, cursor)) {
      return new Date(cursor.getTime());
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

function matchesSchedule(schedule: ParsedCronSchedule, date: Date): boolean {
  return (
    schedule.minute.matches(date.getMinutes())
    && schedule.hour.matches(date.getHours())
    && schedule.dayOfMonth.matches(date.getDate())
    && schedule.month.matches(date.getMonth() + 1)
    && schedule.dayOfWeek.matches(date.getDay())
  );
}
