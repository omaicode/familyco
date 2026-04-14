/**
 * Unit tests for PluginLoaderService.
 *
 * Each test creates isolated temp directories so they never interfere with each
 * other or with the real `plugins/` directory.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import {
  AuditService,
  PluginRegistry,
  PluginRunService,
  PluginService
} from '@familyco/core';
import type { ServerToolContext, ServerToolDefinition } from '../tools/tool.types.js';
import {
  InMemoryAuditRepository,
  InMemoryPluginRepository,
  InMemoryPluginRunRepository
} from '../repositories/index.js';
import {
  PluginLoaderService,
  type PluginToolExecutor
} from '../modules/plugins/plugin-loader.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ServerToolContext that satisfies the interface without unused deps. */
const minCtx = {} as ServerToolContext;

/** Records tools registered by the loader — lets us call execute() in tests. */
class MockToolExecutor implements PluginToolExecutor {
  readonly tools: ServerToolDefinition[] = [];

  registerPluginTools(incoming: readonly ServerToolDefinition[]): void {
    this.tools.push(...incoming);
  }

  clearPluginTools(): void {
    this.tools.splice(0);
  }

  find(name: string): ServerToolDefinition | undefined {
    return this.tools.find((t) => t.name === name);
  }
}

/** Creates all in-memory deps for PluginLoaderService. */
function makeLoaderDeps(pluginsRootDir: string, toolExecutor: MockToolExecutor) {
  const pluginRepo = new InMemoryPluginRepository();
  const pluginRunRepo = new InMemoryPluginRunRepository();
  const auditRepo = new InMemoryAuditRepository();
  const pluginRegistry = new PluginRegistry();
  const pluginService = new PluginService(pluginRepo);
  const pluginRunService = new PluginRunService(pluginRunRepo);
  const auditService = new AuditService(auditRepo);

  const loader = new PluginLoaderService({
    pluginService,
    pluginRegistry,
    pluginRepository: pluginRepo,
    auditService,
    pluginsRootDir,
    toolExecutor,
    pluginRunService
  });

  return { loader, pluginService, pluginRegistry };
}

/** Write a minimal valid plugin to `dir/name/`. Returns the plugin dir path. */
async function writePlugin(
  rootDir: string,
  name: string,
  indexContent: string,
  pkgExtra?: Record<string, unknown>
): Promise<string> {
  const pluginDir = path.join(rootDir, name);
  await mkdir(path.join(pluginDir, 'src'), { recursive: true });
  await writeFile(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({
      name: `@test/${name}`,
      version: '1.0.0',
      type: 'module',
      familyco: { plugin: true, entry: 'src/index.js' },
      ...pkgExtra
    }),
    'utf8'
  );
  await writeFile(path.join(pluginDir, 'src', 'index.js'), indexContent, 'utf8');
  return pluginDir;
}

const SIMPLE_PLUGIN = `
const plugin = {
  name: 'Simple Test Plugin',
  description: 'A minimal plugin for unit testing.',
  version: '1.0.0',
  tags: ['test'],
  tools: [{
    name: 'echo',
    description: 'Returns the input unchanged.',
    parameters: [{ name: 'value', type: 'string', required: true, description: 'Value to echo.' }],
    async execute(args) {
      return { ok: true, output: { result: args.value } };
    }
  }],
  skills: [{
    name: 'test-skill',
    description: 'A test skill.',
    content: '# Test Skill\\nDo nothing.',
    applyTo: []
  }]
};
export default plugin;
`;

// ---------------------------------------------------------------------------
// Discovery tests
// ---------------------------------------------------------------------------

