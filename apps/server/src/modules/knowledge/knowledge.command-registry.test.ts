import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveKnowledgeConverterBinaryPath } from './knowledge.command-registry.js';

test('resolveKnowledgeConverterBinaryPath checks {CODEBASE}/bin in dev contexts', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'familyco-knowledge-bin-'));
  const binaryName = process.platform === 'win32' ? 'familyco-py.exe' : 'familyco-py';
  const binaryPath = path.join(tempRoot, 'bin', binaryName);

  const previousInitCwd = process.env.INIT_CWD;
  const previousWorkspaceRoot = process.env.FAMILYCO_WORKSPACE_ROOT;
  const previousEnvBinary = process.env.FAMILYCO_KNOWLEDGE_BINARY_PATH;

  try {
    await writeFile(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    await mkdir(path.dirname(binaryPath), { recursive: true });
    await writeFile(binaryPath, 'fake-binary');

    process.env.INIT_CWD = tempRoot;
    delete process.env.FAMILYCO_WORKSPACE_ROOT;
    delete process.env.FAMILYCO_KNOWLEDGE_BINARY_PATH;

    const resolved = await resolveKnowledgeConverterBinaryPath({
      get: async () => null
    } as never);

    assert.equal(resolved, binaryPath);
  } finally {
    if (previousInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previousInitCwd;
    }
    if (previousWorkspaceRoot === undefined) {
      delete process.env.FAMILYCO_WORKSPACE_ROOT;
    } else {
      process.env.FAMILYCO_WORKSPACE_ROOT = previousWorkspaceRoot;
    }
    if (previousEnvBinary === undefined) {
      delete process.env.FAMILYCO_KNOWLEDGE_BINARY_PATH;
    } else {
      process.env.FAMILYCO_KNOWLEDGE_BINARY_PATH = previousEnvBinary;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
