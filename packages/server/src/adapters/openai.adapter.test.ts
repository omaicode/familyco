import assert from 'node:assert/strict';
import test from 'node:test';

import { OpenAiAdapter } from './openai.adapter.js';

test('OpenAiAdapter sends gpt-5-mini payload without reasoning', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return createSseResponse();
  };

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5-mini',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.content, 'hello from openai');
    assert.equal(requestBody?.['temperature'], 0.5);
    assert.equal('reasoning' in (requestBody ?? {}), false);
    assert.equal('text' in (requestBody ?? {}), false);
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter sends reasoning payload for o-series without temperature', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return createSseResponse();
  };

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'o3-mini',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.content, 'hello from openai');
    assert.deepEqual(requestBody?.['reasoning'], { effort: 'medium' });
    assert.equal('temperature' in (requestBody ?? {}), false);
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

function createSseResponse(): Response {
  const payload = [
    'data: {"type":"response.output_text.delta","delta":"hello from openai"}\n\n',
    'data: {"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}\n\n',
    'data: [DONE]\n\n'
  ].join('');

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    }
  });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream'
    }
  });
}
