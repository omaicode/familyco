import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

test('GET /api/v1/tasks supports global filters for task management views', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Task Lead',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const firstProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Ops Launch',
      description: 'Launch operations playbook',
      ownerAgentId: agent.id
    }
  });

  const secondProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Retention Sprint',
      description: 'Improve retention workflows',
      ownerAgentId: agent.id
    }
  });

  assert.equal(firstProjectResponse.statusCode, 201);
  assert.equal(secondProjectResponse.statusCode, 201);

  const firstProject = firstProjectResponse.json() as { id: string };
  const secondProject = secondProjectResponse.json() as { id: string };

  const taskAResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Prepare launch checklist',
      description: 'Document the launch checklist for the ops team',
      projectId: firstProject.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'medium'
    }
  });

  const taskBResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Review retention experiments',
      description: 'Review the next experiments for activation',
      projectId: secondProject.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'high'
    }
  });

  assert.equal(taskAResponse.statusCode, 201);
  assert.equal(taskBResponse.statusCode, 201);

  const taskB = taskBResponse.json() as { id: string };

  const advanceTask = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${taskB.id}/status`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      status: 'in_progress'
    }
  });

  assert.equal(advanceTask.statusCode, 200);

  const reviewTask = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${taskB.id}/status`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      status: 'review'
    }
  });

  assert.equal(reviewTask.statusCode, 200);

  const allTasksResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(allTasksResponse.statusCode, 200);
  assert.equal((allTasksResponse.json() as Array<{ id: string }>).length, 2);

  const filteredResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/tasks?status=review&projectId=${secondProject.id}&assigneeAgentId=${agent.id}&priority=high&q=retention`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(filteredResponse.statusCode, 200);
  const filteredTasks = filteredResponse.json() as Array<{ id: string }>;
  assert.equal(filteredTasks.length, 1);
  assert.equal(filteredTasks[0]?.id, taskB.id);

  await app.close();
});

test('POST /api/v1/tasks/bulk updates priority and status for multiple tasks', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Bulk Lead',
      role: 'Project Manager',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const createProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Bulk Updates',
      description: 'Manage many tasks together',
      ownerAgentId: agent.id
    }
  });

  assert.equal(createProjectResponse.statusCode, 201);
  const project = createProjectResponse.json() as { id: string };

  const createdTasks = await Promise.all([
    app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: {
        'x-api-key': TEST_API_KEY
      },
      payload: {
        title: 'First bulk task',
        description: 'Prepare first batch item',
        projectId: project.id,
        createdBy: agent.id
      }
    }),
    app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: {
        'x-api-key': TEST_API_KEY
      },
      payload: {
        title: 'Second bulk task',
        description: 'Prepare second batch item',
        projectId: project.id,
        createdBy: agent.id
      }
    })
  ]);

  const [firstTask, secondTask] = createdTasks.map((response) => {
    assert.equal(response.statusCode, 201);
    return response.json() as { id: string };
  });

  const priorityResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks/bulk',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      taskIds: [firstTask.id, secondTask.id],
      action: 'update_priority',
      priority: 'urgent'
    }
  });

  assert.equal(priorityResponse.statusCode, 200);
  const priorityTasks = priorityResponse.json() as Array<{ priority: string }>;
  assert.deepEqual(priorityTasks.map((task) => task.priority), ['urgent', 'urgent']);

  const statusResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks/bulk',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      taskIds: [firstTask.id, secondTask.id],
      action: 'update_status',
      status: 'in_progress'
    }
  });

  assert.equal(statusResponse.statusCode, 200);
  const statusTasks = statusResponse.json() as Array<{ status: string }>;
  assert.deepEqual(statusTasks.map((task) => task.status), ['in_progress', 'in_progress']);

  await app.close();
});

test('DELETE /api/v1/agents/:id reassigns current work to the executive root', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const executiveRootResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Executive Root',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });
  assert.equal(executiveRootResponse.statusCode, 201);
  const executiveRoot = executiveRootResponse.json() as { id: string };

  const operationsLeadResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Operations Lead',
      role: 'Lead',
      level: 'L1',
      department: 'Operations',
      parentAgentId: executiveRoot.id
    }
  });
  assert.equal(operationsLeadResponse.statusCode, 201);
  const operationsLead = operationsLeadResponse.json() as { id: string };

  const specialistResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Queue Specialist',
      role: 'Specialist',
      level: 'L2',
      department: 'Operations',
      parentAgentId: operationsLead.id
    }
  });
  assert.equal(specialistResponse.statusCode, 201);
  const specialist = specialistResponse.json() as { id: string };

  const projectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Ops Stability',
      description: 'Keep queues healthy',
      ownerAgentId: operationsLead.id
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
      title: 'Review queue backlog',
      description: 'Triage queue backlog and unblock stuck work',
      projectId: project.id,
      assigneeAgentId: operationsLead.id,
      createdBy: operationsLead.id,
      priority: 'high'
    }
  });
  assert.equal(taskResponse.statusCode, 201);
  const task = taskResponse.json() as { id: string };

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/agents/${operationsLead.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });
  assert.equal(deleteResponse.statusCode, 200);

  const deleteResult = deleteResponse.json() as {
    fallbackAgentId: string;
    reassignedTaskCount: number;
    reassignedProjectCount: number;
    reassignedChildAgentCount: number;
  };
  assert.equal(deleteResult.fallbackAgentId, executiveRoot.id);
  assert.equal(deleteResult.reassignedTaskCount, 1);
  assert.equal(deleteResult.reassignedProjectCount, 1);
  assert.equal(deleteResult.reassignedChildAgentCount, 1);

  const agentsResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });
  assert.equal(agentsResponse.statusCode, 200);
  const agents = agentsResponse.json() as Array<{ id: string; parentAgentId: string | null }>;
  assert.equal(agents.some((agent) => agent.id === operationsLead.id), false);
  assert.equal(agents.find((agent) => agent.id === specialist.id)?.parentAgentId, executiveRoot.id);

  const tasksResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });
  assert.equal(tasksResponse.statusCode, 200);
  const tasks = tasksResponse.json() as Array<{ id: string; assigneeAgentId: string | null; createdBy: string }>;
  assert.equal(tasks.find((entry) => entry.id === task.id)?.assigneeAgentId, executiveRoot.id);
  assert.equal(tasks.find((entry) => entry.id === task.id)?.createdBy, executiveRoot.id);

  const projectsResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });
  assert.equal(projectsResponse.statusCode, 200);
  const projects = projectsResponse.json() as Array<{ id: string; ownerAgentId: string }>;
  assert.equal(projects.find((entry) => entry.id === project.id)?.ownerAgentId, executiveRoot.id);

  await app.close();
});

test('DELETE /api/v1/agents/:id blocks deleting the default L0 executive', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const defaultExecutiveResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Default Executive',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });
  assert.equal(defaultExecutiveResponse.statusCode, 201);
  const defaultExecutive = defaultExecutiveResponse.json() as { id: string };

  const secondaryExecutiveResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Secondary Executive',
      role: 'Executive',
      level: 'L0',
      department: 'Executive'
    }
  });
  assert.equal(secondaryExecutiveResponse.statusCode, 201);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/agents/${defaultExecutive.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });
  assert.equal(deleteResponse.statusCode, 400);
  assert.deepEqual(deleteResponse.json(), {
    statusCode: 400,
    code: 'AGENT_DELETE_DEFAULT_EXECUTIVE',
    message: 'The default executive agent cannot be deleted.'
  });

  await app.close();
});

test('PATCH /api/v1/tasks, task comments, and DELETE /api/v1/tasks/:id support task detail workflows', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Workflow Lead',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const createProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Task Detail Project',
      description: 'Project for task detail workflows',
      ownerAgentId: agent.id
    }
  });

  assert.equal(createProjectResponse.statusCode, 201);
  const project = createProjectResponse.json() as { id: string };

  const createTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Review onboarding queue',
      description: 'Prepare the founder-ready summary for the next check-in',
      projectId: project.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'medium'
    }
  });

  assert.equal(createTaskResponse.statusCode, 201);
  const task = createTaskResponse.json() as { id: string };

  const updateTaskResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/tasks/${task.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Review executive onboarding queue',
      description: 'Summarize blockers, owners, and next actions for the founder sync',
      projectId: project.id,
      assigneeAgentId: agent.id,
      createdBy: agent.id,
      priority: 'high'
    }
  });

  assert.equal(updateTaskResponse.statusCode, 200);
  const updatedTask = updateTaskResponse.json() as { title: string; priority: string; description: string };
  assert.equal(updatedTask.title, 'Review executive onboarding queue');
  assert.equal(updatedTask.priority, 'high');
  assert.match(updatedTask.description, /founder sync/);

  const humanCommentResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${task.id}/comments`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      body: 'Founder note: keep the update concise and decision-ready.',
      authorType: 'human',
      authorId: 'founder',
      authorLabel: 'Founder'
    }
  });

  assert.equal(humanCommentResponse.statusCode, 201);

  const agentCommentResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${task.id}/comments`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      body: 'Ops agent: I will attach the latest blockers in the next run.',
      authorType: 'agent',
      authorId: agent.id,
      authorLabel: 'Workflow Lead'
    }
  });

  assert.equal(agentCommentResponse.statusCode, 201);

  const listCommentsResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/tasks/${task.id}/comments`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(listCommentsResponse.statusCode, 200);
  const comments = listCommentsResponse.json() as Array<{ body: string; authorType: string; authorLabel: string }>;
  assert.equal(comments.length, 2);
  assert.equal(comments[0]?.authorType, 'human');
  assert.equal(comments[1]?.authorType, 'agent');
  assert.equal(comments[1]?.authorLabel, 'Workflow Lead');

  const deleteTaskResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/tasks/${task.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(deleteTaskResponse.statusCode, 200);
  assert.equal((deleteTaskResponse.json() as { id: string }).id, task.id);

  const remainingTasksResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(remainingTasksResponse.statusCode, 200);
  assert.equal((remainingTasksResponse.json() as Array<{ id: string }>).length, 0);

  await app.close();
});

