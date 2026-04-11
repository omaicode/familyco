import assert from 'node:assert/strict';
import test from 'node:test';

import { OpenAiAdapter } from './openai.adapter.js';

test('OpenAiAdapter: gpt-5 streams text through the responses API', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['model'], 'gpt-5');
    assert.ok(Array.isArray(body['input']));
    assert.deepEqual(body['reasoning'], { effort: 'medium' });
    return createResponsesTextResponse('hello from openai');
  };

  try {
    const chunks: string[] = [];
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5',
      systemPrompt: 'system',
      userPrompt: 'hello',
      onChunk: (chunk) => chunks.push(chunk)
    });

    assert.equal(result.content, 'hello from openai');
    assert.deepEqual(chunks, ['hello from openai']);
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: gpt-5-mini sends reasoning settings through the responses API', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['model'], 'gpt-5-mini');
    assert.deepEqual(body['reasoning'], { effort: 'medium' });
    return createResponsesTextResponse('gpt5-mini result');
  };

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5-mini',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.content, 'gpt5-mini result');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: gpt-5.4 is passed through without aliasing', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['model'], 'gpt-5.4');
    assert.deepEqual(body['reasoning'], { effort: 'medium' });
    return createResponsesTextResponse('gpt5.4 result');
  };

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5.4',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.content, 'gpt5.4 result');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: tool calls restore original dotted name', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async () => createResponsesToolCallResponse('task_create', { title: 'New task' });

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5-mini',
      systemPrompt: 'system',
      userPrompt: 'create a task',
      tools: [
        {
          name: 'task.create',
          description: 'Create a task',
          parameters: [{ name: 'title', type: 'string', description: 'Task title', required: true }]
        }
      ]
    });

    assert.equal(result.toolCalls?.length, 1);
    assert.equal(result.toolCalls?.[0]?.name, 'task.create');
    assert.deepEqual(result.toolCalls?.[0]?.arguments, { title: 'New task' });
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: token usage is extracted from responses streams', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async () => createResponsesTextResponseWithUsage('hi', 10, 5);

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5.4-mini',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.tokenUsage?.prompt, 10);
    assert.equal(result.tokenUsage?.completion, 5);
    assert.equal(result.tokenUsage?.total, 15);
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: testConnection uses the requested GPT-5 family model', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['model'], 'gpt-5.4-mini');
    return createResponsesTextResponse('pong');
  };

  try {
    const result = await adapter.testConnection('sk-test', 'gpt-5.4-mini');
    assert.equal(result.ok, true);
    assert.equal(result.model, 'gpt-5.4-mini');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

function sseChunk(data: Record<string, unknown> | '[DONE]'): string {
  return data === '[DONE]'
    ? 'data: [DONE]\n\n'
    : `data: ${JSON.stringify(data)}\n\n`;
}

function createResponsesTextResponse(text: string): Response {
  const chunks = [
    sseChunk({
      type: 'response.created',
      response: { id: 'resp-1', created_at: 1, model: 'gpt-5' }
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

  return makeStreamResponse(chunks);
}

function createResponsesTextResponseWithUsage(
  text: string,
  promptTokens: number,
  completionTokens: number
): Response {
  const chunks = [
    sseChunk({
      type: 'response.created',
      response: { id: 'resp-1', created_at: 1, model: 'gpt-5.4-mini' }
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
      response: { usage: { input_tokens: promptTokens, output_tokens: completionTokens } }
    }),
    sseChunk('[DONE]')
  ].join('');

  return makeStreamResponse(chunks);
}

function createResponsesToolCallResponse(
  toolName: string,
  args: Record<string, unknown>
): Response {
  const argumentsJson = JSON.stringify(args);
  const chunks = [
    sseChunk({
      type: 'response.created',
      response: { id: 'resp-1', created_at: 1, model: 'gpt-5-mini' }
    }),
    sseChunk({
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'fc-1',
        call_id: 'call_abc',
        name: toolName,
        arguments: ''
      }
    }),
    sseChunk({
      type: 'response.function_call_arguments.delta',
      item_id: 'fc-1',
      output_index: 0,
      delta: argumentsJson
    }),
    sseChunk({
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'fc-1',
        call_id: 'call_abc',
        name: toolName,
        arguments: argumentsJson,
        status: 'completed'
      }
    }),
    sseChunk({
      type: 'response.completed',
      response: { usage: { input_tokens: 1, output_tokens: 1 } }
    }),
    sseChunk('[DONE]')
  ].join('');

  return makeStreamResponse(chunks);
}

function makeStreamResponse(payload: string): Response {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    }
  });

  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  });
}
