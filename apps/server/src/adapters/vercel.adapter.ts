import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { createVercel } from '@ai-sdk/vercel';
import { streamText } from 'ai';

import { toAdapterErrorMessage } from './adapter.helpers.js';
import { buildCoreMessages, buildVercelTools } from './vercel-adapter.helpers.js';

const VERCEL_MODELS = [
  'v0-1.5-lg',
  'v0-1.5-md'
] as const;

export class VercelAdapter implements AiAdapter {
  readonly id = 'vercel';
  readonly name = 'Vercel';
  readonly description = 'Vercel AI Gateway — unified access to multiple model providers';
  readonly logoId = 'vercel';
  readonly keyHint = 'vck_…';
  readonly authType = 'apikey' as const;
  readonly supportedAuthTypes = ['apikey'] as const;
  readonly defaultAuthType = 'apikey' as const;
  readonly defaultModel = 'v0-1.5-md';
  readonly availableModels = VERCEL_MODELS;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const vercel = createVercel({
      apiKey: input.apiKey
    });

    const model = resolveVercelModel(input.model);
    const toolSet = input.tools && input.tools.length > 0 ? buildVercelTools(input.tools) : undefined;

    const result = streamText({
      model: vercel(model),
      system: input.systemPrompt,
      messages: buildCoreMessages(input.userPrompt, input.previousTurns ?? [], input.attachments ?? []),
      tools: toolSet?.tools,
      abortSignal: input.abortSignal,
      temperature: 0.4,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          input.onChunk?.(chunk.text);
        }
      }
    });

    const [text, rawToolCalls, usage] = await Promise.all([result.text, result.toolCalls, result.usage]);

    const toolCalls = (rawToolCalls ?? []).map((toolCall) => ({
      name: toolSet?.restoreToolName(toolCall.toolName) ?? toolCall.toolName,
      arguments: toolCall.input as Record<string, unknown>
    }));

    if (text.trim().length === 0 && toolCalls.length === 0) {
      throw new Error('PROVIDER_INVALID_RESPONSE:Vercel returned an empty response');
    }

    return {
      content: text,
      toolCalls,
      tokenUsage: usage
        ? {
            prompt: usage.inputTokens ?? 0,
            completion: usage.outputTokens ?? 0,
            total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
          }
        : undefined
    };
  }

  async testConnection(apiKey: string, model?: string): Promise<AdapterTestResult> {
    const start = Date.now();
    const resolvedModel = resolveVercelModel(model);

    try {
      const vercel = createVercel({
        apiKey
      });
      
      const result = streamText({
        model: vercel(resolvedModel),
        messages: [{ role: 'user', content: 'ping' }],
        maxOutputTokens: 16
      });

      await result.text;
      return { ok: true, latencyMs: Date.now() - start, model: resolvedModel };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - start, error: toAdapterErrorMessage(error) };
    }
  }
}

function resolveVercelModel(model: string | undefined): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return 'v0-1.5-md';
  }

  return VERCEL_MODELS.includes(trimmed as typeof VERCEL_MODELS[number]) ? trimmed : 'openai/gpt-5-mini';
}
