import type { ToolExecutionInput, ToolExecutionResult, ToolExecutor } from '@familyco/core';

export class DefaultToolExecutor implements ToolExecutor {
  async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    if (input.toolName === 'echo') {
      return {
        ok: true,
        toolName: input.toolName,
        output: {
          echoed: input.arguments
        }
      };
    }

    if (input.toolName === 'task.log') {
      return {
        ok: true,
        toolName: input.toolName,
        output: {
          accepted: true,
          message: String(input.arguments.message ?? 'Task log executed'),
          loggedAt: new Date().toISOString()
        }
      };
    }

    if (input.toolName === 'json.extract') {
      const source = input.arguments.source;
      const path = String(input.arguments.path ?? '').trim();

      if (typeof source !== 'object' || source === null || path.length === 0) {
        return {
          ok: false,
          toolName: input.toolName,
          error: {
            code: 'TOOL_INVALID_ARGUMENTS',
            message: 'json.extract expects arguments.source object and non-empty arguments.path'
          }
        };
      }

      const value = resolveDotPath(source as Record<string, unknown>, path);
      return {
        ok: true,
        toolName: input.toolName,
        output: {
          path,
          value
        }
      };
    }

    if (input.toolName === 'web.search') {
      const query = String(input.arguments.query ?? '').trim();
      if (query.length === 0) {
        return {
          ok: false,
          toolName: input.toolName,
          error: {
            code: 'TOOL_INVALID_ARGUMENTS',
            message: 'web.search expects arguments.query as a non-empty string'
          }
        };
      }

      return {
        ok: true,
        toolName: input.toolName,
        output: {
          query,
          results: []
        }
      };
    }

    throw new Error(`TOOL_NOT_FOUND:${input.toolName}`);
  }
}

function resolveDotPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}
