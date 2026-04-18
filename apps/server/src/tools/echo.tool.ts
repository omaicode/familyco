import type { ToolExecutionResult } from '@familyco/core';

import type { ServerToolDefinition } from '../modules/tools/tool.types.js';

export const echoTool: ServerToolDefinition = {
  name: 'echo',
  description: 'Return the provided arguments unchanged. Useful for testing tool execution plumbing.',
  parameters: [
    {
      name: 'payload',
      type: 'object',
      required: false,
      description: 'Arbitrary content that should be echoed back in the response.'
    }
  ],
  async execute(argumentsMap): Promise<ToolExecutionResult> {
    return {
      ok: true,
      toolName: 'echo',
      output: {
        echoed: argumentsMap
      }
    };
  }
};
