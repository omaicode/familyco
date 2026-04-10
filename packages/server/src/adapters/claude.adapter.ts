import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { readProviderError, toAdapterErrorMessage } from './adapter.helpers.js';

export class ClaudeAdapter implements AiAdapter {
  readonly id = 'claude';
  readonly name = 'Claude';
  readonly description = 'Anthropic Claude — great for reasoning and long-context tasks';
  readonly keyHint = 'sk-ant-…';
  readonly defaultModel = 'claude-sonnet-4-5';
  readonly availableModels = ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'] as const;

  private static readonly ENDPOINT = 'https://api.anthropic.com/v1/messages';
  private static readonly TIMEOUT_MS = 25_000;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ClaudeAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(ClaudeAdapter.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': input.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: input.model,
          max_tokens: 800,
          temperature: 0.2,
          system: input.systemPrompt,
          messages: [{ role: 'user', content: input.userPrompt }]
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readProviderError('claude', payload));
      }

      const content = Array.isArray(payload?.content)
        ? payload.content
            .map((part: { text?: string }) => part?.text ?? '')
            .join('\n')
            .trim()
        : '';

      if (content.length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:Claude returned an empty response');
      }

      const usage = payload?.usage;
      return {
        content,
        tokenUsage: usage
          ? { prompt: usage.input_tokens, completion: usage.output_tokens, total: usage.input_tokens + usage.output_tokens }
          : undefined
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(apiKey: string): Promise<AdapterTestResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ClaudeAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(ClaudeAdapter.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-3-5',
          max_tokens: 1,
          temperature: 0,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });

      const latencyMs = Date.now() - start;
      const payload = await response.json();

      if (!response.ok) {
        return { ok: false, latencyMs, error: readProviderError('claude', payload) };
      }

      return { ok: true, latencyMs, model: 'claude-haiku-3-5' };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: toAdapterErrorMessage(error)
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

