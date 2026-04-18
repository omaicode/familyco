import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, parseKeyValueArgs } from '../modules/tools/tool.helpers.js';
import { resolveWorkspacePath } from './file-tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from '../modules/tools/tool.types.js';

export const fileWriteSlashSpec: SlashCommandSpec = {
  command: '/write-file',
  usage: '/write-file path=<path> content=<text> overwrite=<true|false>',
  label: 'Write a file',
  description: 'Write UTF-8 text into a workspace file.',
  insertValue: '/write-file path= content=',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.write-file',
  buildArguments: (args) => {
    const parsed = parseKeyValueArgs(args);
    return {
      path: parsed.path ?? '',
      content: parsed.content ?? '',
      overwrite: parsed.overwrite === 'true'
    };
  }
};

export const fileWriteTool: ServerToolDefinition = {
  name: 'file.write',
  description: 'Write UTF-8 text content into a workspace file. Existing files require overwrite=true.',
  slashSpec: fileWriteSlashSpec,
  parameters: [
    { name: 'path', type: 'string', required: true, description: 'Workspace-relative or absolute file path.' },
    { name: 'content', type: 'string', required: true, description: 'Full UTF-8 text to write into the file.' },
    { name: 'overwrite', type: 'boolean', required: false, description: 'Set to true to replace an existing file.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const pathResolution = await resolveWorkspacePath(argumentsMap.path, 'file.write', context.workspaceRoot);
    if ('ok' in pathResolution) {
      return pathResolution;
    }

    if (typeof argumentsMap.content !== 'string' || argumentsMap.content.trim().length === 0) {
      return invalidArguments('file.write', 'file.write expects arguments.content as a non-empty string');
    }

    const overwrite = argumentsMap.overwrite === true;
    const alreadyExists = await pathExists(pathResolution.path);
    if (alreadyExists && !overwrite) {
      return invalidArguments('file.write', 'overwrite=true is required when file.write targets an existing file');
    }

    await mkdir(path.dirname(pathResolution.path), { recursive: true });
    await writeFile(pathResolution.path, argumentsMap.content, 'utf8');

    return {
      ok: true,
      toolName: 'file.write',
      output: {
        path: pathResolution.relativePath,
        overwritten: alreadyExists
      }
    };
  }
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
