import type { ToolExecutionResult } from '@familyco/core';

import { invalidArguments, isRecord, resolveDotPath } from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition } from '../modules/tools/tool.types.js';

export const jsonExtractTool: ServerToolDefinition = {
  name: 'json.extract',
  description: 'Read a nested value from a JSON-like object using a dot-separated path.',
  parameters: [
    {
      name: 'source',
      type: 'object',
      required: true,
      description: 'Source JSON object to inspect.'
    },
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'Dot-separated key path, for example payload.owner.name.'
    }
  ],
  async execute(argumentsMap): Promise<ToolExecutionResult> {
    const source = argumentsMap.source;
    const path = typeof argumentsMap.path === 'string' ? argumentsMap.path.trim() : '';

    if (!isRecord(source) || path.length === 0) {
      return invalidArguments(
        'json.extract',
        'json.extract expects arguments.source object and a non-empty arguments.path string'
      );
    }

    return {
      ok: true,
      toolName: 'json.extract',
      output: {
        path,
        value: resolveDotPath(source, path)
      }
    };
  }
};
