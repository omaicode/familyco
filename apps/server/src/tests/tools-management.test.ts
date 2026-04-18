import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

test('tools module lists built-in and plugin tools and allows toggling plugin tools only', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'familyco-tools-'));
  const pluginsRoot = path.join(workspaceRoot, 'plugins');

  const pluginDir = path.join(pluginsRoot, 'test-tools-plugin');
  await mkdir(path.join(pluginDir, 'src'), { recursive: true });

  await writeFile(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({
      name: 'test-tools-plugin',
      type: 'module',
      familyco: { plugin: true, entry: 'src/index.js' }
    }),
    'utf8'
  );

  await writeFile(
    path.join(pluginDir, 'src', 'index.js'),
    `const plugin = {
  name: 'Test Tools Plugin',
  description: 'Plugin for tool management testing.',
  tools: [
    {
      name: 'ping',
      description: 'Return pong.',
      parameters: [],
      enabledByDefault: true,
      async execute() {
        return { ok: true, output: { pong: true } };
      }
    },
    {
      name: 'quiet',
      description: 'Return silence.',
      parameters: [],
      async execute() {
        return { ok: true, output: { silent: true } };
      }
    }
  ],
  skills: []
};
export default plugin;
`,
    'utf8'
  );

  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    pluginsRootDir: pluginsRoot
  });

  try {
    const enablePluginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/test-tools-plugin/enable',
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(enablePluginResponse.statusCode, 200);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/tools',
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(listResponse.statusCode, 200);

    const listPayload = listResponse.json() as {
      items: Array<{
        name: string;
        source: 'built-in' | 'plugin';
        enabled: boolean;
        togglable: boolean;
      }>;
    };

    const builtInTool = listPayload.items.find((item) => item.name === 'task.create');
    assert.ok(builtInTool, 'task.create built-in tool should be listed');
    assert.equal(builtInTool!.source, 'built-in');
    assert.equal(builtInTool!.enabled, true);
    assert.equal(builtInTool!.togglable, false);

    const pluginEnabledByDefaultToolName = 'plugin.test-tools-plugin.ping';
    const pluginEnabledByDefaultTool = listPayload.items.find((item) => item.name === pluginEnabledByDefaultToolName);
    assert.ok(pluginEnabledByDefaultTool, 'enabledByDefault plugin tool should be listed');
    assert.equal(pluginEnabledByDefaultTool!.source, 'plugin');
    assert.equal(pluginEnabledByDefaultTool!.enabled, true);
    assert.equal(pluginEnabledByDefaultTool!.togglable, true);

    const pluginDefaultDisabledToolName = 'plugin.test-tools-plugin.quiet';
    const pluginDefaultDisabledTool = listPayload.items.find((item) => item.name === pluginDefaultDisabledToolName);
    assert.ok(pluginDefaultDisabledTool, 'default-disabled plugin tool should be listed');
    assert.equal(pluginDefaultDisabledTool!.source, 'plugin');
    assert.equal(pluginDefaultDisabledTool!.enabled, false);
    assert.equal(pluginDefaultDisabledTool!.togglable, true);

    const builtInIndex = listPayload.items.findIndex((item) => item.name === 'task.create');
    const pluginIndex = listPayload.items.findIndex((item) => item.name === pluginEnabledByDefaultToolName);
    assert.ok(builtInIndex >= 0, 'built-in tool index should be found');
    assert.ok(pluginIndex >= 0, 'plugin tool index should be found');
    assert.ok(builtInIndex < pluginIndex, 'built-in tools should be listed before plugin tools');

    const disableBuiltInResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/tools/${encodeURIComponent('task.create')}/disable`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(disableBuiltInResponse.statusCode, 403);
    const disableBuiltInPayload = disableBuiltInResponse.json() as { code: string };
    assert.equal(disableBuiltInPayload.code, 'TOOL_IMMUTABLE');

    const disablePluginResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/tools/${encodeURIComponent(pluginEnabledByDefaultToolName)}/disable`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(disablePluginResponse.statusCode, 200);
    const disablePluginPayload = disablePluginResponse.json() as { enabled: boolean };
    assert.equal(disablePluginPayload.enabled, false);

    const detailAfterDisableResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/tools/${encodeURIComponent(pluginEnabledByDefaultToolName)}`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(detailAfterDisableResponse.statusCode, 200);
    const detailAfterDisablePayload = detailAfterDisableResponse.json() as { enabled: boolean };
    assert.equal(detailAfterDisablePayload.enabled, false);

    const enablePluginToolResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/tools/${encodeURIComponent(pluginEnabledByDefaultToolName)}/enable`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(enablePluginToolResponse.statusCode, 200);
    const enablePluginPayload = enablePluginToolResponse.json() as { enabled: boolean };
    assert.equal(enablePluginPayload.enabled, true);
  } finally {
    await app.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
