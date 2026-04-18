import type { ToolExecutionResult } from '@familyco/core';

import { asTextString } from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition } from '../modules/tools/tool.types.js';

export const taskLogTool: ServerToolDefinition = {
  name: 'task.log',
  description: 'Write a lightweight task log acknowledgement for engine diagnostics or non-persistent reporting.',
  parameters: [
    {
      name: 'message',
      type: 'string',
      required: true,
      description: 'Short note that should be returned as the accepted log payload.'
    }
  ],
  async execute(argumentsMap): Promise<ToolExecutionResult> {
    return {
      ok: true,
      toolName: 'task.log',
      output: {
        accepted: true,
        message: asTextString(argumentsMap.message) ?? 'Task log executed',
        loggedAt: new Date().toISOString()
      }
    };
  }
};
