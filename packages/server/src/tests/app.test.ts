import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

test('GET /health returns ok', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    status?: string;
    queueDriver?: string;
    queue?: {
      totalJobs?: number;
      queuedJobs?: number;
      runningJobs?: number;
      completedJobs?: number;
      failedJobs?: number;
    };
  };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.queueDriver, 'memory');
  assert.equal(payload.queue?.totalJobs, 0);
  assert.equal(payload.queue?.queuedJobs, 0);
  assert.equal(payload.queue?.runningJobs, 0);
  assert.equal(payload.queue?.completedJobs, 0);
  assert.equal(payload.queue?.failedJobs, 0);

  await app.close();
});