describe('PluginLoaderService.discover()', () => {
  let tmpRoot: string;
  before(async () => { tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'fco-plugins-')); });
  after(async () => { await rm(tmpRoot, { recursive: true, force: true }); });

  it('returns zero when plugins root does not exist', async () => {
    const exec = new MockToolExecutor();
    const { loader } = makeLoaderDeps(path.join(tmpRoot, 'nonexistent'), exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 0);
    assert.equal(result.errors.length, 0);
  });

  it('skips directories without package.json', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'no-pkg-'));
    await mkdir(path.join(dir, 'my-plugin'));
    const exec = new MockToolExecutor();
    const { loader } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 0);
  });

  it('skips package.json without familyco.plugin flag', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'no-flag-'));
    const pDir = path.join(dir, 'my-plugin');
    await mkdir(pDir, { recursive: true });
    await writeFile(path.join(pDir, 'package.json'), JSON.stringify({ name: 'my-plugin' }), 'utf8');
    const exec = new MockToolExecutor();
    const { loader } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 0);
  });

  it('reports error when entry file listed in package.json is missing', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'no-entry-'));
    const pDir = path.join(dir, 'no-entry-plugin');
    await mkdir(pDir, { recursive: true });
    await writeFile(
      path.join(pDir, 'package.json'),
      JSON.stringify({ name: 'no-entry', type: 'module', familyco: { plugin: true, entry: 'src/index.js' } }),
      'utf8'
    );
    const exec = new MockToolExecutor();
    const { loader } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 0);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0]?.includes('entry not found'));
  });

  it('reports error when entry file imports a missing npm package at module level', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'bad-import-'));
    await writePlugin(dir, 'bad-import-plugin', `
      import { something } from '__this_pkg_does_not_exist_xyz_99__';
      export default { name: 'Bad', description: 'bad', version: '1.0.0', tools: [] };
    `);
    const exec = new MockToolExecutor();
    const { loader } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 0);
    assert.equal(result.errors.length, 1);
  });

  it('successfully discovers a valid plugin and persists its metadata', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'valid-'));
    await writePlugin(dir, 'simple-plugin', SIMPLE_PLUGIN);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 1);
    assert.equal(result.errors.length, 0);

    const plugin = await pluginService.getById('simple-plugin');
    assert.ok(plugin, 'plugin should exist in DB');
    assert.equal(plugin?.name, 'Simple Test Plugin');
    assert.equal(plugin?.description, 'A minimal plugin for unit testing.');
    assert.equal(plugin?.version, '1.0.0');
    assert.deepEqual(plugin?.tags, ['test']);
    assert.equal(plugin?.state, 'discovered');
    assert.equal(plugin?.capabilities.length, 2); // 1 tool + 1 skill
  });

  it('discover() is idempotent — same checksum does not re-insert', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'idempotent-'));
    await writePlugin(dir, 'my-plugin', SIMPLE_PLUGIN);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    await loader.discover();
    await loader.discover(); // second call
    const all = await pluginService.list();
    assert.equal(all.length, 1, 'should not create a duplicate');
  });

  it('re-imports and updates plugin when package.json version changes', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'versioned-'));
    await writePlugin(dir, 'versioned-plugin', SIMPLE_PLUGIN, { version: '1.0.0' });
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);

    await loader.discover();
    const v1 = await pluginService.getById('versioned-plugin');
    assert.equal(v1?.version, '1.0.0');

    // Bump version in package.json → checksum changes
    const pkgPath = path.join(dir, 'versioned-plugin', 'package.json');
    await writeFile(
      pkgPath,
      JSON.stringify({ name: '@test/versioned-plugin', version: '2.0.0', type: 'module', familyco: { plugin: true, entry: 'src/index.js' } }),
      'utf8'
    );

    await loader.discover();
    const v2 = await pluginService.getById('versioned-plugin');
    assert.equal(v2?.version, '2.0.0');
  });

  it('discovers multiple plugins in the same root directory', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'multi-'));
    for (const name of ['plugin-alpha', 'plugin-beta', 'plugin-gamma']) {
      await writePlugin(dir, name, `
        export default { name: '${name}', description: 'Auto-generated.', version: '1.0.0', tools: [] };
      `);
    }
    // Add a non-plugin dir that should be skipped
    await mkdir(path.join(dir, 'not-a-plugin'));

    const exec = new MockToolExecutor();
    const { loader } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();
    assert.equal(result.discovered, 3);
    assert.equal(result.errors.length, 0);
  });

  it('continues discovering remaining plugins even when one fails', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'partial-'));
    await writePlugin(dir, 'good-plugin', SIMPLE_PLUGIN);
    await writePlugin(dir, 'bad-plugin', `import { x } from '__no_such_package_xyz__'; export default {};`);

    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();

    assert.equal(result.discovered, 1);
    assert.equal(result.errors.length, 1);
    const good = await pluginService.getById('good-plugin');
    assert.ok(good, 'good-plugin should still be discovered');
  });
});

