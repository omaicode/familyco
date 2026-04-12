import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments } from './tool.helpers.js';
import type { ServerToolDefinition } from './tool.types.js';

export const webSearchTool: ServerToolDefinition = {
  name: 'web.search',
  description: 'Placeholder web search tool interface. It validates the query and returns an empty result list in local mode.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      required: true,
      description: 'Search string the agent wants to look up on the web.'
    }
  ],
  async execute(argumentsMap): Promise<ToolExecutionResult> {
    const query = asNonEmptyString(argumentsMap.query);
    if (!query) {
      return invalidArguments('web.search', 'web.search expects arguments.query as a non-empty string');
    }

    return {
      ok: true,
      toolName: 'web.search',
      output: {
        query,
        results: []
      }
    };
  }
};
