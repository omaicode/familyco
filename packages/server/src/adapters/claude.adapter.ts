import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from '@familyco/core';

import { readJsonLikePayload, readProviderError, readSseStream, toAdapterErrorMessage } from './adapter.helpers.js';

const CLAUDE_SKILLS_BETA_HEADER = 'code-execution-2025-08-25,skills-2025-10-02';

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
        headers: buildClaudeHeaders(input.apiKey, Boolean(input.skills && input.skills.length > 0)),
        body: JSON.stringify({
          model: input.model,
          max_tokens: supportsClaudeReasoning(input.model) ? 1_200 : 800,
          temperature: 0.2,
          stream: true,
          ...(supportsClaudeReasoning(input.model)
            ? {
                thinking: {
                  type: 'enabled',
                  budget_tokens: 1_024
                }
              }
            : {}),
          ...(input.skills && input.skills.length > 0
            ? {
                container: {
                  skills: input.skills.map((skill) => ({
                    type: 'custom',
                    skill_id: skill.id,
                    version: 'latest'
                  }))
                },
                tools: [{ type: 'code_execution_20250825', name: 'code_execution' }]
              }
            : {}),
          system: input.systemPrompt,
          messages: [{ role: 'user', content: input.userPrompt }]
        })
      });

      if (!response.ok) {
        const payload = await readJsonLikePayload(response);
        throw new Error(readProviderError('claude', payload));
      }

      let content = '';
      let promptTokens = 0;
      let completionTokens = 0;
      await readSseStream(response, (data) => {
        if (data === '[DONE]') {
          return;
        }

        const eventPayload = tryParseJson(data);
        if (!isRecord(eventPayload)) {
          return;
        }

        if (eventPayload.type === 'content_block_delta' && isRecord(eventPayload.delta)) {
          const deltaText = asOptionalString(eventPayload.delta.text);
          if (deltaText) {
            content += deltaText;
            input.onChunk?.(deltaText);
          }
          return;
        }

        if (eventPayload.type === 'message_start' && isRecord(eventPayload.message) && isRecord(eventPayload.message.usage)) {
          const inputTokens = asOptionalNumber(eventPayload.message.usage.input_tokens);
          if (typeof inputTokens === 'number') {
            promptTokens = inputTokens;
          }
          return;
        }

        if (eventPayload.type === 'message_delta' && isRecord(eventPayload.usage)) {
          const outputTokens = asOptionalNumber(eventPayload.usage.output_tokens);
          if (typeof outputTokens === 'number') {
            completionTokens = outputTokens;
          }
        }
      });

      if (content.length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:Claude returned an empty response');
      }

      return {
        content,
        tokenUsage: promptTokens > 0 || completionTokens > 0
          ? { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }
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
        headers: buildClaudeHeaders(apiKey, false),
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

function buildClaudeHeaders(apiKey: string, withSkills: boolean): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    ...(withSkills ? { 'anthropic-beta': CLAUDE_SKILLS_BETA_HEADER } : {})
  };
}

function supportsClaudeReasoning(model: string): boolean {
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

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
