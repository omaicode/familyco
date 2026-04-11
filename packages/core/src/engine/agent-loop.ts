import type { AiAdapter, AdapterToolDefinition, AdapterPreviousTurn } from '../ai-adapter/index.js';
import type { AdapterChatAttachment } from '../ai-adapter/index.js';

export type AgentLoopEvent =
  | { type: 'chunk'; text: string }
  | { type: 'tool_start'; callId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; callId: string; toolName: string; ok: boolean; output: unknown; durationMs: number }
  | { type: 'turn_done'; turn: number; assistantText: string }
  | { type: 'done'; finalReply: string; totalTurns: number };

export interface AgentLoopToolResult {
  callId: string;
  toolName: string;
  ok: boolean;
  output: unknown;
  error?: { code: string; message: string };
  durationMs: number;
}

export interface AgentLoopTurn {
  turn: number;
  assistantText: string;
  toolResults: AgentLoopToolResult[];
}

export interface AgentLoopInput {
  adapter: AiAdapter;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  attachments?: AdapterChatAttachment[];
  availableTools?: AdapterToolDefinition[];
  previousTurns?: AdapterPreviousTurn[];
  maxRounds?: number;
  onEvent?: (event: AgentLoopEvent) => void;
  abortSignal?: AbortSignal;
  shouldStop?: () => boolean;
  executeTool: (input: { toolName: string; arguments: Record<string, unknown> }) => Promise<{
    ok: boolean;
    output?: unknown;
    error?: { code: string; message: string };
    haltSignal?: unknown;
  }>;
}

export interface AgentLoopResult {
  finalReply: string;
  turns: AgentLoopTurn[];
  totalTurns: number;
  haltSignal?: unknown;
}

export class AgentLoopCancelledError extends Error {
  constructor(message = 'AGENT_LOOP_CANCELLED') {
    super(message);
    this.name = 'AgentLoopCancelledError';
  }
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const maxRounds = input.maxRounds ?? 6;
  const turns: AgentLoopTurn[] = [];
  const previousTurns: AdapterPreviousTurn[] = [...(input.previousTurns ?? [])];
  const executedCallSignatures = new Set<string>();
  let finalReply = '';
  let loopHaltSignal: unknown = undefined;

  for (let round = 0; round < maxRounds; round += 1) {
    assertNotCancelled(input.abortSignal, input.shouldStop);

    const response = await input.adapter.chat({
      apiKey: input.apiKey,
      model: input.model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      attachments: input.attachments,
      tools: input.availableTools,
      previousTurns,
      onChunk: (chunk) => input.onEvent?.({ type: 'chunk', text: chunk }),
      abortSignal: input.abortSignal
    }).catch((error: unknown) => {
      if (isAbortError(error) || input.abortSignal?.aborted || input.shouldStop?.() === true) {
        throw new AgentLoopCancelledError();
      }

      throw error;
    });

    if (response.content.trim().length > 0) {
      finalReply = response.content;
    }

    const allToolCalls = response.toolCalls ?? [];
    const uniqueToolCalls = allToolCalls.filter((tc) => {
      const sig = JSON.stringify({ t: tc.name, a: tc.arguments });
      return !executedCallSignatures.has(sig);
    });

    input.onEvent?.({ type: 'turn_done', turn: round, assistantText: response.content });

    if (uniqueToolCalls.length === 0) {
      break;
    }

    const turnResults: AgentLoopToolResult[] = [];

    for (const [idx, toolCall] of uniqueToolCalls.entries()) {
      const callId = `call_${round}_${idx}`;
      const startMs = Date.now();

      input.onEvent?.({ type: 'tool_start', callId, toolName: toolCall.name, input: toolCall.arguments });

      const result = await input.executeTool({ toolName: toolCall.name, arguments: toolCall.arguments });
      const durationMs = Date.now() - startMs;

      input.onEvent?.({
        type: 'tool_result',
        callId,
        toolName: toolCall.name,
        ok: result.ok,
        output: result.output ?? result.error,
        durationMs
      });

      turnResults.push({
        callId,
        toolName: toolCall.name,
        ok: result.ok,
        output: result.output,
        ...(result.error ? { error: result.error } : {}),
        durationMs
      });

      executedCallSignatures.add(JSON.stringify({ t: toolCall.name, a: toolCall.arguments }));

      if (result.haltSignal !== undefined) {
        loopHaltSignal = result.haltSignal;
        break;
      }

      assertNotCancelled(input.abortSignal, input.shouldStop);
    }

    turns.push({ turn: round, assistantText: response.content, toolResults: turnResults });

    previousTurns.push({
      assistantText: response.content,
      toolInteractions: uniqueToolCalls.map((tc, idx) => {
        const result = turnResults[idx];
        return {
          callId: `call_${round}_${idx}`,
          toolName: tc.name,
          arguments: tc.arguments,
          output: serializeOutput(result?.output ?? result?.error),
          ok: result?.ok ?? false
        };
      })
    });

    if (loopHaltSignal !== undefined) {
      break;
    }
  }

  input.onEvent?.({ type: 'done', finalReply, totalTurns: turns.length });
  return { finalReply, turns, totalTurns: turns.length, ...(loopHaltSignal !== undefined ? { haltSignal: loopHaltSignal } : {}) };
}

function assertNotCancelled(
  abortSignal?: AbortSignal,
  shouldStop?: () => boolean
): void {
  if (abortSignal?.aborted || shouldStop?.() === true) {
    throw new AgentLoopCancelledError();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === 'AbortError' || error.message === 'AGENT_LOOP_CANCELLED');
}

function serializeOutput(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return '';
    }

    return serialized.length > 2_000 ? `${serialized.slice(0, 1_999).trimEnd()}…` : serialized;
  } catch {
    return '';
  }
}
