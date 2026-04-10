import assert from 'node:assert/strict';
import test from 'node:test';

import { OpenAiAdapter } from './openai.adapter.js';

test('OpenAiAdapter: gpt-4o-mini returns streamed content with temperature', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['temperature'], 0.5);
    assert.equal(body['reasoning_effort'], undefined);
    return createChatCompletionSseResponse('hello from openai');
  };

  try {
    const chunks: string[] = [];
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      systemPrompt: 'system',
      userPrompt: 'hello',
      onChunk: (c) => chunks.push(c)
    });

    assert.equal(result.content, 'hello from openai');
    assert.deepEqual(chunks, ['hello from openai']);
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: gpt-5-mini sends reasoningEffort (treated as reasoning model by SDK)', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['reasoning_effort'], 'medium');
    assert.equal(body['temperature'], undefined);
    return createChatCompletionSseResponse('gpt5 result');
  };

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5-mini',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.content, 'gpt5 result');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: o3-mini sends reasoningEffort without temperature', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body['reasoning_effort'], 'medium');
    assert.equal(body['temperature'], undefined);
    return createChatCompletionSseResponse('reasoning result');
  };

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'o3-mini',
      systemPrompt: 'system',
      userPrompt: 'hello'
    });

    assert.equal(result.content, 'reasoning result');
  } finally {
    globalThis.fetch = restoreFetch;
  }
});

test('OpenAiAdapter: tool calls restore original dotted name', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async () => createChatCompletionSseResponseWithToolCall(
    'task_create',
    { title: 'New task' }
  );

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
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

test('OpenAiAdapter: token usage is extracted from stream', async () => {
  const adapter = new OpenAiAdapter();
  const restoreFetch = globalThis.fetch;

  globalThis.fetch = async () => createChatCompletionSseResponseWithUsage('hi', 10, 5, 15);

  try {
    const result = await adapter.chat({
      apiKey: 'sk-test',
      model: 'gpt-5-mini',
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

function sseChunk(data: string): string {
  return `data: ${data}\n\n`;
}

function createChatCompletionSseResponse(text: string): Response {
  const chunks = [
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }]
    })),
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
    })),
    'data: [DONE]\n\n'
  ].join('');

  return makeStreamResponse(chunks);
}

function createChatCompletionSseResponseWithUsage(
  text: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number
): Response {
  const chunks = [
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }]
    })),
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens }
    })),
    'data: [DONE]\n\n'
  ].join('');

  return makeStreamResponse(chunks);
}

function createChatCompletionSseResponseWithToolCall(
  toolName: string,
  args: Record<string, unknown>
): Response {
  const chunks = [
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [{
            index: 0,
            id: 'call_abc',
            type: 'function',
            function: { name: toolName, arguments: '' }
          }]
        },
        finish_reason: null
      }]
    })),
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: JSON.stringify(args) }
          }]
        },
        finish_reason: null
      }]
    })),
    sseChunk(JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'gpt-5-mini',
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }]
    })),
    'data: [DONE]\n\n'
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

