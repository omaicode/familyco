import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

import { toAdapterErrorMessage } from './adapter.helpers.js';
import { buildCoreMessages, buildVercelTools } from './vercel-adapter.helpers.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODELS = [
  'anthropic/claude-opus-4.7',  
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.6',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.6-fast',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-opus-4.5',
  'openai/gpt-5.4-pro',
  'openai/gpt-5.4',
  'openai/gpt-5.4-mini',
  'openai/gpt-5.4-nano',
  'openai/gpt-5.3-chat',
  'openai/gpt-5.3-codex',
  'openai/gpt-5.2-pro',
  'openai/gpt-5.2-chat',
  'openai/gpt-5.2-codex',
  'openai/gpt-5.2',
  'openai/gpt-5-pro',
  'openai/gpt-5-codex',
  'openai/gpt-5-chat',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'x-ai/grok-4.20-multi-agent',
  'x-ai/grok-4.20',
  'x-ai/grok-4.1-fast',
  'x-ai/grok-4-fast',
  'x-ai/grok-4',
  'x-ai/grok-3',
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-flash',
  'minimax/minimax-m2.7',
  'minimax/minimax-m2.5',
  'minimax/minimax-m2-her',
  'minimax/minimax-m2.1',
  'moonshotai/kimi-k2.6',
  'moonshotai/kimi-k2.5',
  'z-ai/glm-5.1',
  'z-ai/glm-5v-turbo',
  'z-ai/glm-5-turbo',
  'z-ai/glm-5',
  'z-ai/glm-4.7-flash',
  'z-ai/glm-4.7',
  'z-ai/glm-4.6v',
  'z-ai/glm-4.6',
] as const;

export class OpenRouterAdapter implements AiAdapter {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';
  readonly description = 'OpenRouter — unified model routing with one API key';
  readonly logoId = 'openrouter';
  readonly keyHint = 'sk-or-…';
  readonly authType = 'apikey' as const;
  readonly supportedAuthTypes = ['apikey'] as const;
  readonly defaultAuthType = 'apikey' as const;
  readonly defaultModel = 'openai/gpt-5-mini';
  readonly availableModels = OPENROUTER_MODELS;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const openrouter = createOpenAI({
      apiKey: input.apiKey,
      baseURL: OPENROUTER_BASE_URL
    });
    const model = resolveOpenRouterModel(input.model);
    const toolSet = input.tools && input.tools.length > 0 ? buildVercelTools(input.tools) : undefined;

    const result = streamText({
      model: openrouter(model),
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
      throw new Error('PROVIDER_INVALID_RESPONSE:OpenRouter returned an empty response');
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
    const resolvedModel = resolveOpenRouterModel(model);

    try {
      const openrouter = createOpenAI({
        apiKey,
        baseURL: OPENROUTER_BASE_URL
      });

      const result = streamText({
        model: openrouter(resolvedModel),
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

function resolveOpenRouterModel(model: string | undefined): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return 'openai/gpt-5-mini';
  }

  return OPENROUTER_MODELS.includes(trimmed as typeof OPENROUTER_MODELS[number])
    ? trimmed
    : 'openai/gpt-5-mini';
}
