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

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'RBAC Agent',
      role: 'Project Manager',
      level: 'L1',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const createdAgent = createAgentResponse.json() as { id: string };

  const unauthorizedResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/agents'
  });

  assert.equal(unauthorizedResponse.statusCode, 401);

  const tokenResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/token',
    payload: {
      apiKey: TEST_API_KEY,
      agentId: createdAgent.id
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

  const createApiKeyResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/api-keys/create',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'secondary',
      apiKey: 'secondary-key'
    }
  });

  assert.equal(createApiKeyResponse.statusCode, 201);

  const rotateApiKeyResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/api-keys/rotate',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'secondary-rotated',
      currentApiKey: 'secondary-key',
      newApiKey: 'secondary-key-v2'
    }
  });

  assert.equal(rotateApiKeyResponse.statusCode, 200);

  const authAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?limit=20',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(authAuditResponse.statusCode, 200);
  const authAuditActions = (authAuditResponse.json() as Array<{ action: string }>).map(
    (record) => record.action
  );
  assert.equal(authAuditActions.includes('auth.api_key.created'), true);
  assert.equal(authAuditActions.includes('auth.api_key.rotated'), true);

  const revokeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/api-keys/revoke',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      apiKey: TEST_API_KEY
    }
  });

  assert.equal(revokeResponse.statusCode, 200);

  const postRevokeAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?limit=30',
    headers: {
      'x-api-key': 'secondary-key-v2'
    }
  });

  assert.equal(postRevokeAuditResponse.statusCode, 200);
  const postRevokeActions = (postRevokeAuditResponse.json() as Array<{ action: string }>).map(
    (record) => record.action
  );
  assert.equal(postRevokeActions.includes('auth.api_key.revoked'), true);

  const revokedTokenResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/token',
    payload: {
      apiKey: TEST_API_KEY,
      agentId: createdAgent.id
    }
  });

  assert.equal(revokedTokenResponse.statusCode, 401);

  await app.close();
});

test('L2 JWT is blocked by RBAC on L0 route', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'L2 Specialist',
      role: 'Specialist',
      level: 'L2',
      department: 'Research'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const l2Agent = createAgentResponse.json() as { id: string };

  const tokenResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/token',
    payload: {
      apiKey: TEST_API_KEY,
      agentId: l2Agent.id
    }
  });

  assert.equal(tokenResponse.statusCode, 200);
  const tokenPayload = tokenResponse.json() as { token: string };

  const forbiddenResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      authorization: `Bearer ${tokenPayload.token}`
    },
    payload: {
      name: 'Forbidden Create',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });

  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(forbiddenResponse.json().code, 'AUTH_FORBIDDEN');

  await app.close();
});

test('L1 mutation creates approval request when approval is required', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createL1AgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'L1 PM',
      role: 'Project Manager',
      level: 'L1',
      department: 'Operations'
    }
  });

  assert.equal(createL1AgentResponse.statusCode, 201);
  const l1Agent = createL1AgentResponse.json() as { id: string };

  const tokenResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/token',
    payload: {
      apiKey: TEST_API_KEY,
      agentId: l1Agent.id
    }
  });

  assert.equal(tokenResponse.statusCode, 200);
  const token = (tokenResponse.json() as { token: string }).token;

  const createProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      name: 'Needs Approval',
      description: 'L1 create project should require approval',
      ownerAgentId: l1Agent.id
    }
  });

  assert.equal(createProjectResponse.statusCode, 202);
  const approvalPayload = createProjectResponse.json() as {
    approvalRequired: boolean;
    approvalRequestId?: string;
  };
  assert.equal(approvalPayload.approvalRequired, true);
  assert.equal(typeof approvalPayload.approvalRequestId, 'string');

  const approvalsResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/approvals',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(approvalsResponse.statusCode, 200);
  const approvals = approvalsResponse.json() as Array<{ action: string; status: string }>;
  assert.equal(
    approvals.some((approval) => approval.action === 'project.create' && approval.status === 'pending'),
    true
  );

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

  const auditActions = auditRecords.map((record) => record.action);
  assert.equal(auditActions.includes('auth.api_key.bootstrap'), true);
  assert.equal(auditActions.includes('agent.create'), true);
  assert.equal(auditActions.includes('project.create'), true);
  assert.equal(auditActions.includes('task.create'), true);
  assert.equal(auditActions.includes('task.status.update'), true);
  assert.equal(auditActions.includes('approval.request.create'), true);
  assert.equal(auditActions.includes('approval.request.decide'), true);

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
  const paginatedActions = paginatedAuditRecords.map((record) => record.action);
  assert.equal(paginatedActions.every((action) => action.length > 0), true);

  const enqueueAgentRunResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/agent-runs',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      agentId: agent.id,
      input: 'run planner',
      approvalMode: 'auto',
      action: 'engine.run',
      toolName: 'echo',
      toolArguments: {
        message: 'queued'
      }
    }
  });

  assert.equal(enqueueAgentRunResponse.statusCode, 202);

  const enqueueToolRunResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/tool-runs',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      toolName: 'task.log',
      arguments: {
        message: 'hello'
      }
    }
  });

  assert.equal(enqueueToolRunResponse.statusCode, 202);

  const queueJobsResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/engine/jobs',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(queueJobsResponse.statusCode, 200);
  const queuePayload = queueJobsResponse.json() as {
    total: number;
    jobs: Array<{ type: string }>;
  };
  assert.equal(queuePayload.total, 2);
  assert.deepEqual(
    queuePayload.jobs.map((job) => job.type),
    ['agent.run', 'tool.execute']
  );

  const engineAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=engine.agent.run.enqueued',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(engineAuditResponse.statusCode, 200);
  const engineAuditRecords = engineAuditResponse.json() as Array<{ action: string }>;
  assert.equal(engineAuditRecords.length, 1);
  assert.equal(engineAuditRecords[0]?.action, 'engine.agent.run.enqueued');

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
