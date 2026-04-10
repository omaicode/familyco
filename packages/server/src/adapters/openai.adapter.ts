import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { readProviderError, toAdapterErrorMessage } from './adapter.helpers.js';

export class OpenAiAdapter implements AiAdapter {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'OpenAI GPT-4o — best for general-purpose agents';
  readonly keyHint = 'sk-…';
  readonly defaultModel = 'gpt-4o';
  readonly availableModels = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'] as const;

  private static readonly RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
  private static readonly TIMEOUT_MS = 25_000;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const requestBody: Record<string, unknown> = {
      model: input.model,
      temperature: 0.2,
      text: {
        format: { type: 'json_object' }
      },
      input: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt }
      ]
    };

    if (input.skills && input.skills.length > 0) {
      requestBody.tools = [
        {
          type: 'shell',
          environment: {
            type: 'container_auto',
            skills: input.skills.map((skill) => ({
              type: 'skill_reference',
              skill_id: skill.id
            }))
          }
        }
      ];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OpenAiAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(OpenAiAdapter.RESPONSES_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${input.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readProviderError('openai', payload));
      }

      const content =
        (typeof payload?.output_text === 'string' ? payload.output_text : null) ??
        (Array.isArray(payload?.output)
          ? payload.output
              .flatMap((item: { content?: Array<{ text?: string }> }) => item?.content ?? [])
              .map((part: { text?: string }) => part?.text ?? '')
              .join('\n')
              .trim()
          : '');

      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty response');
      }

      const usage = payload?.usage;
      return {
        content,
        tokenUsage: usage
          ? {
              prompt: usage.input_tokens ?? usage.prompt_tokens ?? 0,
              completion: usage.output_tokens ?? usage.completion_tokens ?? 0,
              total: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)
            }
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
      const response = await fetch(OpenAiAdapter.RESPONSES_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_output_tokens: 1,
          temperature: 0,
          input: [{ role: 'user', content: 'ping' }]
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
