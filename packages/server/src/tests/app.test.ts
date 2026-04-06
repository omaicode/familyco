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
  assert.deepEqual(response.json(), { status: 'ok' });

  await app.close();
});





