import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

test('task API persists dependsOnTaskIds and readinessRules', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Readiness Lead',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const dependencyAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Dependency Lead',
      role: 'Operations',
      level: 'L1',
      department: 'Operations',
      parentAgentId: agent.id
    }
  });

  assert.equal(dependencyAgentResponse.statusCode, 201);
  const dependencyAgent = dependencyAgentResponse.json() as { id: string };

  const projectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Dependency Project',
      description: 'Exercise readiness metadata persistence',
      ownerAgentId: agent.id
    }
  });

  assert.equal(projectResponse.statusCode, 201);
  const project = projectResponse.json() as { id: string };

  const dependencyResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      title: 'Prepare assets',
      description: 'Finish the prerequisite assets first',
      projectId: project.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id
    }
  });

  assert.equal(dependencyResponse.statusCode, 201);
  const dependencyTask = dependencyResponse.json() as { id: string };

  const createTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      title: 'Launch readiness review',
      description: 'Review launch only after assets are ready',
      projectId: project.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'high',
      dependsOnTaskIds: [dependencyTask.id],
      readinessRules: [
        {
          type: 'task_status',
          taskId: dependencyTask.id,
          status: 'done',
          description: 'Assets must be complete before review starts.'
        }
      ]
    }
  });

  assert.equal(createTaskResponse.statusCode, 201);
  const createdTask = createTaskResponse.json() as {
    id: string;
    dependsOnTaskIds: string[];
    readinessRules: Array<{ type: string; taskId: string; status: string; description?: string }>;
  };
  assert.deepEqual(createdTask.dependsOnTaskIds, [dependencyTask.id]);
  assert.deepEqual(createdTask.readinessRules, [
    {
      type: 'task_status',
      taskId: dependencyTask.id,
      status: 'done',
      description: 'Assets must be complete before review starts.'
    }
  ]);

  const readTaskResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/tasks/${createdTask.id}`,
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(readTaskResponse.statusCode, 200);
  const persistedTask = readTaskResponse.json() as {
    dependsOnTaskIds: string[];
    readinessRules: Array<{ type: string; taskId: string; status: string; description?: string }>;
  };
  assert.deepEqual(persistedTask.dependsOnTaskIds, [dependencyTask.id]);
  assert.deepEqual(persistedTask.readinessRules, [
    {
      type: 'task_status',
      taskId: dependencyTask.id,
      status: 'done',
      description: 'Assets must be complete before review starts.'
    }
  ]);

  await app.close();
});

test('heartbeat fallback dispatch skips high-priority tasks that are not ready', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Heartbeat Lead',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const dependencyAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Dependency Lead',
      role: 'Operations',
      level: 'L1',
      department: 'Operations',
      parentAgentId: agent.id
    }
  });

  assert.equal(dependencyAgentResponse.statusCode, 201);
  const dependencyAgent = dependencyAgentResponse.json() as { id: string };

  const projectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      name: 'Heartbeat Project',
      description: 'Verify readiness-aware heartbeat dispatch',
      ownerAgentId: agent.id
    }
  });

  assert.equal(projectResponse.statusCode, 201);
  const project = projectResponse.json() as { id: string };

  const prerequisiteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      title: 'Prepare legal review',
      description: 'This remains pending, keeping the dependent task not ready',
      projectId: project.id,
      assigneeAgentId: dependencyAgent.id,
      createdBy: dependencyAgent.id,
      priority: 'medium'
    }
  });

  assert.equal(prerequisiteResponse.statusCode, 201);
  const prerequisiteTask = prerequisiteResponse.json() as { id: string };

  const blockedTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      title: 'Ship launch announcement',
      description: 'High priority but must wait for legal review',
      projectId: project.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'urgent',
      dependsOnTaskIds: [prerequisiteTask.id],
      readinessRules: [
        {
          type: 'task_status',
          taskId: prerequisiteTask.id,
          status: 'done',
          description: 'Legal review must be done first.'
        }
      ]
    }
  });

  assert.equal(blockedTaskResponse.statusCode, 201);
  const blockedTask = blockedTaskResponse.json() as { id: string };

  const readyTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: {
      title: 'Prepare founder summary',
      description: 'Ready immediately even at lower priority',
      projectId: project.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'medium'
    }
  });

  assert.equal(readyTaskResponse.statusCode, 201);
  const readyTask = readyTaskResponse.json() as { id: string };

  const heartbeatResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/engine/heartbeat/trigger',
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(heartbeatResponse.statusCode, 202);

  await new Promise((resolve) => setTimeout(resolve, 160));

  const heartbeatAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=engine.agent.run.completed',
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(heartbeatAuditResponse.statusCode, 200);
  const heartbeatAudits = heartbeatAuditResponse.json() as Array<{
    targetId?: string;
    payload?: {
      heartbeatTrace?: {
        toolCalls?: Array<{
          toolName?: string;
          output?: {
            dispatched?: string[];
          };
        }>;
      };
    };
  }>;
  const agentHeartbeatAudit = heartbeatAudits.find(
    (record) => record.targetId === agent.id && Array.isArray(record.payload?.heartbeatTrace?.toolCalls)
  );
  const dispatchCall = agentHeartbeatAudit?.payload?.heartbeatTrace?.toolCalls?.find(
    (call) => call.toolName === 'heartbeat.dispatch'
  );

  assert.equal(Array.isArray(dispatchCall?.output?.dispatched), true);
  assert.equal(dispatchCall?.output?.dispatched?.includes(readyTask.id), true);
  assert.equal(dispatchCall?.output?.dispatched?.includes(blockedTask.id), false);

  const taskExecutionAuditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=engine.task.execute.completed',
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(taskExecutionAuditResponse.statusCode, 200);
  const taskExecutionAudits = taskExecutionAuditResponse.json() as Array<{
    payload?: {
      taskId?: string | null;
    };
  }>;
  assert.equal(taskExecutionAudits.some((record) => record.payload?.taskId === readyTask.id), true);
  assert.equal(taskExecutionAudits.some((record) => record.payload?.taskId === blockedTask.id), false);

  await app.close();
});