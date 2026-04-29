import type { CronJob, CronService } from '@familyco/core';

export interface CronRuntimeServiceDeps {
  cronService: CronService;
  executeJob: (job: CronJob, scheduledAt: Date) => Promise<{
    sessionId: string;
    output: Record<string, unknown>;
  }>;
  pollMs?: number;
}

const DEFAULT_CRON_POLL_MS = 30_000;

export class CronRuntimeService {
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private readonly inFlightCronIds = new Set<string>();

  constructor(private readonly deps: CronRuntimeServiceDeps) {}

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    void this.pollNow();
    this.timer = setInterval(() => {
      void this.pollNow();
    }, Math.max(5_000, this.deps.pollMs ?? DEFAULT_CRON_POLL_MS));
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    while (this.polling) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async pollNow(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;
    try {
      const now = new Date();
      const dueJobs = await this.deps.cronService.listDueJobs(now);
      for (const job of dueJobs) {
        if (this.inFlightCronIds.has(job.id)) {
          continue;
        }
        this.inFlightCronIds.add(job.id);
        try {
          await this.executeSingleJob(job, now);
        } finally {
          this.inFlightCronIds.delete(job.id);
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private async executeSingleJob(job: CronJob, now: Date): Promise<void> {
    const scheduledAt = job.nextRunAt ? new Date(job.nextRunAt) : now;
    const startedAt = new Date();

    try {
      const result = await this.deps.executeJob(job, scheduledAt);
      const finishedAt = new Date();
      await this.deps.cronService.recordRun({
        cronId: job.id,
        status: 'success',
        scheduledAt,
        startedAt,
        finishedAt,
        input: {
          cronId: job.id,
          name: job.name,
          prompt: job.prompt,
          schedule: job.schedule,
          agentId: job.agentId
        },
        output: {
          sessionId: result.sessionId,
          ...result.output
        }
      });
      await this.deps.cronService.setJobSession(job.id, result.sessionId);
      await this.deps.cronService.markRunScheduled(job.id, finishedAt);
    } catch (error) {
      const finishedAt = new Date();
      await this.deps.cronService.recordRun({
        cronId: job.id,
        status: 'failed',
        scheduledAt,
        startedAt,
        finishedAt,
        input: {
          cronId: job.id,
          name: job.name,
          prompt: job.prompt,
          schedule: job.schedule,
          agentId: job.agentId
        },
        error: {
          message: error instanceof Error ? error.message : String(error)
        }
      });
      await this.deps.cronService.markRunScheduled(job.id, finishedAt);
    }
  }
}
