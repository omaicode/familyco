import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { runSocketChat, TEST_API_KEY } from './test-helpers.js';

test('P1 routes: setup, socket chat, settings, and inbox flow work with a single L0 default', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const setupResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/setup/initialize',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      companyName: 'FamilyCo Test',
      companyDescription: 'Help founders operate with AI-native execution, approval safety, and delivery visibility.'
    }
  });

  assert.equal(setupResponse.statusCode, 201);
  const setupPayload = setupResponse.json() as {
    companyDescription: string;
    executiveAgent: { id: string };
    defaultProject: { id: string; ownerAgentId: string };
  };
  assert.equal(
    setupPayload.companyDescription,
    'Help founders operate with AI-native execution, approval safety, and delivery visibility.'
  );

  const l0Id = setupPayload.executiveAgent.id;
  const defaultProjectId = setupPayload.defaultProject.id;
  assert.equal(setupPayload.defaultProject.ownerAgentId, l0Id);

  const childrenResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/agents/${l0Id}/children`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(childrenResponse.statusCode, 200);
  const children = childrenResponse.json() as Array<{ id: string }>;
  assert.equal(children.length, 0);

  const createTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Review current backlog',
      description: 'Check delayed work and prepare a recovery plan.'
    }
  });

  assert.equal(createTaskResponse.statusCode, 201);
  const createdTask = createTaskResponse.json() as { assigneeAgentId: string | null; projectId: string };
  assert.equal(createdTask.assigneeAgentId, l0Id);
  assert.equal(createdTask.projectId, defaultProjectId);

  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const chatSocketUrl = `${address.replace('http://', 'ws://')}/api/v1/agents/${l0Id}/chat/stream?apiKey=${TEST_API_KEY}`;

  const planningEvents = await runSocketChat(
    chatSocketUrl,
    'Review the current backlog and outline the next steps for the company this week.'
  );
  assert.equal(planningEvents.some((event) => event.type === 'chat.started'), true);
  assert.equal(planningEvents.some((event) => event.type === 'chat.chunk'), true);
  assert.equal(planningEvents.some((event) => event.type === 'chat.tool.used'), false);

  const planningTaskListResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(planningTaskListResponse.statusCode, 200);
  assert.equal((planningTaskListResponse.json() as Array<{ id: string }>).length, 1);

  const requestOnlyEvents = await runSocketChat(
    chatSocketUrl,
    'Create a task to follow up on onboarding improvements and keep it in the executive queue.'
  );
  assert.equal(requestOnlyEvents.some((event) => event.type === 'chat.tool.used'), false);

  const helpEvents = await runSocketChat(chatSocketUrl, '/help');
  const helpCompletedEvent = helpEvents.find((event) => event.type === 'chat.completed');
  assert.equal(typeof helpCompletedEvent?.payload?.reply, 'string');
  assert.equal(String(helpCompletedEvent?.payload?.reply).includes('/create-task'), true);

  const slashCreateTaskEvents = await runSocketChat(
    chatSocketUrl,
    '/create-task Prepare a weekly onboarding follow-up for the executive queue'
  );
  assert.equal(slashCreateTaskEvents.some((event) => event.type === 'chat.tool.used'), true);

  const slashCreateProjectEvents = await runSocketChat(
    chatSocketUrl,
    '/create-project Launch the Q2 operating cadence workspace for weekly founder reviews'
  );
  assert.equal(slashCreateProjectEvents.some((event) => event.type === 'chat.tool.used'), true);

  const taskCountAfterNaturalLanguageRequest = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(taskCountAfterNaturalLanguageRequest.statusCode, 200);
  assert.equal((taskCountAfterNaturalLanguageRequest.json() as Array<{ id: string }>).length, 2);

  const toolEvents = await runSocketChat(
    chatSocketUrl,
    'Please track onboarding improvements in the executive queue.',
    {
      toolCall: {
        toolName: 'task.create',
        arguments: {
          title: 'Follow up on onboarding improvements',
          description: 'Keep this work in the executive queue for structured tracking.'
        }
      }
    }
  );
  assert.equal(toolEvents.some((event) => event.type === 'chat.tool.used'), true);

  const fallbackToolEvents = await runSocketChat(
    chatSocketUrl,
    'Create a task even if the tool arguments contain loose references.',
    {
      toolCall: {
        toolName: 'task.create',
        arguments: {
          title: 'Normalize invalid references',
          description: 'Should fall back to the executive defaults instead of failing.',
          projectId: 'FamilyCo Test Executive Queue',
          assigneeAgentId: 'Chief of Staff',
          createdBy: 'founder'
        }
      }
    }
  );
  assert.equal(fallbackToolEvents.some((event) => event.type === 'chat.tool.used'), true);

  const threadResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/agents/${l0Id}/chat`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(threadResponse.statusCode, 200);
  const thread = threadResponse.json() as Array<{ senderId: string; recipientId: string }>;
  assert.equal(thread.length >= 6, true);

  const allTasksAfterToolResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(allTasksAfterToolResponse.statusCode, 200);
  const allTasksAfterTool = allTasksAfterToolResponse.json() as Array<{
    id: string;
    title: string;
    projectId: string;
    assigneeAgentId: string | null;
    createdBy: string;
  }>;
  assert.equal(allTasksAfterTool.length, 4);
  assert.equal(allTasksAfterTool.some((task) => task.projectId === defaultProjectId), true);
  const fallbackTask = allTasksAfterTool.find((task) => task.title === 'Normalize invalid references');
  assert.ok(fallbackTask);
  assert.equal(fallbackTask?.projectId, defaultProjectId);
  assert.equal(fallbackTask?.assigneeAgentId, l0Id);
  assert.equal(fallbackTask?.createdBy, l0Id);
  const slashTask = allTasksAfterTool.find((task) => task.title.includes('weekly onboarding follow-up'));
  assert.ok(slashTask);

  const resetEvents = await runSocketChat(chatSocketUrl, '/reset');
  const resetCompletedEvent = resetEvents.find((event) => event.type === 'chat.completed');
  assert.equal(typeof resetCompletedEvent?.payload?.reply, 'string');
  assert.equal(String(resetCompletedEvent?.payload?.reply).includes('cleared'), true);

  const threadAfterResetResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/agents/${l0Id}/chat`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(threadAfterResetResponse.statusCode, 200);
  const threadAfterReset = threadAfterResetResponse.json() as Array<{ body: string }>;
  assert.equal(threadAfterReset.length <= 1, true);

  const settingsUpsertResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/settings',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      key: 'provider.defaultModel',
      value: 'gpt-5.3-codex'
    }
  });

  assert.equal(settingsUpsertResponse.statusCode, 201);

  const settingsListResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/settings',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(settingsListResponse.statusCode, 200);
  const settingsList = settingsListResponse.json() as Array<{ key: string }>;
  assert.equal(settingsList.some((setting) => setting.key === 'provider.defaultModel'), true);

  const createApprovalResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/approvals',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      actorId: l0Id,
      action: 'task.publish',
      targetId: 'task-1'
    }
  });

  assert.equal(createApprovalResponse.statusCode, 201);

  const inboxResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/inbox?recipientId=founder',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(inboxResponse.statusCode, 200);
  const inboxItems = inboxResponse.json() as Array<{
    id: string;
    type: string;
    status: string;
    title: string;
  }>;
  assert.equal(inboxItems.length > 0, true);
  assert.equal(inboxItems.some((item) => item.title.startsWith('Reply from ')), false);
  const firstInboxItem = inboxItems[0];

  const readResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/inbox/${firstInboxItem?.id}/read`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().status, 'read');

  await app.close();
});

