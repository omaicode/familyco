import type { CronJob, CronRunRecord } from './cron.types.js';

export interface CronRepository {
  listJobs(): Promise<CronJob[]>;
  findJobById(id: string): Promise<CronJob | null>;
  createJob(input: Omit<CronJob, 'createdAt' | 'updatedAt'>): Promise<CronJob>;
  updateJob(id: string, input: Partial<CronJob>): Promise<CronJob>;
  deleteJob(id: string): Promise<void>;
  listRuns(cronId: string, limit: number): Promise<CronRunRecord[]>;
  createRun(input: Omit<CronRunRecord, 'id'>): Promise<CronRunRecord>;
}
