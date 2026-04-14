/**
 * Integration tests for the Plugins REST API.
 *
 * Spins up a full Fastify app (memory driver) pointing at a temp plugins root,
 * then exercises every plugin endpoint: list, get, discover, enable, disable,
 * approval-mode update.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADERS = { 'x-api-key': TEST_API_KEY };

const PLUGIN_INDEX_JS = `
export default {
  name: 'Test Plugin',
  description: 'Used in REST API integration tests.',
  version: '1.0.0',
  author: 'FamilyCo Tests',
  tags: ['test'],
  tools: [{
    name: 'greet',
    description: 'Greets the user.',
    parameters: [{ name: 'name', type: 'string', required: true, description: 'Name to greet.' }],
    async execute(args) {
      return { ok: true, output: { message: 'Hello, ' + (args.name ?? 'World') + '!' } };
    }
  }]
};
`;

async function createPluginDir(root: string, pluginSlug: string): Promise<void> {
  const pluginDir = path.join(root, pluginSlug);
  await mkdir(path.join(pluginDir, 'src'), { recursive: true });
  await writeFile(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({
      name: `@test/${pluginSlug}`,
      version: '1.0.0',
      type: 'module',
      familyco: { plugin: true, entry: 'src/index.js' }
    }),
    'utf8'
  );
  await writeFile(path.join(pluginDir, 'src', 'index.js'), PLUGIN_INDEX_JS, 'utf8');
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Plugins REST API', () => {
  let pluginsRoot: string;

  before(async () => {
    pluginsRoot = await mkdtemp(path.join(os.tmpdir(), 'fco-api-plugins-'));
    await createPluginDir(pluginsRoot, 'test-plugin');
  });

  after(async () => {
    await rm(pluginsRoot, { recursive: true, force: true });
  });

  it('GET /plugins auto-discovers plugins on startup (onReady hook)', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      // No explicit POST /discover — the onReady hook runs discover() automatically
      const res = await app.inject({ method: 'GET', url: '/api/v1/plugins', headers: HEADERS });
      assert.equal(res.statusCode, 200);
      const body = res.json() as { items: Array<{ id: string; state: string }> };
      assert.equal(body.items.length, 1, 'plugin should be auto-discovered on startup');
      assert.equal(body.items[0]?.id, 'test-plugin');
      assert.equal(body.items[0]?.state, 'discovered');
    } finally {
      await app.close();
    }
  });

  it('POST /plugins/discover finds the plugin and returns metadata', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      const res = await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });
      assert.equal(res.statusCode, 200);
      const body = res.json() as { discovered: number; enabled: number; errors: string[] };
      assert.equal(body.discovered, 1);
      assert.equal(body.enabled, 0);
      assert.equal(body.errors.length, 0);
    } finally {
      await app.close();
    }
  });

  it('GET /plugins lists the discovered plugin after discover', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });
      const res = await app.inject({ method: 'GET', url: '/api/v1/plugins', headers: HEADERS });
      assert.equal(res.statusCode, 200);
      const body = res.json() as { items: Array<{ id: string; name: string; state: string }> };
      assert.equal(body.items.length, 1);
      assert.equal(body.items[0]?.id, 'test-plugin');
      assert.equal(body.items[0]?.name, 'Test Plugin');
      assert.equal(body.items[0]?.state, 'discovered');
    } finally {
      await app.close();
    }
  });

  it('GET /plugins/:id returns a single plugin', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });
      const res = await app.inject({ method: 'GET', url: '/api/v1/plugins/test-plugin', headers: HEADERS });
      assert.equal(res.statusCode, 200);
      const body = res.json() as { id: string; name: string; version: string; tags: string[] };
      assert.equal(body.id, 'test-plugin');
      assert.equal(body.name, 'Test Plugin');
      assert.equal(body.version, '1.0.0');
      assert.deepEqual(body.tags, ['test']);
    } finally {
      await app.close();
    }
  });

  it('GET /plugins/:id returns 404 for unknown plugin', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/plugins/does-not-exist', headers: HEADERS });
      assert.equal(res.statusCode, 404);
    } finally {
      await app.close();
    }
  });

  it('POST /plugins/:id/enable transitions state to enabled', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });

      const enableRes = await app.inject({ method: 'POST', url: '/api/v1/plugins/test-plugin/enable', headers: HEADERS });
      assert.equal(enableRes.statusCode, 200);
      const enabled = enableRes.json() as { id: string; state: string };
      assert.equal(enabled.id, 'test-plugin');
      assert.equal(enabled.state, 'enabled');

      // GET should now reflect enabled
      const getRes = await app.inject({ method: 'GET', url: '/api/v1/plugins/test-plugin', headers: HEADERS });
      assert.equal((getRes.json() as { state: string }).state, 'enabled');
    } finally {
      await app.close();
    }
  });

  it('POST /plugins/:id/disable transitions state to disabled', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });
      await app.inject({ method: 'POST', url: '/api/v1/plugins/test-plugin/enable', headers: HEADERS });

      const disableRes = await app.inject({ method: 'POST', url: '/api/v1/plugins/test-plugin/disable', headers: HEADERS });
      assert.equal(disableRes.statusCode, 200);
      assert.equal((disableRes.json() as { state: string }).state, 'disabled');
    } finally {
      await app.close();
    }
  });

  it('PATCH /plugins/:id/approval updates approval mode', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });

      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/plugins/test-plugin/approval',
        headers: { ...HEADERS, 'content-type': 'application/json' },
        payload: { approvalMode: 'auto' }
      });
      assert.equal(patchRes.statusCode, 200);
      const body = patchRes.json() as { approvalMode: string };
      assert.equal(body.approvalMode, 'auto');
    } finally {
      await app.close();
    }
  });

  it('discovered plugin exposes tool and skill capabilities', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });
      const res = await app.inject({ method: 'GET', url: '/api/v1/plugins/test-plugin', headers: HEADERS });
      const plugin = res.json() as { capabilities: Array<{ kind: string; name: string }> };
      const kinds = plugin.capabilities.map((c) => c.kind);
      assert.ok(kinds.includes('tool'), 'should have tool capability');
    } finally {
      await app.close();
    }
  });

  it('discover is idempotent — calling twice keeps count at 1', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });
      await app.inject({ method: 'POST', url: '/api/v1/plugins/discover', headers: HEADERS });

      const listRes = await app.inject({ method: 'GET', url: '/api/v1/plugins', headers: HEADERS });
      const body = listRes.json() as { items: unknown[] };
      assert.equal(body.items.length, 1);
    } finally {
      await app.close();
    }
  });

  it('rejects requests without auth header', async () => {
    const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY, pluginsRootDir: pluginsRoot });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/plugins' });
      assert.equal(res.statusCode, 401);
    } finally {
      await app.close();
    }
  });
});