test('P2 routes: dashboard summary exposes KPI metrics', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const agentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'KPI Agent',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(agentResponse.statusCode, 201);
  const agent = agentResponse.json() as { id: string };

  const projectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'KPI Project',
      description: 'Project for dashboard metrics',
      ownerAgentId: agent.id
    }
  });

  assert.equal(projectResponse.statusCode, 201);
  const project = projectResponse.json() as { id: string };

  const taskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'KPI Task',
      description: 'Task for dashboard',
      projectId: project.id,
      createdBy: agent.id
    }
  });

  assert.equal(taskResponse.statusCode, 201);

  const summaryResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/dashboard/summary?projectId=${project.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(summaryResponse.statusCode, 200);
  const summary = summaryResponse.json() as {
    metrics: {
      activeAgents: number;
      tasksToday: number;
      blockedTasks: number;
      blockedRatio: number;
      pendingApprovals: number;
      approvalLatencyMinutes: number;
      throughputDoneLast24h: number;
      tokenUsageToday: number;
    };
  };

  assert.equal(summary.metrics.activeAgents >= 1, true);
  assert.equal(summary.metrics.tasksToday >= 1, true);
  assert.equal(typeof summary.metrics.blockedRatio, 'number');
  assert.equal(typeof summary.metrics.approvalLatencyMinutes, 'number');
  assert.equal(typeof summary.metrics.throughputDoneLast24h, 'number');

  await app.close();
});

test('P2 quota: engine enqueue is rate-limited by daily quota', async () => {
  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    dailyQuotaLimit: 1
  });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Quota Agent',
      role: 'Ops',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const firstEnqueue = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/agent-runs',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      agentId: agent.id,
      input: 'first run',
      approvalMode: 'auto',
      action: 'engine.run',
      toolName: 'echo',
      toolArguments: {
        message: 'ok'
      }
    }
  });

  assert.equal(firstEnqueue.statusCode, 202);

  const secondEnqueue = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/agent-runs',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      agentId: agent.id,
      input: 'second run',
      approvalMode: 'auto',
      action: 'engine.run',
      toolName: 'echo',
      toolArguments: {
        message: 'quota'
      }
    }
  });

  assert.equal(secondEnqueue.statusCode, 429);
  assert.equal(secondEnqueue.json().code, 'QUOTA_EXCEEDED');

  await app.close();
});
