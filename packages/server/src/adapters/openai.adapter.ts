import type {
  AdapterPlannedToolCall,
  AiAdapter,
  AdapterChatInput,
  AdapterChatResult,
  AdapterTestResult
} from '@familyco/core';

import { readJsonLikePayload, readProviderError, readSseStream, toAdapterErrorMessage } from './adapter.helpers.js';

export class OpenAiAdapter implements AiAdapter {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'OpenAI gpt-5-mini — best for general-purpose agents';
  readonly keyHint = 'sk-…';
  readonly defaultModel = 'gpt-5-mini';
  readonly availableModels = ['gpt-5-mini', 'gpt-5.4-mini', 'o3-mini', 'o1'] as const;

  private static readonly RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
  private static readonly TIMEOUT_MS = 25_000;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const toolNameMap = new Map<string, string>();
    const requestBody: Record<string, unknown> = {
      model: input.model,
      stream: true,
      max_tool_calls: 5,
      input: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt }
      ]
    };

    if (supportsOpenAiTemperature(input.model)) {
      requestBody.temperature = 0.5;
    }

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

    if (supportsOpenAiReasoning(input.model)) {
      requestBody.reasoning = { effort: 'medium' };
    }

    if (input.tools && input.tools.length > 0) {
      const functionTools = input.tools.map((tool) => {
        const openAiToolName = toOpenAiToolName(tool.name, toolNameMap);

        return {
          type: 'function',
          name: openAiToolName,
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
        };
      });

      requestBody.tools = Array.isArray(requestBody.tools)
        ? [...requestBody.tools, ...functionTools]
        : functionTools;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OpenAiAdapter.TIMEOUT_MS);

    try {
      if(process.env.NODE_ENV === 'development') {
        console.debug(`[OpenAiAdapter] Sending request to OpenAI with body: ${JSON.stringify(requestBody)}`);
      }

      const response = await fetch(OpenAiAdapter.RESPONSES_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${input.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if(process.env.NODE_ENV === 'development') {
        console.debug(`[OpenAiAdapter] Received response`, response);
      }
      
      if (!response.ok) {
        const payload = await readJsonLikePayload(response);
        throw new Error(readProviderError('openai', payload));
      }

      let streamedText = '';
      let completedResponse: unknown = null;
      await readSseStream(response, (data) => {
        if (data === '[DONE]') {
          return;
        }

        const eventPayload = tryParseJson(data);
        if (!isRecord(eventPayload)) {
          return;
        }

        if (eventPayload.type === 'response.output_text.delta') {
          const delta = asOptionalString(eventPayload.delta);
          if (delta) {
            streamedText += delta;
            input.onChunk?.(delta);
          }
          return;
        }

        if (eventPayload.type === 'response.completed' && isRecord(eventPayload.response)) {
          completedResponse = eventPayload.response;
        }
      });

      const payload = completedResponse;
      const content =
        streamedText.trim().length > 0
          ? streamedText
          : (
              (typeof (payload as { output_text?: unknown } | null)?.output_text === 'string'
                ? (payload as { output_text: string }).output_text
                : null) ??
              (Array.isArray((payload as { output?: unknown[] } | null)?.output)
                ? (payload as { output: Array<{ content?: Array<{ text?: string }> }> }).output
                    .flatMap((item) => item?.content ?? [])
                    .map((part) => part?.text ?? '')
                    .join('\n')
                    .trim()
                : '')
            );

      const toolCalls = extractToolCalls(payload, toolNameMap);
      if ((typeof content !== 'string' || content.trim().length === 0) && toolCalls.length === 0) {
        throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty response');
      }

      const usage = readOpenAiUsage(payload);
      return {
        content,
        toolCalls,
        tokenUsage: usage
          ? {
              prompt: usage.prompt,
              completion: usage.completion,
              total: usage.total
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
          model: 'gpt-5.4-mini',
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

      return { ok: true, latencyMs, model: 'gpt-5.4-mini' };
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

function supportsOpenAiReasoning(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('gpt-5') || normalized.startsWith('o3') || normalized.startsWith('o4');
}

function supportsOpenAiTemperature(model: string): boolean {
  return !supportsOpenAiReasoning(model);
}

function extractToolCalls(payload: unknown, toolNameMap: ReadonlyMap<string, string>): AdapterPlannedToolCall[] {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return [];
  }

  return payload.output
    .map((entry) => extractToolCallFromOutput(entry, toolNameMap))
    .filter((entry): entry is AdapterPlannedToolCall => entry !== null);
}

function extractToolCallFromOutput(
  value: unknown,
  toolNameMap: ReadonlyMap<string, string>
): AdapterPlannedToolCall | null {
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
    name: toolNameMap.get(name) ?? name,
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

function toOpenAiToolName(
  originalName: string,
  toolNameMap: Map<string, string>
): string {
  const base = originalName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^[^a-zA-Z_]+/, '');
  const normalizedBase = base.length > 0 ? base : 'tool';
  let candidate = normalizedBase.slice(0, 64);
  let suffix = 1;

  while (toolNameMap.has(candidate) && toolNameMap.get(candidate) !== originalName) {
    const suffixText = `_${suffix}`;
    candidate = `${normalizedBase.slice(0, Math.max(64 - suffixText.length, 1))}${suffixText}`;
    suffix += 1;
  }

  toolNameMap.set(candidate, originalName);
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readOpenAiUsage(payload: unknown): { prompt: number; completion: number; total: number } | undefined {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return undefined;
  }

  const prompt = asOptionalNumber(payload.usage.input_tokens) ?? asOptionalNumber(payload.usage.prompt_tokens) ?? 0;
  const completion = asOptionalNumber(payload.usage.output_tokens) ?? asOptionalNumber(payload.usage.completion_tokens) ?? 0;
  const total = asOptionalNumber(payload.usage.total_tokens) ?? prompt + completion;
  return { prompt, completion, total };
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