test('PATCH /api/v1/projects and DELETE /api/v1/projects/:id update briefs and protect non-empty projects', async () => {
  const app = createApp({ logger: false, repositoryDriver: 'memory', authApiKey: TEST_API_KEY });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Portfolio Owner',
      role: 'Strategy',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const agent = createAgentResponse.json() as { id: string };

  const editableProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Editable Project',
      description: 'Original brief',
      ownerAgentId: agent.id
    }
  });

  const emptyProjectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Disposable Project',
      description: 'Can be deleted safely',
      ownerAgentId: agent.id
    }
  });

  assert.equal(editableProjectResponse.statusCode, 201);
  assert.equal(emptyProjectResponse.statusCode, 201);

  const editableProject = editableProjectResponse.json() as { id: string; name: string };
  const emptyProject = emptyProjectResponse.json() as { id: string };

  const updateProjectResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${editableProject.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Updated Portfolio Project',
      description: 'Revised operating brief',
      ownerAgentId: agent.id,
      parentProjectId: null
    }
  });

  assert.equal(updateProjectResponse.statusCode, 200);
  const updatedProject = updateProjectResponse.json() as { name: string; description: string };
  assert.equal(updatedProject.name, 'Updated Portfolio Project');
  assert.equal(updatedProject.description, 'Revised operating brief');

  const createTaskResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      title: 'Keep project active',
      description: 'This task should block project deletion',
      projectId: editableProject.id,
      createdBy: agent.id
    }
  });

  assert.equal(createTaskResponse.statusCode, 201);

  const blockedDeleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/projects/${editableProject.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(blockedDeleteResponse.statusCode, 400);
  const blockedDeleteBody = blockedDeleteResponse.json() as { code: string };
  assert.equal(blockedDeleteBody.code, 'PROJECT_NOT_EMPTY');

  const deleteProjectResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/projects/${emptyProject.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(deleteProjectResponse.statusCode, 200);
  const deletePayload = deleteProjectResponse.json() as { id: string };
  assert.equal(deletePayload.id, emptyProject.id);

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
  const agent = createAgentResponse.json() as { id: string };

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
  const project = createProjectResponse.json() as { id: string };

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
  const task = createTaskResponse.json() as { id: string };

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
  const invalidTransitionBody = invalidTransitionResponse.json() as { code: string };
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
  const approvalRequest = createApprovalResponse.json() as { id: string; status: string };
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
  const decidedApproval = decideApprovalResponse.json() as { status: string };
  assert.equal(decidedApproval.status, 'approved');

  const taskActivityResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/tasks/${task.id}/activity`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(taskActivityResponse.statusCode, 200);
  const taskActivities = taskActivityResponse.json() as Array<{ kind: string; summary: string }>;
  assert.equal(taskActivities.some((item) => item.kind === 'approval.created'), true);
  assert.equal(taskActivities.some((item) => item.kind === 'approval.decided'), true);
  assert.equal(taskActivities.some((item) => item.kind === 'session.checkpoint'), true);

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
  assert.equal((duplicateDecisionResponse.json() as { code: string }).code, 'APPROVAL_ALREADY_DECIDED');

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
  assert.equal(queuePayload.total >= 2, true);
  const jobTypes = queuePayload.jobs.map((job) => job.type);
  assert.equal(jobTypes.includes('agent.run'), true);
  assert.equal(jobTypes.includes('tool.execute'), true);

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

test('heartbeat scheduler runs agents and persists session snapshots when enabled', {skip: true}, async () => {
  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    queueDriver: 'memory',
    authApiKey: TEST_API_KEY,
    enableHeartbeatScheduler: true,
    heartbeatPollMs: 25
  });

  const createAgentResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/agents',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      name: 'Heartbeat Ops Lead',
      role: 'Operations',
      level: 'L0',
      department: 'Operations'
    }
  });

  assert.equal(createAgentResponse.statusCode, 201);
  const createdAgent = createAgentResponse.json() as { id: string };

  const heartbeatSettingResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/settings',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      key: 'agent.defaultHeartbeatMinutes',
      value: 0.001
    }
  });

  assert.equal(heartbeatSettingResponse.statusCode, 201);

  const staleHeartbeatStateResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/settings',
    headers: {
      'x-api-key': TEST_API_KEY
    },
    payload: {
      key: `agent.heartbeat.state.${createdAgent.id}`,
      value: {
        inFlight: true,
        lastStatus: 'queued',
        lastScheduledAt: '2026-04-01T00:00:00.000Z',
        nextHeartbeatAt: '2026-04-01T00:01:00.000Z',
        lastAction: 'heartbeat.tick',
        lastToolName: 'task.log',
        inputPreview: 'stale heartbeat state'
      }
    }
  });

  assert.equal(staleHeartbeatStateResponse.statusCode, 201);

  await new Promise((resolve) => setTimeout(resolve, 180));

  const heartbeatStateResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/settings/agent.heartbeat.state.${createdAgent.id}`,
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(heartbeatStateResponse.statusCode, 200);
  const heartbeatState = heartbeatStateResponse.json() as {
    value: {
      lastStatus?: string;
      lastCompletedAt?: string;
      inFlight?: boolean;
    };
  };
  assert.equal(heartbeatState.value.lastStatus, 'completed');
  assert.equal(typeof heartbeatState.value.lastCompletedAt, 'string');
  assert.equal(heartbeatState.value.inFlight, false);

  const auditResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=engine.agent.run.completed',
    headers: {
      'x-api-key': TEST_API_KEY
    }
  });

  assert.equal(auditResponse.statusCode, 200);
  const auditRecords = auditResponse.json() as Array<{
    targetId?: string;
    payload?: {
      heartbeatTrace?: {
        toolCalls?: Array<{ toolName?: string }>;
      };
    };
  }>;
  assert.equal(auditRecords.some((record) => record.targetId === createdAgent.id), true);
  const agentAudit = auditRecords.find((record) => record.targetId === createdAgent.id);
  assert.equal(Array.isArray(agentAudit?.payload?.heartbeatTrace?.toolCalls), true);
  assert.equal(
    (agentAudit?.payload?.heartbeatTrace?.toolCalls ?? []).some((call) => call.toolName === 'task.list'),
    true
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
