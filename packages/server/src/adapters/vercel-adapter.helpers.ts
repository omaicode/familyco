import { tool, jsonSchema, type ModelMessage, type ToolSet, type JSONValue } from 'ai';
import type { ToolCallPart } from 'ai';

import type { AdapterChatAttachment, AdapterPreviousTurn, AdapterToolDefinition } from '@familyco/core';

export interface VercelToolSet {
  tools: ToolSet;
  restoreToolName: (safeName: string) => string;
}

/**
 * Converts dot-separated tool names (e.g. "task.create") to a provider-safe identifier
 * by replacing non-alphanumeric characters with underscores, capped at 64 chars.
 * Deterministic — same input always produces same output.
 */
export function toSafeToolName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^[^a-zA-Z_]/, '_');
  return (safe.length > 0 ? safe : 'tool').slice(0, 64);
}

/**
 * Builds Vercel AI SDK ModelMessage array from a user prompt + previous agentic loop turns.
 * Uses proper tool-call / tool-result content parts (fixes Claude's multi-turn format bug).
 */
export function buildCoreMessages(
  userPrompt: string,
  previousTurns: AdapterPreviousTurn[],
  attachments: AdapterChatAttachment[] = []
): ModelMessage[] {
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'file'; data: Uint8Array; filename?: string; mediaType: string }
  > = [];

  if (userPrompt.trim().length > 0) {
    userContent.push({ type: 'text', text: userPrompt });
  }

  for (const attachment of attachments) {
    if (attachment.kind === 'audio') {
      if (attachment.transcript?.trim()) {
        userContent.push({
          type: 'text',
          text: `Transcript for ${attachment.filename}:\n${attachment.transcript.trim()}`
        });
      }
      continue;
    }

    userContent.push({
      type: 'file',
      data: attachment.data,
      filename: attachment.filename,
      mediaType: attachment.mediaType
    });
  }

  const messages: ModelMessage[] = [{
    role: 'user',
    content: userContent.length > 0 ? userContent : [{ type: 'text', text: '' }]
  }];

  for (const turn of previousTurns) {
    const assistantContent: Array<
      | { type: 'text'; text: string }
      | ToolCallPart
    > = [];

    if (turn.assistantText.trim().length > 0) {
      assistantContent.push({ type: 'text', text: turn.assistantText });
    }

    for (const interaction of turn.toolInteractions) {
      assistantContent.push({
        type: 'tool-call',
        toolCallId: interaction.callId,
        toolName: toSafeToolName(interaction.toolName),
        input: interaction.arguments
      });
    }

    if (assistantContent.length > 0) {
      messages.push({ role: 'assistant', content: assistantContent });
    }

    if (turn.toolInteractions.length > 0) {
      messages.push({
        role: 'tool',
        content: turn.toolInteractions.map((i) => {
          const parsed = tryParseJson(i.output);
          return {
            type: 'tool-result' as const,
            toolCallId: i.callId,
            toolName: toSafeToolName(i.toolName),
            output: parsed !== undefined
              ? { type: 'json' as const, value: parsed as JSONValue }
              : { type: 'text' as const, value: i.output }
          };
        })
      });
    }
  }

  return messages;
}

/**
 * Converts AdapterToolDefinition[] to a Vercel AI SDK tool set (without execute functions).
 * The caller (AgentLoop / chat-respond.tool) handles tool execution externally.
 */
export function buildVercelTools(toolDefs: AdapterToolDefinition[]): VercelToolSet {
  const safeToOriginal = new Map<string, string>();
  const tools: ToolSet = {};

  for (const def of toolDefs) {
    const safeName = toSafeToolName(def.name);
    safeToOriginal.set(safeName, def.name);
    tools[safeName] = tool({
      description: def.description,
      inputSchema: jsonSchema(buildJsonSchemaObject(def.parameters))
    });
  }

  return {
    tools,
    restoreToolName: (safeName) => safeToOriginal.get(safeName) ?? safeName
  };
}

function buildJsonSchemaObject(
  params: AdapterToolDefinition['parameters']
): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const p of params) {
    const prop: Record<string, unknown> = {
      type: mapJsonSchemaType(p.type),
      description: p.description
    };

    if (p.type === 'array') {
      prop.items = p.items ? { type: mapJsonSchemaType(p.items.type) } : {};
    }

    properties[p.name] = prop;
    if (p.required) {
      required.push(p.name);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: true
  };
}

function mapJsonSchemaType(type: string): string {
  switch (type) {
    case 'number':
    case 'integer':
    case 'boolean':
    case 'array':
    case 'object':
    case 'string':
      return type;
    default:
      return 'string';
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