// ---------------------------------------------------------------------------
// Tool execution tests
// ---------------------------------------------------------------------------

describe('PluginLoaderService — tool execution', () => {
  let tmpRoot: string;
  before(async () => { tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'fco-exec-')); });
  after(async () => { await rm(tmpRoot, { recursive: true, force: true }); });

  it('enabled plugin tool runs execute() and returns ok result', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'exec-'));
    await writePlugin(dir, 'echo-plugin', SIMPLE_PLUGIN);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);

    await loader.discover();
    await pluginService.enable('echo-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.echo-plugin.echo');
    assert.ok(tool, 'tool stub should be registered after enable');

    const result = await tool!.execute({ value: 'hello world' }, minCtx);
    assert.equal(result.ok, true);
    assert.equal((result.output as { result?: string })?.result, 'hello world');
  });

  it('tool returns PLUGIN_DISABLED when plugin state is no longer enabled in registry', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'disabled-'));
    await writePlugin(dir, 'toggle-plugin', SIMPLE_PLUGIN);
    const exec = new MockToolExecutor();
    const { loader, pluginService, pluginRegistry } = makeLoaderDeps(dir, exec);

    await loader.discover();
    await pluginService.enable('toggle-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.toggle-plugin.echo');
    assert.ok(tool, 'tool should be registered');

    // Simulate disable: update the in-memory registry directly (as refreshRegistry would)
    const current = pluginRegistry.get('toggle-plugin');
    assert.ok(current);
    pluginRegistry.register({ ...current, state: 'disabled' });

    const result = await tool!.execute({ value: 'test' }, minCtx);
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'PLUGIN_DISABLED');
  });

  it('tool returns error when required parameter is missing (handler validates)', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'invalid-args-'));
    await writePlugin(dir, 'validator-plugin', `
      export default {
        name: 'Validator Plugin',
        description: 'Validates required args.',
        version: '1.0.0',
        tools: [{
          name: 'strict_tool',
          description: 'Requires a non-empty query.',
          parameters: [{ name: 'query', type: 'string', required: true, description: 'Query string.' }],
          async execute(args) {
            const q = typeof args.query === 'string' ? args.query.trim() : '';
            if (!q) return { ok: false, error: { code: 'INVALID_ARGS', message: 'query is required.' } };
            return { ok: true, output: { echo: q } };
          }
        }]
      };
    `);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    await loader.discover();
    await pluginService.enable('validator-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.validator-plugin.strict_tool');
    const result = await tool!.execute({ query: '' }, minCtx);
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'INVALID_ARGS');
  });
});

// ---------------------------------------------------------------------------
// External library tests
// ---------------------------------------------------------------------------

