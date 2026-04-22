import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

import { toAdapterErrorMessage } from './adapter.helpers.js';
import { buildCoreMessages, buildVercelTools } from './vercel-adapter.helpers.js';

export class ClaudeAdapter implements AiAdapter {
  readonly id = 'claude';
  readonly name = 'Claude';
  readonly description = 'Anthropic Claude — great for reasoning and long-context tasks';
  readonly logoId = 'claude';
  readonly keyHint = 'sk-ant-…';
  readonly authType = 'apikey' as const;
  readonly supportedAuthTypes = ['apikey'] as const;
  readonly defaultAuthType = 'apikey' as const;
  readonly defaultModel = 'claude-sonnet-4-5';
  readonly availableModels = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'] as const;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const anthropic = createAnthropic({ apiKey: input.apiKey });
    const toolSet = input.tools && input.tools.length > 0 ? buildVercelTools(input.tools) : undefined;
    const supportsThinking = supportsClaudeThinking(input.model);

    const result = streamText({
      model: anthropic(input.model),
      system: input.systemPrompt,
      messages: buildCoreMessages(input.userPrompt, input.previousTurns ?? [], input.attachments ?? []),
      tools: toolSet?.tools,
      maxOutputTokens: supportsThinking ? 1_200 : 800,
      abortSignal: input.abortSignal,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          input.onChunk?.(chunk.text);
        }
      },
      ...(supportsThinking
        ? { providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 1_024 } } } }
        : { temperature: 0.2 })
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
      throw new Error('PROVIDER_INVALID_RESPONSE:Claude returned an empty response');
    }

    return {
      content: text,
      toolCalls,
      tokenUsage: usage
        ? { prompt: usage.inputTokens ?? 0, completion: usage.outputTokens ?? 0, total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) }
        : undefined
    };
  }

  async testConnection(apiKey: string, model?: string): Promise<AdapterTestResult> {
    const start = Date.now();
    const requestedModel = model?.trim() || 'claude-haiku-3-5';
    try {
      const anthropic = createAnthropic({ apiKey });
      const result = streamText({
        model: anthropic(requestedModel),
        messages: [{ role: 'user', content: 'ping' }],
        maxOutputTokens: 16
      });
      await result.text;
      return { ok: true, latencyMs: Date.now() - start, model: requestedModel };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - start, error: toAdapterErrorMessage(error) };
    }
  }
}

function supportsClaudeThinking(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  if (!normalized.includes('sonnet')) {
    return false;
  }

  const match = normalized.match(/sonnet-(\d+)-(\d+)/);
  if (!match) {
    return false;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    return false;
  }

  return major > 3 || (major === 3 && minor >= 7);
}
