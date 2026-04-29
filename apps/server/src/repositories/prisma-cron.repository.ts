import { Prisma, type PrismaClient } from '@familyco/db';

import type { CronRepository } from '../modules/cron/cron.service.js';
import type { CronJob, CronRunRecord } from '../modules/cron/cron.types.js';

export class PrismaCronRepository implements CronRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listJobs(): Promise<CronJob[]> {
    const jobs = await this.prisma.cronJob.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return jobs.map(toCronJob);
  }

  async findJobById(id: string): Promise<CronJob | null> {
    const job = await this.prisma.cronJob.findUnique({ where: { id } });
    return job ? toCronJob(job) : null;
  }

  async createJob(input: Omit<CronJob, 'createdAt' | 'updatedAt'>): Promise<CronJob> {
    const created = await this.prisma.cronJob.create({
      data: {
        id: input.id,
        name: input.name,
        prompt: input.prompt,
        schedule: input.schedule,
        agentId: input.agentId,
        enabled: input.enabled,
        sessionId: input.sessionId,
        lastRunAt: toDateOrNull(input.lastRunAt),
        nextRunAt: toDateOrNull(input.nextRunAt)
      }
    });
    return toCronJob(created);
  }

  async updateJob(id: string, input: Partial<CronJob>): Promise<CronJob> {
    const updated = await this.prisma.cronJob.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
        ...(input.schedule !== undefined ? { schedule: input.schedule } : {}),
        ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.lastRunAt !== undefined ? { lastRunAt: toDateOrNull(input.lastRunAt) } : {}),
        ...(input.nextRunAt !== undefined ? { nextRunAt: toDateOrNull(input.nextRunAt) } : {})
      }
    });
    return toCronJob(updated);
  }

  async deleteJob(id: string): Promise<void> {
    await this.prisma.cronJob.delete({ where: { id } });
  }

  async listRuns(cronId: string, limit: number): Promise<CronRunRecord[]> {
    const runs = await this.prisma.cronRun.findMany({
      where: { cronId },
      orderBy: { startedAt: 'desc' },
      take: Math.max(1, limit)
    });
    return runs.map(toCronRunRecord);
  }

  async createRun(input: Omit<CronRunRecord, 'id'>): Promise<CronRunRecord> {
    const created = await this.prisma.cronRun.create({
      data: {
        cronId: input.cronId,
        status: input.status,
        scheduledAt: new Date(input.scheduledAt),
        startedAt: new Date(input.startedAt),
        finishedAt: new Date(input.finishedAt),
        input: input.input as Prisma.InputJsonValue,
        output: toJsonOrNull(input.output),
        error: toJsonOrNull(input.error)
      }
    });
    return toCronRunRecord(created);
  }
}

function toCronJob(job: {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  agentId: string;
  enabled: boolean;
  sessionId: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CronJob {
  return {
    id: job.id,
    name: job.name,
    prompt: job.prompt,
    schedule: job.schedule,
    agentId: job.agentId,
    enabled: job.enabled,
    sessionId: job.sessionId,
    lastRunAt: job.lastRunAt ? job.lastRunAt.toISOString() : null,
    nextRunAt: job.nextRunAt ? job.nextRunAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

function toCronRunRecord(run: {
  id: string;
  cronId: string;
  status: string;
  scheduledAt: Date;
  startedAt: Date;
  finishedAt: Date;
  input: unknown;
  output: unknown;
  error: unknown;
}): CronRunRecord {
  return {
    id: run.id,
    cronId: run.cronId,
    status: run.status === 'failed' ? 'failed' : 'success',
    scheduledAt: run.scheduledAt.toISOString(),
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt.toISOString(),
    input: isRecord(run.input) ? run.input : {},
    ...(isRecord(run.output) ? { output: run.output } : {}),
    ...(isRecord(run.error) ? { error: { message: String(run.error.message ?? '') } } : {})
  };
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return new Date(value);
}

function toJsonOrNull(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!value) {
    return Prisma.DbNull;
  }
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
