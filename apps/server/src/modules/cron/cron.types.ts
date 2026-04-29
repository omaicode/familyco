export interface CronJob {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  agentId: string;
  enabled: boolean;
  sessionId: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CronRunStatus = 'success' | 'failed';

export interface CronRunRecord {
  id: string;
  cronId: string;
  status: CronRunStatus;
  scheduledAt: string;
  startedAt: string;
  finishedAt: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    message: string;
  };
}

export interface CreateCronJobInput {
  name: string;
  prompt: string;
  schedule: string;
  agentId: string;
  enabled?: boolean;
}

export interface UpdateCronJobInput {
  name?: string;
  prompt?: string;
  schedule?: string;
  enabled?: boolean;
  sessionId?: string | null;
  agentId?: string;
}

export interface RecordCronRunInput {
  cronId: string;
  status: CronRunStatus;
  scheduledAt: Date;
  startedAt: Date;
  finishedAt: Date;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    message: string;
  };
}
