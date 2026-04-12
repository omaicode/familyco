import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString } from './tool.helpers.js';
import type { ServerToolDefinition } from './tool.types.js';

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
        message: asNonEmptyString(argumentsMap.message) ?? 'Task log executed',
        loggedAt: new Date().toISOString()
      }
    };
  }
};
