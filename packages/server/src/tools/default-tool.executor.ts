import type { ToolExecutionInput, ToolExecutor } from '@familyco/core';

export class DefaultToolExecutor implements ToolExecutor {
  async execute(input: ToolExecutionInput): Promise<unknown> {
    if (input.toolName === 'echo') {
      return {
        echoed: input.arguments
      };
    }

    if (input.toolName === 'task.log') {
      return {
        accepted: true,
        message: String(input.arguments.message ?? 'Task log executed')
      };
    }

    throw new Error(`TOOL_NOT_FOUND:${input.toolName}`);
  }
}
