import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { createDeepSeek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';

import { toAdapterErrorMessage } from './adapter.helpers.js';
import { buildCoreMessages, buildVercelTools } from './vercel-adapter.helpers.js';

const DEEPSEEK_MODELS = ['deepseek-chat', 'deepseek-reasoner'] as const;

export class DeepSeekAdapter implements AiAdapter {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek';
  readonly description = 'DeepSeek — efficient reasoning models for coding and analysis';
  readonly logoId = 'deepseek';
  readonly keyHint = 'sk-…';
  readonly authType = 'apikey' as const;
  readonly supportedAuthTypes = ['apikey'] as const;
  readonly defaultAuthType = 'apikey' as const;
  readonly defaultModel = 'deepseek-chat';
  readonly availableModels = DEEPSEEK_MODELS;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const deepseek = createDeepSeek({
      apiKey: input.apiKey
    });
    const model = resolveDeepSeekModel(input.model);
    const toolSet = input.tools && input.tools.length > 0 ? buildVercelTools(input.tools) : undefined;

    const result = streamText({
      model: deepseek(model),
      system: input.systemPrompt,
      messages: buildCoreMessages(input.userPrompt, input.previousTurns ?? [], input.attachments ?? []),
      tools: toolSet?.tools,
      abortSignal: input.abortSignal,
      temperature: 0.3,
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
      throw new Error('PROVIDER_INVALID_RESPONSE:DeepSeek returned an empty response');
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
    const resolvedModel = resolveDeepSeekModel(model);

    try {
      const deepseek = createDeepSeek({
        apiKey
      });
      const result = streamText({
        model: deepseek(resolvedModel),
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

function resolveDeepSeekModel(model: string | undefined): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return 'deepseek-chat';
  }

  return DEEPSEEK_MODELS.includes(trimmed as typeof DEEPSEEK_MODELS[number]) ? trimmed : 'deepseek-chat';
}
