import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';

test('GET /health returns ok', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory' });

  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });

  await app.close();
});

test('agent + project + task flow works with in-memory repositories', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory' });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
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
    payload: {
      status: 'in_progress'
    }
  });

  assert.equal(updateToInProgressResponse.statusCode, 200);

  const invalidTransitionResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${task.id}/status`,
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
    payload: {
      status: 'rejected'
    }
  });

  assert.equal(duplicateDecisionResponse.statusCode, 400);
  assert.equal(duplicateDecisionResponse.json().code, 'APPROVAL_ALREADY_DECIDED');

  await app.close();
});
