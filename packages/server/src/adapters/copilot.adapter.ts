import type { AiAdapter, AdapterChatInput, AdapterTestResult } from '@familyco/core';

export class CopilotAdapter implements AiAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly description = 'GitHub Copilot — code-aware reasoning powered by GitHub models';
  readonly keyHint = 'ghp_… or ghu_…';
  readonly defaultModel = 'gpt-4o';
  readonly availableModels = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'claude-3.5-sonnet'] as const;

  private static readonly ENDPOINT = 'https://api.githubcopilot.com/chat/completions';
  private static readonly TIMEOUT_MS = 25_000;

  async chat(input: AdapterChatInput): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CopilotAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(CopilotAdapter.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: buildCopilotHeaders(input.apiKey),
        body: JSON.stringify({
          model: input.model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt }
          ]
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(readProviderError('copilot', payload));
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:Copilot returned an empty response');
      }

      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(apiKey: string): Promise<AdapterTestResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CopilotAdapter.TIMEOUT_MS);

    try {
      const response = await fetch(CopilotAdapter.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: buildCopilotHeaders(apiKey),
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          temperature: 0,
          messages: [
            { role: 'user', content: 'ping' }
          ]
        })
      });

      const latencyMs = Date.now() - start;
      const payload = await response.json();

      if (!response.ok) {
        return { ok: false, latencyMs, error: readProviderError('copilot', payload) };
      }

      return { ok: true, latencyMs, model: this.defaultModel };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: toErrorMessage(error)
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildCopilotHeaders(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'authorization': `Bearer ${apiKey}`,
    'editor-version': 'vscode/1.85.0',
    'copilot-integration-id': 'vscode-chat'
  };
}

function readProviderError(providerName: string, payload: unknown): string {
  if (isRecord(payload)) {
    if (isRecord(payload.error)) {
      const nestedMessage = asNonEmptyString(payload.error.message);
      if (nestedMessage) return `PROVIDER_REQUEST_FAILED:${providerName}:${nestedMessage}`;
    }

    const message = asNonEmptyString(payload.message);
    if (message) return `PROVIDER_REQUEST_FAILED:${providerName}:${message}`;
  }

  return `PROVIDER_REQUEST_FAILED:${providerName}:Unknown provider error`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
