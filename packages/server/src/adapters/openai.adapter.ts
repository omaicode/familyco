import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { readProviderError, toAdapterErrorMessage } from './adapter.helpers.js';

export class OpenAiAdapter implements AiAdapter {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'OpenAI GPT-4o — best for general-purpose agents';
  readonly keyHint = 'sk-…';
  readonly defaultModel = 'gpt-4o';
  readonly availableModels = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'] as const;

  private static readonly ENDPOINT = 'https://api.openai.com/v1/chat/completions';
  private static readonly TIMEOUT_MS = 25_000;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OpenAiAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(OpenAiAdapter.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${input.apiKey}`
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          ...(input.skills && input.skills.length > 0
            ? {
                skills: input.skills.map((skill) => ({
                  id: skill.id,
                  name: skill.name,
                  description: skill.description
                }))
              }
            : {}),
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt }
          ]
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readProviderError('openai', payload));
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty response');
      }

      const usage = payload?.usage;
      return {
        content,
        tokenUsage: usage
          ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens }
          : undefined
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(apiKey: string): Promise<AdapterTestResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OpenAiAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(OpenAiAdapter.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1,
          temperature: 0,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });

      const latencyMs = Date.now() - start;
      const payload = await response.json();

      if (!response.ok) {
        return { ok: false, latencyMs, error: readProviderError('openai', payload) };
      }

      return { ok: true, latencyMs, model: 'gpt-4o-mini' };
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
