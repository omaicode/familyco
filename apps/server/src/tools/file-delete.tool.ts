import { rm, stat } from 'node:fs/promises';

import type { ToolExecutionResult } from '@familyco/core';

import { invalidArguments, parseKeyValueArgs } from './tool.helpers.js';
import { resolveWorkspacePath } from './file-tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const fileDeleteSlashSpec: SlashCommandSpec = {
  command: '/delete-file',
  usage: '/delete-file path=<path> confirm=true',
  label: 'Delete a file',
  description: 'Delete a workspace file (requires confirm=true).',
  insertValue: '/delete-file path= confirm=true',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.delete-file',
  buildArguments: (args) => {
    const parsed = parseKeyValueArgs(args);
    return {
      path: parsed.path ?? '',
      confirm: parsed.confirm === 'true'
    };
  }
};

export const fileDeleteTool: ServerToolDefinition = {
  name: 'file.delete',
  description: 'Delete a file inside the current workspace. This is destructive and requires confirm=true.',
  slashSpec: fileDeleteSlashSpec,
  parameters: [
    { name: 'path', type: 'string', required: true, description: 'Workspace-relative or absolute file path.' },
    { name: 'confirm', type: 'boolean', required: true, description: 'Explicit confirmation for destructive deletion.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const pathResolution = await resolveWorkspacePath(argumentsMap.path, 'file.delete', context.workspaceRoot);
    if ('ok' in pathResolution) {
      return pathResolution;
    }

    if (argumentsMap.confirm !== true) {
      return invalidArguments('file.delete', 'confirm=true is required for file.delete');
    }

    try {
      const info = await stat(pathResolution.path);
      if (!info.isFile()) {
        return invalidArguments('file.delete', 'file.delete only supports regular files');
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return invalidArguments('file.delete', 'file not found');
      }

      throw error;
    }

    await rm(pathResolution.path);

    return {
      ok: true,
      toolName: 'file.delete',
      output: {
        path: pathResolution.relativePath
      }
    };
  }
};
