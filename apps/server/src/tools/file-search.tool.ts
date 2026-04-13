import { stat } from 'node:fs/promises';

import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments } from './tool.helpers.js';
import { resolveWorkspacePath, searchWorkspaceFiles } from './file-tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const fileSearchSlashSpec: SlashCommandSpec = {
  command: '/search-file',
  usage: '/search-file {query}',
  label: 'Search files',
  description: 'Search workspace files by filename or text content.',
  insertValue: '/search-file ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.search-file',
  buildArguments: (args) => ({
    query: args.trim()
  })
};

export const fileSearchTool: ServerToolDefinition = {
  name: 'file.search',
  description: 'Search files inside the current workspace by filename or text content and return matching paths with short snippets.',
  slashSpec: fileSearchSlashSpec,
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Text to search for in filenames or file contents.' },
    { name: 'directoryPath', type: 'string', required: false, description: 'Optional workspace-relative directory to limit the search scope.' },
    { name: 'maxResults', type: 'number', required: false, description: 'Optional result limit between 1 and 25.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const query = asNonEmptyString(argumentsMap.query);
    if (!query) {
      return invalidArguments('file.search', 'file.search expects arguments.query as a non-empty string');
    }

    const directoryResolution = await resolveWorkspacePath(argumentsMap.directoryPath ?? '.', 'file.search', context.workspaceRoot);
    if ('ok' in directoryResolution) {
      return directoryResolution;
    }

    try {
      const info = await stat(directoryResolution.path);
      if (!info.isDirectory()) {
        return invalidArguments('file.search', 'file.search expects directoryPath to point to a directory');
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return invalidArguments('file.search', 'search directory not found');
      }

      throw error;
    }

    const results = await searchWorkspaceFiles({
      query,
      directoryPath: directoryResolution.path,
      maxResults: typeof argumentsMap.maxResults === 'number' ? argumentsMap.maxResults : undefined,
      workspaceRoot: context.workspaceRoot
    });

    return {
      ok: true,
      toolName: 'file.search',
      output: {
        query,
        directoryPath: directoryResolution.relativePath,
        results
      }
    };
  }
};
