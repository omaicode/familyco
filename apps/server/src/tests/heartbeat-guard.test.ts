import assert from 'node:assert/strict';
import test from 'node:test';

import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult, QueueService } from '@familyco/core';
import { AiAdapterRegistry } from '@familyco/core';

import { createApp } from '../app.js';
import {
  DefaultToolExecutor,
  HEARTBEAT_ALLOWED_TOOL_NAMES
} from '../tools/index.js';
import { TEST_API_KEY } from './test-helpers.js';

class FakeHeartbeatAdapter implements AiAdapter {
  readonly id = 'openai';
  readonly name = 'Fake Heartbeat Adapter';
  readonly description = 'Deterministic adapter for heartbeat regression tests';
  readonly keyHint = 'test';
  readonly defaultModel = 'fake-heartbeat-model';
  readonly availableModels = ['fake-heartbeat-model'];

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    if ((input.previousTurns?.length ?? 0) === 0) {
      return {
        content: '',
        toolCalls: [
          {
            name: 'task.create',
            arguments: {
              title: '',
              description: 'Should never be created during heartbeat'
            }
          }
        ]
      };
    }

    return {
      content: 'No actionable tasks found. Heartbeat stopped without creating work.',
      toolCalls: []
    };
  }

  async testConnection(_apiKey: string, model?: string): Promise<AdapterTestResult> {
    return { ok: true, latencyMs: 1, model };
  }
}

test('heartbeat executor only exposes the heartbeat tool whitelist', async () => {
  const queueService = {
    enqueue: async () => undefined,
    listPendingJobs: async () => [],
    close: async () => undefined
  } as unknown as QueueService;

  const executor = new DefaultToolExecutor().forkForHeartbeat(queueService, 'agent-l0');

  const availableToolNames = executor.listToolDefinitions().map((tool) => tool.name).sort();
  assert.deepEqual(availableToolNames, [...HEARTBEAT_ALLOWED_TOOL_NAMES].sort());

  const blockedResult = await executor.execute({
    toolName: 'task.create',
    arguments: {
      title: 'Should be blocked'
    }
  });

  assert.equal(blockedResult.ok, false);
  assert.equal(blockedResult.error?.code, 'TOOL_NOT_ALLOWED');

  const logResult = await executor.execute({
    toolName: 'task.log',
    arguments: {
      message: 'No tasks available'
    }
  });

  assert.equal(logResult.ok, true);
});

test('heartbeat AI does not create a task when an L0 agent has no actionable work', async () => {
  const adapterRegistry = new AiAdapterRegistry();
  adapterRegistry.register(new FakeHeartbeatAdapter());

  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    adapterRegistry
  });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Heartbeat Executive',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const createdAgent = createAgentResponse.json() as { id: string };

  for (const payload of [
    { key: 'provider.name', value: 'openai' },
    { key: 'provider.defaultModel', value: 'fake-heartbeat-model' },
    { key: 'provider.apiKey', value: 'test-api-key' }
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/settings',
      headers: {
        'x-api-key': TEST_API_KEY
      },
      payload
    });

    assert.equal(response.statusCode, 201);
  }

  const triggerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/heartbeat/trigger',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(triggerResponse.statusCode, 202);

  await new Promise((resolve) => setTimeout(resolve, 80));

  const tasksResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(tasksResponse.statusCode, 200);
  const tasks = tasksResponse.json() as Array<{ id: string }>;
  assert.equal(tasks.length, 0);

  const taskCreateAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=task.create',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(taskCreateAuditResponse.statusCode, 200);
  const taskCreateAudits = taskCreateAuditResponse.json() as Array<{ action: string }>;
  assert.equal(taskCreateAudits.length, 0);

  const completedAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=engine.agent.run.completed',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(completedAuditResponse.statusCode, 200);
  const completedAudits = completedAuditResponse.json() as Array<{
    targetId?: string;
    payload?: {
      heartbeatTrace?: {
        toolCalls?: Array<{ toolName?: string; ok?: boolean; error?: { code?: string } }>;
      };
    };
  }>;
  const agentAudit = completedAudits.find((record) => record.targetId === createdAgent.id);
  assert.equal(
    (agentAudit?.payload?.heartbeatTrace?.toolCalls ?? []).some(
      (call) => call.toolName === 'task.create' && call.ok === false && call.error?.code === 'TOOL_NOT_ALLOWED'
    ),
    true
  );

  await app.close();
});