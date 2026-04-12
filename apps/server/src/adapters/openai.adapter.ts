import type {
  AiAdapter,
  AdapterAudioTranscriptionInput,
  AdapterAudioTranscriptionResult,
  AdapterChatInput,
  AdapterChatResult,
  AdapterTestResult
} from '@familyco/core';

import { createOpenAI } from '@ai-sdk/openai';
import { experimental_transcribe as transcribe, streamText } from 'ai';

import { toAdapterErrorMessage } from './adapter.helpers.js';
import { buildCoreMessages, buildVercelTools } from './vercel-adapter.helpers.js';

const OPENAI_MODELS = ['gpt-5', 'gpt-5-mini', 'gpt-5.4', 'gpt-5.4-mini'] as const;

export class OpenAiAdapter implements AiAdapter {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly description = 'OpenAI gpt-5-mini — best for general-purpose agents';
  readonly keyHint = 'sk-…';
  readonly defaultModel = 'gpt-5-mini';
  readonly availableModels = OPENAI_MODELS;

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const openai = createOpenAI({ apiKey: input.apiKey });
    const toolSet = input.tools && input.tools.length > 0 ? buildVercelTools(input.tools) : undefined;
    const model = resolveOpenAiModel(input.model);

    const result = streamText({
      model: openai(model),
      system: input.systemPrompt,
      messages: buildCoreMessages(input.userPrompt, input.previousTurns ?? [], input.attachments ?? []),
      tools: toolSet?.tools,
      abortSignal: input.abortSignal,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          input.onChunk?.(chunk.text);
        }
      },
      ...(supportsOpenAiReasoning(model)
        ? { providerOptions: { openai: { reasoningEffort: 'medium' } } }
        : { temperature: 0.5 })
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
      throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty response');
    }

    return {
      content: text,
      toolCalls,
      tokenUsage: usage
        ? { prompt: usage.inputTokens ?? 0, completion: usage.outputTokens ?? 0, total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) }
        : undefined
    };
  }

  async transcribeAudio(input: AdapterAudioTranscriptionInput): Promise<AdapterAudioTranscriptionResult> {
    const openai = createOpenAI({ apiKey: input.apiKey });
    const result = await transcribe({
      model: openai.transcription('gpt-4o-mini-transcribe'),
      audio: Buffer.from(input.audio),
      abortSignal: input.abortSignal
    });

    return { text: result.text };
  }

  async testConnection(apiKey: string, model?: string): Promise<AdapterTestResult> {
    const start = Date.now();
    const resolvedModel = resolveOpenAiModel(model);
    try {
      const openai = createOpenAI({ apiKey });
      const result = streamText({
        model: openai(resolvedModel),
        messages: [{ role: 'user', content: 'ping' }],
        maxOutputTokens: 1,
      });
      await result.text;
      return { ok: true, latencyMs: Date.now() - start, model: resolvedModel };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - start, error: toAdapterErrorMessage(error) };
    }
  }
}

function resolveOpenAiModel(model: string | undefined): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return 'gpt-5-mini';
  }

  return OPENAI_MODELS.includes(trimmed as typeof OPENAI_MODELS[number]) ? trimmed : 'gpt-5-mini';
}

function supportsOpenAiReasoning(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    (normalized.startsWith('gpt-5') && !normalized.startsWith('gpt-5-chat'))
  );
}
