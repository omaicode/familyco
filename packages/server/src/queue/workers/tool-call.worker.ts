import type { QueueJob } from '@familyco/core';

export async function runToolCallWorker(job: QueueJob): Promise<void> {
  void job;
}
