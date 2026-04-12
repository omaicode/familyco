import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

test('agent lifecycle endpoints pause, resume, and archive update status', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Lifecycle Owner',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string; status: string };
  assert.equal(agent.status, 'active');

  const pauseResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/agents/${agent.id}/pause`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(pauseResponse.statusCode, 200);
  assert.equal((pauseResponse.json() as { status: string }).status, 'paused');

  const resumeResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/agents/${agent.id}/resume`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(resumeResponse.statusCode, 200);
  assert.equal((resumeResponse.json() as { status: string }).status, 'active');

  const archiveResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/agents/${agent.id}/archive`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(archiveResponse.statusCode, 200);
  assert.equal((archiveResponse.json() as { status: string }).status, 'archived');

  const getAgentResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/agents/${agent.id}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(getAgentResponse.statusCode, 200);
  assert.equal((getAgentResponse.json() as { status: string }).status, 'archived');

  await app.close();
});

test('inbox response endpoints persist response metadata and archive message', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });
  const recipientId = 'founder';

  const createMessageResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/inbox',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      recipientId,
      senderId: 'agent-l0',
      type: 'approval',
      title: 'Need founder decision',
      body: 'Should we publish this change now?'
    }
  });

  assert.equal(createMessageResponse.statusCode, 201);
  const createdMessage = createMessageResponse.json() as { id: string };

  const requestChangeResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/inbox/${createdMessage.id}/request-change`,
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      responseText: 'Please revise scope and provide rollback plan.'
    }
  });

  assert.equal(requestChangeResponse.statusCode, 200);

  const requestChangePayload = (requestChangeResponse.json() as { payload?: Record<string, unknown> }).payload;
  assert.equal(requestChangePayload?.responseType, 'request_change');
  assert.equal(requestChangePayload?.responseText, 'Please revise scope and provide rollback plan.');

  const createClarificationMessage = await app.inject({
    method: 'POST',
    url: '/api/v1/inbox',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      recipientId,
      senderId: 'agent-l0',
      type: 'approval',
      title: 'Need clarification',
      body: 'Please clarify deployment timing.'
    }
  });

  assert.equal(createClarificationMessage.statusCode, 201);
  const clarificationMessage = createClarificationMessage.json() as { id: string };

  const clarificationResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/inbox/${clarificationMessage.id}/clarification`,
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      responseText: 'Deploy after business hours with on-call ready.'
    }
  });

  assert.equal(clarificationResponse.statusCode, 200);
  const clarificationPayload = (clarificationResponse.json() as { payload?: Record<string, unknown> }).payload;
  assert.equal(clarificationPayload?.responseType, 'clarification_answer');
  assert.equal(clarificationPayload?.responseText, 'Deploy after business hours with on-call ready.');

  const listInboxResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/inbox?recipientId=${recipientId}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(listInboxResponse.statusCode, 200);
  const messages = listInboxResponse.json() as Array<{ id: string; status: string }>;
  assert.equal(messages.length, 2);
  assert.equal(messages.every((message) => message.status === 'archived'), true);

  await app.close();
});

test('engine run endpoints expose queued run listing and detail', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Run Tracker',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const enqueueRunResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/agent-runs',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      agentId: agent.id,
      input: 'Plan the weekly operating review.',
      approvalMode: 'auto',
      action: 'engine.run',
      toolName: 'task.log',
      toolArguments: { source: 'integration-test' }
    }
  });

  assert.equal(enqueueRunResponse.statusCode, 202);
  const enqueued = enqueueRunResponse.json() as { queued: boolean; runId: string; runtimeState: string };
  assert.equal(enqueued.queued, true);
  assert.equal(enqueued.runtimeState, 'queued');
  assert.equal(typeof enqueued.runId, 'string');

  const listRunsResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/engine/agent-runs?rootAgentId=${agent.id}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(listRunsResponse.statusCode, 200);
  const runs = listRunsResponse.json() as Array<{ id: string; rootAgentId: string; state: string }>;
  assert.equal(runs.length >= 1, true);
  assert.equal(runs.some((run) => run.id === enqueued.runId && run.rootAgentId === agent.id), true);

  const detailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/engine/agent-runs/${enqueued.runId}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(detailResponse.statusCode, 200);
  const runDetail = detailResponse.json() as { id: string; rootAgentId: string; state: string };
  assert.equal(runDetail.id, enqueued.runId);
  assert.equal(runDetail.rootAgentId, agent.id);
  assert.equal(['queued', 'running', 'completed', 'failed'].includes(runDetail.state), true);

  const missingRunResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/engine/agent-runs/run_missing',
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(missingRunResponse.statusCode, 404);
  assert.equal((missingRunResponse.json() as { code: string }).code, 'AGENT_RUN_NOT_FOUND');

  await app.close();
});

test('project/task detail endpoints and expanded budget report shape are available', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Portfolio Executive',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const createProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Detail Contract Project',
      description: 'Validate detail endpoints and budget shape',
      ownerAgentId: agent.id
    }
  });

  assert.equal(createProjectResponse.statusCode, 201);
  const project = createProjectResponse.json() as { id: string; ownerAgentId: string };

  const createTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      title: 'Validate detail endpoint',
      description: 'Read task detail by id',
      projectId: project.id,
      createdBy: agent.id,
      assigneeAgentId: agent.id,
      priority: 'medium'
    }
  });

  assert.equal(createTaskResponse.statusCode, 201);
  const task = createTaskResponse.json() as { id: string; projectId: string };

  const projectDetailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/projects/${project.id}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(projectDetailResponse.statusCode, 200);
  const projectDetail = projectDetailResponse.json() as { id: string; ownerAgentId: string };
  assert.equal(projectDetail.id, project.id);
  assert.equal(projectDetail.ownerAgentId, agent.id);

  const taskDetailResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/tasks/${task.id}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(taskDetailResponse.statusCode, 200);
  const taskDetail = taskDetailResponse.json() as { id: string; projectId: string };
  assert.equal(taskDetail.id, task.id);
  assert.equal(taskDetail.projectId, project.id);

  const budgetReportResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/budget/report',
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(budgetReportResponse.statusCode, 200);
  const report = budgetReportResponse.json() as Record<string, unknown>;
  assert.equal(Array.isArray(report.byAdapter), true);
  assert.equal(Array.isArray(report.dailyBreakdown), true);
  assert.equal(Array.isArray(report.byModel), true);
  assert.equal(Array.isArray(report.byRun), true);
  assert.equal(Array.isArray(report.byWeek), true);
  assert.equal(Array.isArray(report.byMonth), true);
  assert.equal(Array.isArray(report.topCostlyAgents), true);
  assert.equal(Array.isArray(report.topCostlyProjects), true);

  await app.close();
});
