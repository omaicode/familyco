import assert from 'node:assert/strict';
import test from 'node:test';
import { AiAdapterRegistry, type AiAdapter } from '@familyco/core';

import { chatRespondTool, parseConversationHistory, resolveToolCallQueue } from './chat-respond.tool.js';

test('resolveToolCallQueue executes planned calls', () => {
  const queue = resolveToolCallQueue({
    requestedToolCalls: [],
    plannedToolCalls: [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }]
  });

  assert.deepEqual(queue, [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }]);
});

test('resolveToolCallQueue keeps explicit requested calls', () => {
  const queue = resolveToolCallQueue({
    requestedToolCalls: [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }],
    plannedToolCalls: [{ toolName: 'task.create', arguments: { title: 'ignored' } }]
  });

  assert.deepEqual(queue, [{ toolName: 'project.create', arguments: { name: 'Q2 Workspace' } }]);
});

test('resolveToolCallQueue executes planned calls when no explicit call is provided', () => {
  const queue = resolveToolCallQueue({
    requestedToolCalls: [],
    plannedToolCalls: [{ toolName: 'task.create', arguments: { title: 'Run weekly review' } }]
  });

  assert.deepEqual(queue, [{ toolName: 'task.create', arguments: { title: 'Run weekly review' } }]);
});

test('parseConversationHistory keeps toolCalls from prior messages', () => {
  const history = parseConversationHistory([
    {
      senderId: 'agent-l0',
      body: 'Created project.',
      toolCalls: [
        { toolName: 'project.create', ok: true, summary: 'Project created', outputJson: '{"id":"proj-1"}' },
        { toolName: 'task.create', ok: false, summary: 'Task failed', error: { message: 'INVALID_PROJECT' } }
      ]
    }
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0]?.toolCalls?.length, 2);
  assert.equal(history[0]?.toolCalls?.[0]?.toolName, 'project.create');
  assert.equal(history[0]?.toolCalls?.[0]?.outputJson, '{"id":"proj-1"}');
  assert.equal(history[0]?.toolCalls?.[1]?.error?.message, 'INVALID_PROJECT');
});

test('chat.respond executes planned tool calls across multiple planning rounds', async () => {
  class PlannedRoundsAdapter implements AiAdapter {
    readonly id = 'openai';
    readonly name = 'OpenAI';
    readonly description = 'test adapter';
    readonly keyHint = 'sk-…';
    readonly defaultModel = 'gpt-5-mini';
    readonly availableModels = ['gpt-5-mini'] as const;

    private index = 0;

    async chat(_input: Parameters<AiAdapter['chat']>[0]) {
      this.index += 1;
      if (this.index === 1) {
        return {
          content: '',
          toolCalls: [{ name: 'task.create', arguments: { title: 'Prepare report' } }]
        };
      }
      if (this.index === 2) {
        return {
          content: 'Continuing execution.',
          toolCalls: [{ name: 'project.create', arguments: { name: 'Weekly Ops' } }]
        };
      }

      return {
        content: 'Done.',
        toolCalls: []
      };
    }

    async testConnection() {
      return { ok: true, latencyMs: 1, model: 'gpt-5-mini' };
    }
  }

  const adapterRegistry = new AiAdapterRegistry();
  adapterRegistry.register(new PlannedRoundsAdapter());

  const executedTools: string[] = [];
  const context = {
    executeTool: async (input: { toolName: string; arguments: Record<string, unknown> }) => {
      if (input.toolName === 'company.profile.read') {
        return { ok: true, toolName: input.toolName, output: { companyName: 'FamilyCo', companyDescription: 'Test' } };
      }
      executedTools.push(input.toolName);
      return { ok: true, toolName: input.toolName, output: { id: `${input.toolName}-1` } };
    },
    listTools: () => [
      { name: 'task.create', description: 'Create task', parameters: [] },
      { name: 'project.create', description: 'Create project', parameters: [] }
    ],
    settingsService: {
      get: async (key: string) => {
        const valueMap: Record<string, unknown> = {
          'provider.name': 'openai',
          'provider.apiKey': 'sk-test',
          'provider.defaultModel': 'gpt-5-mini'
        };
        if (!(key in valueMap)) {
          return null;
        }
        return { key, value: valueMap[key], updatedAt: new Date() };
      }
    },
    skillsService: undefined,
    adapterRegistry,
    agentService: undefined,
    projectService: undefined,
    taskService: undefined
  } as unknown as Parameters<typeof chatRespondTool.execute>[1];

  const result = await chatRespondTool.execute(
    {
      message: 'Please set this up.',
      conversationHistory: []
    },
    context
  );

  assert.equal(result.ok, true);
  assert.deepEqual(executedTools, ['task.create', 'project.create']);
  const output = result.output as { toolCalls?: unknown[] } | undefined;
  assert.equal(Array.isArray(output?.toolCalls), true);
  assert.equal(output?.toolCalls?.length, 2);
});
