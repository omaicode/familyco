import type { CronJob, CronRepository, CronRunRecord } from '@familyco/core';

export class InMemoryCronRepository implements CronRepository {
  private readonly jobs: CronJob[] = [];
  private readonly runs: CronRunRecord[] = [];

  async listJobs(): Promise<CronJob[]> {
    return this.jobs.slice();
  }

  async findJobById(id: string): Promise<CronJob | null> {
    return this.jobs.find((job) => job.id === id) ?? null;
  }

  async createJob(input: Omit<CronJob, 'createdAt' | 'updatedAt'>): Promise<CronJob> {
    const now = new Date().toISOString();
    const created: CronJob = {
      ...input,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.push(created);
    return created;
  }

  async updateJob(id: string, input: Partial<CronJob>): Promise<CronJob> {
    const index = this.jobs.findIndex((job) => job.id === id);
    if (index < 0) {
      throw new Error(`CRON_NOT_FOUND:${id}`);
    }

    const updated: CronJob = {
      ...this.jobs[index],
      ...input,
      updatedAt: new Date().toISOString()
    };
    this.jobs[index] = updated;
    return updated;
  }

  async deleteJob(id: string): Promise<void> {
    const next = this.jobs.filter((job) => job.id !== id);
    this.jobs.splice(0, this.jobs.length, ...next);
    const remainingRuns = this.runs.filter((run) => run.cronId !== id);
    this.runs.splice(0, this.runs.length, ...remainingRuns);
  }

  async listRuns(cronId: string, limit: number): Promise<CronRunRecord[]> {
    return this.runs
      .filter((run) => run.cronId === cronId)
      .sort((left, right) => (left.startedAt > right.startedAt ? -1 : 1))
      .slice(0, limit);
  }

  async createRun(input: Omit<CronRunRecord, 'id'>): Promise<CronRunRecord> {
    const created: CronRunRecord = {
      ...input,
      id: `${input.cronId}-${this.runs.length + 1}`
    };
    this.runs.push(created);
    return created;
  }
}
