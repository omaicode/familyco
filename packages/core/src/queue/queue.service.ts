import type { QueueJob } from './job.types.js';

export interface QueueService {
  enqueue(job: QueueJob): Promise<void>;
}
