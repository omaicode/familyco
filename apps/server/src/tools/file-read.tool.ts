import type { ToolExecutionResult } from '@familyco/core';

import { readTextFile, resolveWorkspacePath } from './file-tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const fileReadSlashSpec: SlashCommandSpec = {
  command: '/read-file',
  usage: '/read-file {path}',
  label: 'Read a file',
  description: 'Read a UTF-8 text file from the workspace.',
  insertValue: '/read-file ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.read-file',
  buildArguments: (args) => ({
    path: args.trim()
  })
};

export const fileReadTool: ServerToolDefinition = {
  name: 'file.read',
  description: 'Read a UTF-8 text file inside the current workspace and return its full contents.',
  slashSpec: fileReadSlashSpec,
  parameters: [
    { name: 'path', type: 'string', required: true, description: 'Workspace-relative or absolute path to the file.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const pathResolution = await resolveWorkspacePath(argumentsMap.path, 'file.read', context.workspaceRoot);
    if ('ok' in pathResolution) {
      return pathResolution;
    }

    try {
      const content = await readTextFile(pathResolution.path);
      return {
        ok: true,
        toolName: 'file.read',
        output: {
          path: pathResolution.relativePath,
          content
        }
      };
    } catch (error) {
      return toFileReadError(error);
    }
  }
};

function toFileReadError(error: unknown): ToolExecutionResult {
  if (error instanceof Error && error.message === 'FILE_NOT_REGULAR') {
    return {
      ok: false,
      toolName: 'file.read',
      error: {
        code: 'TOOL_INVALID_ARGUMENTS',
        message: 'file.read only supports regular files'
      }
    };
  }

  if (error instanceof Error && error.message === 'FILE_BINARY_UNSUPPORTED') {
    return {
      ok: false,
      toolName: 'file.read',
      error: {
        code: 'TOOL_INVALID_ARGUMENTS',
        message: 'file.read only supports UTF-8 text files'
      }
    };
  }

  if (error instanceof Error && error.message.startsWith('FILE_TOO_LARGE:')) {
    return {
      ok: false,
      toolName: 'file.read',
      error: {
        code: 'TOOL_INVALID_ARGUMENTS',
        message: 'file.read only supports files up to 256 KB'
      }
    };
  }

  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return {
      ok: false,
      toolName: 'file.read',
      error: {
        code: 'TOOL_INVALID_ARGUMENTS',
        message: 'file not found'
      }
    };
  }

  throw error;
}
