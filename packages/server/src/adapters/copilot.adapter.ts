import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterPreviousTurn, AdapterTestResult } from '@familyco/core';

import { readJsonLikePayload, readProviderError, readSseStream, toAdapterErrorMessage } from './adapter.helpers.js';

export class CopilotAdapter implements AiAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly description = 'GitHub Copilot / GitHub Models inference API';
  readonly keyHint = 'ghp_… or ghu_…';
  readonly defaultModel = 'gpt-5-mini';
  readonly availableModels = ['gpt-5-mini', 'gpt-5.4-mini', 'o3-mini', 'claude-3.5-sonnet'] as const;

  private static readonly ENDPOINT = 'https://models.github.ai/inference/chat/completions';
  private static readonly TIMEOUT_MS = 25_000;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
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
          stream: true,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
            ...buildCopilotPreviousTurnMessages(input.previousTurns ?? [])
          ]
        })
      });

      if (!response.ok) {
        const payload = await readJsonLikePayload(response);
        throw new Error(readProviderError('copilot', payload));
      }

      let content = '';
      await readSseStream(response, (data) => {
        if (data === '[DONE]') {
          return;
        }

        const payload = tryParseJson(data);
        if (!isRecord(payload) || !Array.isArray(payload.choices)) {
          return;
        }

        for (const choice of payload.choices) {
          if (!isRecord(choice) || !isRecord(choice.delta)) {
            continue;
          }

          const delta = asOptionalString(choice.delta.content);
          if (delta) {
            content += delta;
            input.onChunk?.(delta);
          }
        }
      });

      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:Copilot returned an empty response');
      }

      return {
        content,
        tokenUsage: undefined
      };
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
        error: toAdapterErrorMessage(error)
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildCopilotHeaders(apiKey: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'authorization': `Bearer ${apiKey}`,
    'x-github-api-version': '2026-03-10'
  };
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

function buildCopilotPreviousTurnMessages(turns: AdapterPreviousTurn[]): Array<{ role: string; content: string }> {
  if (turns.length === 0) {
    return [];
  }

  const messages: Array<{ role: string; content: string }> = [];

  for (const turn of turns) {
    const assistantParts: string[] = [];
    if (turn.assistantText.trim().length > 0) {
      assistantParts.push(turn.assistantText);
    }
    if (turn.toolInteractions.length > 0) {
      const toolSummary = turn.toolInteractions
        .map((i) => `[Called ${i.toolName}(${JSON.stringify(i.arguments)})]`)
        .join('\n');
      assistantParts.push(toolSummary);
    }

    if (assistantParts.length > 0) {
      messages.push({ role: 'assistant', content: assistantParts.join('\n\n') });
    }

    if (turn.toolInteractions.length > 0) {
      const resultLines = turn.toolInteractions.map((i) => {
        const status = i.ok ? 'ok' : 'failed';
        return `Tool ${i.toolName} (${status}): ${i.output}`;
      });
      messages.push({
        role: 'user',
        content: `Tool results:\n${resultLines.join('\n')}\n\nUse these results. Do NOT re-query the same data. Proceed to the next step.`
      });
    }
  }

  return messages;
}
