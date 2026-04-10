import type {
  AdapterPlannedToolCall,
  AiAdapter,
  AdapterChatInput,
  AdapterChatResult,
  AdapterTestResult
} from '@familyco/core';

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

    if (input.tools && input.tools.length > 0) {
      const functionTools = input.tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map((parameter) => [
              parameter.name,
              {
                type: mapJsonSchemaType(parameter.type),
                description: parameter.description
              }
            ])
          ),
          required: tool.parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name),
          additionalProperties: true
        }
      }));

      requestBody.tools = Array.isArray(requestBody.tools)
        ? [...requestBody.tools, ...functionTools]
        : functionTools;
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

      const toolCalls = extractToolCalls(payload);
      if ((typeof content !== 'string' || content.trim().length === 0) && toolCalls.length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty response');
      }

      const usage = payload?.usage;
      return {
        content,
        toolCalls,
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

function extractToolCalls(payload: unknown): AdapterPlannedToolCall[] {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return [];
  }

  return payload.output
    .map((entry) => extractToolCallFromOutput(entry))
    .filter((entry): entry is AdapterPlannedToolCall => entry !== null);
}

function extractToolCallFromOutput(value: unknown): AdapterPlannedToolCall | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type !== 'function_call') {
    return null;
  }

  const name = typeof value.name === 'string' && value.name.length > 0 ? value.name : null;
  if (!name) {
    return null;
  }

  const parsedArguments = parseToolArguments(value.arguments);
  if (!parsedArguments) {
    return null;
  }

  return {
    name,
    arguments: parsedArguments
  };
}

function parseToolArguments(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapJsonSchemaType(type: string): string {
  switch (type) {
    case 'number':
    case 'integer':
    case 'boolean':
    case 'array':
    case 'object':
    case 'string':
      return type;
    default:
      return 'string';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
