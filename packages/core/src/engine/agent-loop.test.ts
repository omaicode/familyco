import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runAgentLoop } from './agent-loop.js';
import type { AgentLoopEvent } from './agent-loop.js';
import type { AiAdapter, AdapterChatInput, AdapterChatResult } from '../ai-adapter/index.js';

function makeAdapter(responses: Partial<AdapterChatResult>[]): AiAdapter {
  let callCount = 0;
  return {
    id: 'test',
    name: 'Test Adapter',
    description: 'Mock adapter for tests',
    logoId: 'test',
    keyHint: 'test-key',
    authType: 'apikey',
    supportedAuthTypes: ['apikey'],
    defaultAuthType: 'apikey',
    defaultModel: 'test-model',
    availableModels: ['test-model'],
    chat: async (input: AdapterChatInput): Promise<AdapterChatResult> => {
      const resp = responses[callCount] ?? {};
      callCount += 1;

      const content = resp.content ?? '';
      const toolCalls = resp.toolCalls ?? [];

      // Fire onChunk if content is non-empty
      if (content && input.onChunk) {
        input.onChunk(content);
      }

      return {
        content,
        toolCalls,
        tokenUsage: { prompt: 0, completion: 0, total: 0 }
      };
    },
    testConnection: async () => ({ ok: true, latencyMs: 0 })
  };
}

