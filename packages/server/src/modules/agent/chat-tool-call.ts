import type { ToolExecutionResult } from '@familyco/core';

import { extractEntityLabel, isRecord } from '../../tools/tool.helpers.js';
import type { ChatToolCall } from './agent.types.js';

type ChatToolCallResultLike = Pick<ToolExecutionResult, 'toolName' | 'ok' | 'output' | 'error'>;

export function toChatToolCall(result: ChatToolCallResultLike): ChatToolCall {
  if (!result.ok) {
    const error = normalizeToolError(result.error) ?? normalizeToolError(result.output);
    return {
      toolName: result.toolName,
      ok: false,
      summary: error?.message ?? `The tool ${result.toolName} could not complete the request.`,
      ...(error ? { error } : {})
    };
  }

  const label = extractEntityLabel(result.output);
  return {
    toolName: result.toolName,
    ok: true,
    summary: label ? `Executed ${result.toolName} for "${label}".` : `Executed ${result.toolName}.`,
    ...(result.output !== undefined ? { output: result.output } : {})
  };
}

function normalizeToolError(value: unknown): ChatToolCall['error'] | undefined {
  if (!isRecord(value) || typeof value.message !== 'string') {
    return undefined;
  }

  return {
    message: value.message,
    code: typeof value.code === 'string' ? value.code : 'TOOL_EXECUTION_FAILED'
  };
}
