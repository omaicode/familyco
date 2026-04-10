import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

import { toAdapterErrorMessage } from './adapter.helpers.js';
import { buildCoreMessages, buildVercelTools } from './vercel-adapter.helpers.js';

export class OpenAiAdapter implements AiAdapter {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'OpenAI gpt-5-mini — best for general-purpose agents';
  readonly keyHint = 'sk-…';
  readonly defaultModel = 'gpt-5-mini';
  readonly availableModels = ['gpt-5-mini', 'gpt-5.4-mini', 'o3-mini', 'o1'] as const;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const openai = createOpenAI({ apiKey: input.apiKey });
    const toolSet = input.tools && input.tools.length > 0 ? buildVercelTools(input.tools) : undefined;

    const result = streamText({
      model: openai.chat(input.model),
      system: input.systemPrompt,
      messages: buildCoreMessages(input.userPrompt, input.previousTurns ?? []),
      tools: toolSet?.tools,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          input.onChunk?.(chunk.text);
        }
      },
      ...(supportsOpenAiReasoning(input.model)
        ? { providerOptions: { openai: { reasoningEffort: 'medium' } } }
        : { temperature: 0.5 })
    });

    const [text, rawToolCalls, usage] = await Promise.all([
      result.text,
      result.toolCalls,
      result.usage
    ]);

    const toolCalls = (rawToolCalls ?? []).map((tc) => ({
      name: toolSet?.restoreToolName(tc.toolName) ?? tc.toolName,
      arguments: tc.input as Record<string, unknown>
    }));

    if (text.trim().length === 0 && toolCalls.length === 0) {
      throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty response');
    }

    return {
      content: text,
      toolCalls,
      tokenUsage: usage
        ? { prompt: usage.inputTokens ?? 0, completion: usage.outputTokens ?? 0, total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) }
        : undefined
    };
  }

  async testConnection(apiKey: string): Promise<AdapterTestResult> {
    const start = Date.now();
    try {
      const openai = createOpenAI({ apiKey });
      const result = streamText({
        model: openai.chat('gpt-5.4-mini'),
        messages: [{ role: 'user', content: 'ping' }],
        maxOutputTokens: 1,
      });
      await result.text;
      return { ok: true, latencyMs: Date.now() - start, model: 'gpt-5.4-mini' };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - start, error: toAdapterErrorMessage(error) };
    }
  }
}

function supportsOpenAiReasoning(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4') ||
    (normalized.startsWith('gpt-5') && !normalized.startsWith('gpt-5-chat'))
  );
}
