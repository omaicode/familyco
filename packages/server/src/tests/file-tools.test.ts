import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DefaultToolExecutor } from '../tools/default-tool.executor.js';

test('file tools can search, read, write, and delete workspace files', async () => {
  const workspaceRoot = process.cwd();
  const tempDir = await mkdtemp(path.join(workspaceRoot, 'tmp-file-tools-'));
  const sourceFile = path.join(tempDir, 'notes.txt');

  await writeFile(sourceFile, 'FamilyCo skill data\nneedle content\n', 'utf8');

  const executor = new DefaultToolExecutor();

  try {
    const searchResult = await executor.execute({
      toolName: 'file.search',
      arguments: {
        query: 'needle',
        directoryPath: tempDir
      }
    });
    assert.equal(searchResult.ok, true);
    assert.equal(
      Array.isArray((searchResult.output as { results?: unknown[] }).results),
      true
    );

    const readResult = await executor.execute({
      toolName: 'file.read',
      arguments: {
        path: sourceFile
      }
    });
    assert.equal(readResult.ok, true);
    assert.equal((readResult.output as { content: string }).content.includes('needle content'), true);

    const targetFile = path.join(tempDir, 'generated.txt');
    const writeResult = await executor.execute({
      toolName: 'file.write',
      arguments: {
        path: targetFile,
        content: 'generated output'
      }
    });
    assert.equal(writeResult.ok, true);
    assert.equal(await readFile(targetFile, 'utf8'), 'generated output');

    const deleteWithoutConfirm = await executor.execute({
      toolName: 'file.delete',
      arguments: {
        path: targetFile,
        confirm: false
      }
    });
    assert.equal(deleteWithoutConfirm.ok, false);

    const deleteResult = await executor.execute({
      toolName: 'file.delete',
      arguments: {
        path: targetFile,
        confirm: true
      }
    });
    assert.equal(deleteResult.ok, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