describe('runAgentLoop', () => {
  it('returns finalReply from a single text response', async () => {
    const adapter = makeAdapter([{ content: 'Hello, world!' }]);
    const result = await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Say hello',
      executeTool: async () => ({ ok: true })
    });

    assert.equal(result.finalReply, 'Hello, world!');
    assert.equal(result.totalTurns, 0);
    assert.deepEqual(result.turns, []);
  });

  it('emits chunk events while streaming', async () => {
    const adapter = makeAdapter([{ content: 'streaming text' }]);
    const events: AgentLoopEvent[] = [];

    await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'stream me',
      onEvent: (e) => events.push(e),
      executeTool: async () => ({ ok: true })
    });

    const chunkEvents = events.filter((e) => e.type === 'chunk');
    assert.equal(chunkEvents.length, 1);
    assert.equal((chunkEvents[0] as Extract<AgentLoopEvent, { type: 'chunk' }>).text, 'streaming text');
  });

  it('emits done event at the end', async () => {
    const adapter = makeAdapter([{ content: 'final answer' }]);
    const events: AgentLoopEvent[] = [];

    await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'finish',
      onEvent: (e) => events.push(e),
      executeTool: async () => ({ ok: true })
    });

    const doneEvent = events.find((e) => e.type === 'done') as Extract<AgentLoopEvent, { type: 'done' }> | undefined;
    assert.ok(doneEvent);
    assert.equal(doneEvent.finalReply, 'final answer');
  });

  it('executes tool call and continues to next round', async () => {
    const adapter = makeAdapter([
      { content: '', toolCalls: [{ name: 'echo', arguments: { msg: 'hi' } }] },
      { content: 'Done after tool.' }
    ]);

    const executed: string[] = [];
    const result = await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'use echo',
      executeTool: async (input) => {
        executed.push(input.toolName);
        return { ok: true, output: { echoed: input.arguments.msg } };
      }
    });

    assert.deepEqual(executed, ['echo']);
    assert.equal(result.finalReply, 'Done after tool.');
    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0].toolResults[0].toolName, 'echo');
    assert.equal(result.turns[0].toolResults[0].ok, true);
  });

  it('emits tool_start and tool_result events', async () => {
    const adapter = makeAdapter([
      { content: '', toolCalls: [{ name: 'task.create', arguments: { title: 'New task' } }] },
      { content: 'Task created.' }
    ]);

    const events: AgentLoopEvent[] = [];

    await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'create task',
      onEvent: (e) => events.push(e),
      executeTool: async () => ({ ok: true, output: { id: '123', title: 'New task' } })
    });

    const toolStart = events.find((e) => e.type === 'tool_start') as Extract<AgentLoopEvent, { type: 'tool_start' }> | undefined;
    const toolResult = events.find((e) => e.type === 'tool_result') as Extract<AgentLoopEvent, { type: 'tool_result' }> | undefined;

    assert.ok(toolStart);
    assert.equal(toolStart.toolName, 'task.create');
    assert.deepEqual(toolStart.input, { title: 'New task' });

    assert.ok(toolResult);
    assert.equal(toolResult.toolName, 'task.create');
    assert.equal(toolResult.ok, true);
  });

  it('deduplicates identical tool calls across rounds', async () => {
    // Both rounds return the same tool call → should only execute once
    const adapter = makeAdapter([
      { content: '', toolCalls: [{ name: 'echo', arguments: { x: 1 } }] },
      { content: '', toolCalls: [{ name: 'echo', arguments: { x: 1 } }] },
      { content: 'Finally done.' }
    ]);

    const executed: string[] = [];
    await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'dedup',
      executeTool: async (input) => {
        executed.push(input.toolName);
        return { ok: true };
      }
    });

    assert.equal(executed.length, 1);
  });

  it('stops after maxRounds', async () => {
    // Always returns a tool call — loop should stop at maxRounds
    const adapter = makeAdapter(
      Array.from({ length: 10 }, () => ({
        content: '',
        toolCalls: [{ name: 'infinite', arguments: {} }]
      }))
    );

    const executed: string[] = [];
    await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'loop',
      maxRounds: 3,
      executeTool: async (input) => {
        executed.push(input.toolName);
        return { ok: true };
      }
    });

    assert.ok(executed.length <= 3, `Expected at most 3 executions, got ${executed.length}`);
  });

  it('handles tool execution failure gracefully', async () => {
    const adapter = makeAdapter([
      { content: '', toolCalls: [{ name: 'bad.tool', arguments: {} }] },
      { content: 'Acknowledged failure.' }
    ]);

    const result = await runAgentLoop({
      adapter,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'fail',
      executeTool: async () => ({
        ok: false,
        error: { code: 'TOOL_ERROR', message: 'Something went wrong' }
      })
    });

    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0].toolResults[0].ok, false);
    assert.equal(result.turns[0].toolResults[0].error?.code, 'TOOL_ERROR');
  });

  it('accumulates previousTurns for multi-step context', async () => {
    const receivedPreviousTurns: unknown[][] = [];
    const adapterWithSpy: AiAdapter = {
      id: 'test',
      name: 'Test',
      description: 'Spy adapter',
      logoId: 'test',
      keyHint: 'key',
      authType: 'apikey',
      supportedAuthTypes: ['apikey'],
      defaultAuthType: 'apikey',
      defaultModel: 'test-model',
      availableModels: ['test-model'],
      chat: async (input: AdapterChatInput): Promise<AdapterChatResult> => {
        receivedPreviousTurns.push([...(input.previousTurns ?? [])]);

        if ((input.previousTurns ?? []).length === 0) {
          return {
            content: '',
            toolCalls: [{ name: 'step1', arguments: {} }],
            tokenUsage: { prompt: 0, completion: 0, total: 0 }
          };
        }

        return {
          content: 'Multi-step done.',
          toolCalls: [],
          tokenUsage: { prompt: 0, completion: 0, total: 0 }
        };
      },
      testConnection: async () => ({ ok: true, latencyMs: 0 })
    };

    await runAgentLoop({
      adapter: adapterWithSpy,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'multi-step',
      executeTool: async () => ({ ok: true, output: 'step1 result' })
    });

    // Second round should have one previousTurn from round 0
    assert.equal(receivedPreviousTurns.length, 2);
    assert.equal(receivedPreviousTurns[0].length, 0);
    assert.equal(receivedPreviousTurns[1].length, 1);
  });

  it('truncates oversized nested tool output fields to preserve turn payload', async () => {
    let secondRoundOutput = '';
    const adapterWithSpy: AiAdapter = {
      id: 'test',
      name: 'Test',
      description: 'Spy adapter',
      logoId: 'test',
      keyHint: 'key',
      authType: 'apikey',
      supportedAuthTypes: ['apikey'],
      defaultAuthType: 'apikey',
      defaultModel: 'test-model',
      availableModels: ['test-model'],
      chat: async (input: AdapterChatInput): Promise<AdapterChatResult> => {
        if ((input.previousTurns?.length ?? 0) === 0) {
          return {
            content: '',
            toolCalls: [{ name: 'task.list', arguments: { status: 'pending' } }],
            tokenUsage: { prompt: 0, completion: 0, total: 0 }
          };
        }

        secondRoundOutput = input.previousTurns?.[0]?.toolInteractions?.[0]?.output ?? '';
        return {
          content: 'done',
          toolCalls: [],
          tokenUsage: { prompt: 0, completion: 0, total: 0 }
        };
      },
      testConnection: async () => ({ ok: true, latencyMs: 0 })
    };

    const hugeDescription = 'x'.repeat(20_000);
    await runAgentLoop({
      adapter: adapterWithSpy,
      apiKey: 'key',
      model: 'gpt-4o',
      systemPrompt: '',
      userPrompt: 'huge payload',
      executeTool: async () => ({
        ok: true,
        output: {
          total: 1,
          items: [
            {
              id: 'task-1',
              title: 'Huge',
              description: hugeDescription
            }
          ]
        }
      })
    });

    assert.equal(secondRoundOutput.length > 0, true);
    assert.equal(secondRoundOutput.includes('"id":"task-1"'), true);
    assert.equal(secondRoundOutput.includes(hugeDescription), false);
  });
});
