import type { QueueJob } from '@familyco/core';

export async function runAgentWorker(job: QueueJob): Promise<void> {
  void job;
}
