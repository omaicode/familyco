import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

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

test('workspace default approval mode is applied to runtime mutations', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Execution Lead',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const executiveAgent = createAgentResponse.json() as { id: string };

  const settingsResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/settings',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      key: 'agent.defaultApprovalMode',
      value: 'review'
    }
  });

  assert.equal(settingsResponse.statusCode, 201);

  const createProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Approval Override',
      description: 'Workspace default approval mode should gate this request.',
      ownerAgentId: executiveAgent.id
    }
  });

  assert.equal(createProjectResponse.statusCode, 202);
  const approvalPayload = createProjectResponse.json() as {
    approvalRequired: boolean;
    approvalRequestId?: string;
  };
  assert.equal(approvalPayload.approvalRequired, true);
  assert.equal(typeof approvalPayload.approvalRequestId, 'string');

  await app.close();
});
