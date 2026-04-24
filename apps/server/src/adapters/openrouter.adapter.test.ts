import assert from 'node:assert/strict';
import test from 'node:test';

import { OpenRouterAdapter } from './openrouter.adapter.js';

test('OpenRouterAdapter: sends requests to OpenRouter base URL', async () => {
  const adapter = new OpenRouterAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    assert.match(url, /openrouter\.ai\/api\/v1/u);

    return createResponsesTextResponse('hello from openrouter');
  };

  try {
    const result = await adapter.testConnection('sk-or-test', 'openai/gpt-5-mini');
    assert.equal(result.ok, true);
    assert.equal(result.model, 'openai/gpt-5-mini');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenRouterAdapter: falls back to default model for unsupported values', async () => {
  const adapter = new OpenRouterAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['model'], 'openai/gpt-5-mini');
    return createResponsesTextResponse('pong');
  };

  try {
    const result = await adapter.testConnection('sk-or-test', 'unsupported/model');
    assert.equal(result.ok, true);
    assert.equal(result.model, 'openai/gpt-5-mini');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

function sseChunk(data: Record<string, unknown> | '[DONE]'): string {
  return data === '[DONE]'
    ? 'data: [DONE]\\n\\n'
    : `data: ${JSON.stringify(data)}\\n\\n`;
}

function createResponsesTextResponse(text: string): Response {
  const chunks = [
    sseChunk({
      type: 'response.created',
      response: { id: 'resp-1', created_at: 1, model: 'openai/gpt-5-mini' }
    }),
    sseChunk({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: 'msg-1', phase: 'final_answer' }
    }),
    sseChunk({
      type: 'response.output_text.delta',
      item_id: 'msg-1',
      delta: text
    }),
    sseChunk({
      type: 'response.output_item.done',
      output_index: 0,
      item: { type: 'message', id: 'msg-1', phase: 'final_answer' }
    }),
    sseChunk({
      type: 'response.completed',
      response: { usage: { input_tokens: 1, output_tokens: 1 } }
    }),
    sseChunk('[DONE]')
  ].join('');

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(chunks));
      controller.close();
    }
  });

  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  });
}
