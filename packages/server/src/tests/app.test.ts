import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';

const TEST_API_KEY = 'test-api-key';

test('GET /health returns ok', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });

  await app.close();
});

test('API rejects unauthorized requests and allows JWT access', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const unauthorizedResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/agents'
  });

  assert.equal(unauthorizedResponse.statusCode, 401);

  const tokenResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/token',
    payload: {
      apiKey: TEST_API_KEY
    }
  });

  assert.equal(tokenResponse.statusCode, 200);
  const tokenPayload = tokenResponse.json() as { token: string };

  const authorizedResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/agents',
    headers: {
      authorization: `Bearer ${tokenPayload.token}`
    }
  });

  assert.equal(authorizedResponse.statusCode, 200);

  await app.close();
});

test('agent + project + task flow works with in-memory repositories', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Chief of Staff',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json();

  const createProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Project One',
      description: 'Testing vertical slice',
      ownerAgentId: agent.id
    }
  });

  assert.equal(createProjectResponse.statusCode, 201);
  const project = createProjectResponse.json();

  const createTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Create first task',
      description: 'Task for integration test',
      projectId: project.id,
      createdBy: agent.id
    }
  });

  assert.equal(createTaskResponse.statusCode, 201);
  const task = createTaskResponse.json();

  const updateToInProgressResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${task.id}/status`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      status: 'in_progress'
    }
  });

  assert.equal(updateToInProgressResponse.statusCode, 200);

  const invalidTransitionResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${task.id}/status`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      status: 'done'
    }
  });

  assert.equal(invalidTransitionResponse.statusCode, 400);
  const invalidTransitionBody = invalidTransitionResponse.json();
  assert.equal(invalidTransitionBody.code, 'TASK_INVALID_STATUS');

  const createApprovalResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/approvals',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      actorId: agent.id,
      action: 'task.publish',
      targetId: task.id,
      payload: {
        note: 'Need founder approval before publish'
      }
    }
  });

  assert.equal(createApprovalResponse.statusCode, 201);
  const approvalRequest = createApprovalResponse.json();
  assert.equal(approvalRequest.status, 'pending');

  const decideApprovalResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/approvals/${approvalRequest.id}/decision`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      status: 'approved'
    }
  });

  assert.equal(decideApprovalResponse.statusCode, 200);
  const decidedApproval = decideApprovalResponse.json();
  assert.equal(decidedApproval.status, 'approved');

  const duplicateDecisionResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/approvals/${approvalRequest.id}/decision`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      status: 'rejected'
    }
  });

  assert.equal(duplicateDecisionResponse.statusCode, 400);
  assert.equal(duplicateDecisionResponse.json().code, 'APPROVAL_ALREADY_DECIDED');

  const listAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(listAuditResponse.statusCode, 200);
  const auditRecords = listAuditResponse.json() as Array<{
    action: string;
    targetId?: string;
  }>;

  assert.equal(auditRecords.length, 6);
  assert.deepEqual(auditRecords.map((record) => record.action), [
    'agent.create',
    'project.create',
    'task.create',
    'task.status.update',
    'approval.request.create',
    'approval.request.decide'
  ]);

  const approvedAudit = auditRecords.find((record) => record.action === 'approval.request.decide');
  assert.equal(approvedAudit?.targetId, approvalRequest.id);

  const filteredAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=task.create',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(filteredAuditResponse.statusCode, 200);
  const filteredAuditRecords = filteredAuditResponse.json() as Array<{ action: string }>;
  assert.equal(filteredAuditRecords.length, 1);
  assert.equal(filteredAuditRecords[0]?.action, 'task.create');

  const paginatedAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?offset=2&limit=2',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(paginatedAuditResponse.statusCode, 200);
  const paginatedAuditRecords = paginatedAuditResponse.json() as Array<{ action: string }>;
  assert.equal(paginatedAuditRecords.length, 2);
  assert.deepEqual(
    paginatedAuditRecords.map((record) => record.action),
    ['task.create', 'task.status.update']
  );

  await app.close();
});

test('prisma driver creates agent and audit records when enabled', { skip: process.env.RUN_PRISMA_TESTS !== '1' }, async () => {
  const app = createApp({ logger: false, repositoryDriver: 'prisma', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: `Prisma Test Agent ${Date.now()}`,
      role: 'Ops',
      level: 'L1',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const createdAgent = createAgentResponse.json() as { id: string };

  const listAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=agent.create&limit=20',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(listAuditResponse.statusCode, 200);
  const auditRecords = listAuditResponse.json() as Array<{ targetId?: string }>;
  assert.equal(auditRecords.some((record) => record.targetId === createdAgent.id), true);

  await app.close();
});