describe('PluginLoaderService — external library scenarios', () => {
  let tmpRoot: string;
  before(async () => { tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'fco-extlib-')); });
  after(async () => { await rm(tmpRoot, { recursive: true, force: true }); });

  it('plugin using node:crypto built-in computes a stable SHA-256 hash', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'crypto-'));
    await writePlugin(dir, 'crypto-plugin', `
      import { createHash } from 'node:crypto';
      export default {
        name: 'Crypto Util',
        description: 'Uses node:crypto to hash strings.',
        version: '1.0.0',
        tools: [{
          name: 'hash_string',
          description: 'Returns SHA-256 hex digest of input.',
          parameters: [{ name: 'input', type: 'string', required: true, description: 'Input to hash.' }],
          async execute(args) {
            const hash = createHash('sha256').update(String(args.input ?? '')).digest('hex');
            return { ok: true, output: { hash } };
          }
        }]
      };
    `);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    await loader.discover();
    await pluginService.enable('crypto-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.crypto-plugin.hash_string');
    assert.ok(tool);

    const result = await tool!.execute({ input: 'hello' }, minCtx);
    assert.equal(result.ok, true);
    // SHA-256('hello') is a well-known constant
    assert.equal(
      (result.output as { hash?: string })?.hash,
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('plugin using node:os built-in returns platform and arch', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'os-'));
    await writePlugin(dir, 'os-plugin', `
      import osLib from 'node:os';
      export default {
        name: 'System Info',
        description: 'Uses node:os to return system info.',
        version: '1.0.0',
        tools: [{
          name: 'get_platform',
          description: 'Returns OS platform and architecture.',
          parameters: [],
          async execute() {
            return { ok: true, output: { platform: osLib.platform(), arch: osLib.arch() } };
          }
        }]
      };
    `);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    await loader.discover();
    await pluginService.enable('os-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.os-plugin.get_platform');
    assert.ok(tool);

    const result = await tool!.execute({}, minCtx);
    assert.equal(result.ok, true);
    const output = result.output as { platform?: string; arch?: string };
    assert.equal(typeof output?.platform, 'string');
    assert.equal(typeof output?.arch, 'string');
  });

  it('plugin whose execute() dynamically imports a missing package returns structured error', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'missing-dep-'));
    await writePlugin(dir, 'graceful-plugin', `
      export default {
        name: 'Graceful External',
        description: 'Handles missing dependency gracefully.',
        version: '1.0.0',
        tools: [{
          name: 'try_external',
          description: 'Tries to use a package that is not installed.',
          parameters: [],
          async execute() {
            try {
              await import('__non_existent_package_for_test_xyz_99__');
              return { ok: true, output: { loaded: true } };
            } catch (err) {
              return {
                ok: false,
                error: {
                  code: 'DEPENDENCY_MISSING',
                  message: 'Required package not available: ' + (err instanceof Error ? err.message : String(err))
                }
              };
            }
          }
        }]
      };
    `);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    await loader.discover();
    await pluginService.enable('graceful-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.graceful-plugin.try_external');
    assert.ok(tool, 'tool should still be registered even though dep may be missing');

    const result = await tool!.execute({}, minCtx);
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'DEPENDENCY_MISSING');
  });

  it('plugin with top-level missing import fails at discovery and does not block others', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'toplevel-fail-'));
    await writePlugin(dir, 'broken-plugin', `
      import { missingFn } from '__definitely_not_installed_pkg_abc__';
      export default { name: 'Broken', description: 'Will fail to load', version: '1.0.0', tools: [] };
    `);
    await writePlugin(dir, 'healthy-plugin', `
      export default { name: 'Healthy', description: 'Loads fine.', version: '1.0.0', tools: [] };
    `);

    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    const result = await loader.discover();

    assert.equal(result.discovered, 1, 'only healthy-plugin should be discovered');
    assert.equal(result.errors.length, 1, 'broken-plugin should emit an error');
    const healthy = await pluginService.getById('healthy-plugin');
    assert.ok(healthy, 'healthy-plugin must exist in DB');
    const broken = await pluginService.getById('broken-plugin');
    assert.equal(broken, null, 'broken-plugin must NOT be in DB');
  });

  it('plugin importing node:path to resolve file at runtime succeeds', async () => {
    const dir = await mkdtemp(path.join(tmpRoot, 'path-'));
    await writePlugin(dir, 'path-plugin', `
      import pathLib from 'node:path';
      export default {
        name: 'Path Util',
        description: 'Uses node:path for file path operations.',
        version: '1.0.0',
        tools: [{
          name: 'join_segments',
          description: 'Joins path segments.',
          parameters: [
            { name: 'a', type: 'string', required: true, description: 'First segment.' },
            { name: 'b', type: 'string', required: true, description: 'Second segment.' }
          ],
          async execute(args) {
            const joined = pathLib.join(String(args.a ?? ''), String(args.b ?? ''));
            return { ok: true, output: { joined } };
          }
        }]
      };
    `);
    const exec = new MockToolExecutor();
    const { loader, pluginService } = makeLoaderDeps(dir, exec);
    await loader.discover();
    await pluginService.enable('path-plugin');
    await loader.refreshRegistry();

    const tool = exec.find('plugin.path-plugin.join_segments');
    const result = await tool!.execute({ a: 'some', b: 'dir' }, minCtx);
    assert.equal(result.ok, true);
    assert.equal((result.output as { joined?: string })?.joined, path.join('some', 'dir'));
  });
});
