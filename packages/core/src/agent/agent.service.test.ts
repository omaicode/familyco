import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentService } from './agent.service.js';
import type {
  AgentProfile,
  AgentRepository,
  CreateAgentInput,
  UpdateAgentInput
} from './index.js';
import type { ApprovalRepository, ApprovalRequest, CreateApprovalRequestInput } from '../approval/index.js';
import type { CreateProjectInput, Project, ProjectRepository, UpdateProjectInput } from '../project/index.js';
import type { CreateTaskInput, Task, TaskRepository, UpdateTaskInput } from '../task/index.js';
import { EventBus } from '../events/event-bus.js';

test('AgentService emits created and paused events', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const eventBus = new EventBus();
  const service = new AgentService(repository, eventBus);

  const eventLog: Array<{ event: string; payload: unknown }> = [];
  eventBus.on('agent.created', (payload) => {
    eventLog.push({ event: 'agent.created', payload });
  });
  eventBus.on('agent.paused', (payload) => {
    eventLog.push({ event: 'agent.paused', payload });
  });

  const created = await service.createAgent({
    name: 'Chief of Staff',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });

  await service.pauseAgent(created.id);

  assert.deepEqual(eventLog, [
    {
      event: 'agent.created',
      payload: { agentId: created.id }
    },
    {
      event: 'agent.paused',
      payload: { agentId: created.id }
    }
  ]);
});

test('AgentService skips terminated executives when selecting the default L0 agent', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const service = new AgentService(repository);
  const now = new Date('2026-01-04T00:00:00.000Z');

  repository.seed({
    id: 'agent-terminated',
    name: 'Former Chief of Staff',
    role: 'Executive',
    level: 'L0',
    department: 'Executive',
    status: 'terminated',
    parentAgentId: null,
    aiAdapterId: null,
    aiModel: null,
    createdAt: now,
    updatedAt: now
  });

  repository.seed({
    id: 'agent-active',
    name: 'Current Chief of Staff',
    role: 'Executive',
    level: 'L0',
    department: 'Executive',
    status: 'active',
    parentAgentId: null,
    aiAdapterId: null,
    aiModel: null,
    createdAt: now,
    updatedAt: now
  });

  const executive = await service.findExecutiveAgent();

  assert.equal(executive?.id, 'agent-active');
});

test('AgentService updates editable profile fields for an existing agent', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const service = new AgentService(repository);

  const created = await service.createAgent({
    name: 'Ops Bot',
    role: 'Operations Specialist',
    level: 'L1',
    department: 'Operations',
    parentAgentId: null
  });

  const updated = await service.updateAgent(created.id, {
    name: 'Ops Lead',
    role: 'Operations Lead',
    department: 'Operations Excellence',
    status: 'idle'
  });

  assert.equal(updated.name, 'Ops Lead');
  assert.equal(updated.role, 'Operations Lead');
  assert.equal(updated.department, 'Operations Excellence');
  assert.equal(updated.status, 'idle');
  assert.equal(updated.parentAgentId, null);
});

test('AgentService blocks deleting the last active L0 executive', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const service = new AgentService(repository);

  await service.createAgent({
    name: 'Default Executive',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });
  const secondaryExecutive = await service.createAgent({
    name: 'Secondary Executive',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });
  await service.setAgentStatus('agent-1', 'terminated');

  await assert.rejects(() => service.deleteAgent(secondaryExecutive.id), /AGENT_DELETE_LAST_EXECUTIVE/);
});

test('AgentService deletes an L0 executive when another active L0 exists', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const taskRepository = new InMemoryTaskRepositoryStub();
  const projectRepository = new InMemoryProjectRepositoryStub();
  const approvalRepository = new InMemoryApprovalRepositoryStub();
  const service = new AgentService(repository, undefined, taskRepository, projectRepository, approvalRepository);

  await service.createAgent({
    name: 'Default Executive',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });
  const secondaryExecutive = await service.createAgent({
    name: 'Executive B',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });

  const result = await service.deleteAgent(secondaryExecutive.id);
  assert.equal(result.deletedAgentIds.includes(secondaryExecutive.id), true);
  assert.equal(result.fallbackAgentId.length > 0, true);
});

test('AgentService blocks deleting the default L0 executive', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const taskRepository = new InMemoryTaskRepositoryStub();
  const projectRepository = new InMemoryProjectRepositoryStub();
  const approvalRepository = new InMemoryApprovalRepositoryStub();
  const service = new AgentService(repository, undefined, taskRepository, projectRepository, approvalRepository);

  const defaultExecutive = await service.createAgent({
    name: 'Default Executive',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });
  await service.createAgent({
    name: 'Secondary Executive',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });

  await assert.rejects(() => service.deleteAgent(defaultExecutive.id), /AGENT_DELETE_DEFAULT_EXECUTIVE/);
});

test('AgentService reassigns direct reports, tasks, and projects to the fallback executive before delete', async () => {
  const repository = new InMemoryAgentRepositoryStub();
  const taskRepository = new InMemoryTaskRepositoryStub();
  const projectRepository = new InMemoryProjectRepositoryStub();
  const approvalRepository = new InMemoryApprovalRepositoryStub();
  const service = new AgentService(repository, undefined, taskRepository, projectRepository, approvalRepository);

  const executive = await service.createAgent({
    name: 'Executive Root',
    role: 'Executive',
    level: 'L0',
    department: 'Executive'
  });
  const lead = await service.createAgent({
    name: 'Operations Lead',
    role: 'Lead',
    level: 'L1',
    department: 'Operations',
    parentAgentId: executive.id
  });
  const specialist = await service.createAgent({
    name: 'Specialist',
    role: 'Specialist',
    level: 'L2',
    department: 'Operations',
    parentAgentId: lead.id
  });

  projectRepository.seed({
    id: 'project-1',
    name: 'Ops',
    description: 'Ops project',
    ownerAgentId: lead.id,
    parentProjectId: null,
    dirPath: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  });
  taskRepository.seed({
    id: 'task-1',
    title: 'Handle ops queue',
    description: 'Keep the queue moving',
    status: 'in_progress',
    priority: 'high',
    projectId: 'project-1',
    assigneeAgentId: lead.id,
    createdBy: lead.id,
    dependsOnTaskIds: [],
    readinessRules: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  });
  approvalRepository.seed({
    id: 'approval-1',
    actorId: lead.id,
    action: 'task.delete',
    targetId: 'task-1',
    status: 'pending',
    payload: { taskId: 'task-1' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  });

  const result = await service.deleteAgent(lead.id);
  const updatedChild = await repository.findById(specialist.id);
  const updatedTask = await taskRepository.findById('task-1');
  const updatedProject = await projectRepository.findById('project-1');
  const updatedApproval = await approvalRepository.findById('approval-1');

  assert.deepEqual(result.deletedAgentIds, [lead.id]);
  assert.equal(result.fallbackAgentId, executive.id);
  assert.equal(result.reassignedChildAgentCount, 1);
  assert.equal(result.reassignedTaskCount, 1);
  assert.equal(result.reassignedProjectCount, 1);
  assert.equal(updatedChild?.parentAgentId, executive.id);
  assert.equal(updatedTask?.assigneeAgentId, executive.id);
  assert.equal(updatedTask?.createdBy, executive.id);
  assert.equal(updatedProject?.ownerAgentId, executive.id);
  assert.equal(updatedApproval?.actorId, executive.id);
});

class InMemoryApprovalRepositoryStub implements ApprovalRepository {
  private readonly requests = new Map<string, ApprovalRequest>();

  seed(request: ApprovalRequest): void {
    this.requests.set(request.id, request);
  }

  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: `approval-${this.requests.size + 1}`,
      actorId: input.actorId,
      action: input.action,
      targetId: input.targetId,
      status: 'pending',
      payload: input.payload,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    this.requests.set(request.id, request);
    return request;
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async list(): Promise<ApprovalRequest[]> {
    return Array.from(this.requests.values());
  }

  async reassignActor(previousAgentId: string, nextAgentId: string): Promise<ApprovalRequest[]> {
    const updatedRequests: ApprovalRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.actorId !== previousAgentId) {
        continue;
      }

      const updatedRequest: ApprovalRequest = {
        ...request,
        actorId: nextAgentId,
        updatedAt: new Date('2026-01-02T00:00:00.000Z')
      };
      this.requests.set(request.id, updatedRequest);
      updatedRequests.push(updatedRequest);
    }

    return updatedRequests;
  }

  async updateStatus(id: string, status: ApprovalRequest['status']): Promise<ApprovalRequest> {
    const request = this.requests.get(id);
    if (!request) {
      throw new Error(`APPROVAL_NOT_FOUND:${id}`);
    }

    const updatedRequest: ApprovalRequest = {
      ...request,
      status,
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.requests.set(id, updatedRequest);
    return updatedRequest;
  }
}

class InMemoryAgentRepositoryStub implements AgentRepository {
  private readonly agents = new Map<string, AgentProfile>();

  seed(agent: AgentProfile): void {
    this.agents.set(agent.id, agent);
  }

  async create(input: CreateAgentInput): Promise<AgentProfile> {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const agent: AgentProfile = {
      id: `agent-${this.agents.size + 1}`,
      name: input.name,
      role: input.role,
      level: input.level,
      department: input.department,
      status: 'active',
      parentAgentId: input.parentAgentId ?? null,
      aiAdapterId: null,
      aiModel: null,
      createdAt: now,
      updatedAt: now
    };

    this.agents.set(agent.id, agent);
    return agent;
  }

  async findById(id: string): Promise<AgentProfile | null> {
    return this.agents.get(id) ?? null;
  }

  async list(): Promise<AgentProfile[]> {
    return Array.from(this.agents.values());
  }

  async findChildren(parentAgentId: string): Promise<AgentProfile[]> {
    return Array.from(this.agents.values()).filter((agent) => agent.parentAgentId === parentAgentId);
  }

  async pause(id: string): Promise<AgentProfile> {
    return this.setStatus(id, 'paused');
  }

  async setStatus(id: string, status: AgentProfile['status']): Promise<AgentProfile> {
    const existing = this.agents.get(id);
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    const updated: AgentProfile = {
      ...existing,
      status,
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    };

    this.agents.set(id, updated);
    return updated;
  }

  async update(id: string, input: UpdateAgentInput): Promise<AgentProfile> {
    const existing = this.agents.get(id);
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    const updated: AgentProfile = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.agents.set(id, updated);
    return updated;
  }

  async updateParent(id: string, parentAgentId: string | null): Promise<AgentProfile> {
    const existing = this.agents.get(id);
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    const updated: AgentProfile = {
      ...existing,
      parentAgentId,
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.agents.set(id, updated);
    return updated;
  }

  async reassignChildren(parentAgentId: string, nextParentAgentId: string): Promise<AgentProfile[]> {
    const updatedChildren: AgentProfile[] = [];
    for (const agent of this.agents.values()) {
      if (agent.parentAgentId !== parentAgentId) {
        continue;
      }

      const updated: AgentProfile = {
        ...agent,
        parentAgentId: nextParentAgentId,
        updatedAt: new Date('2026-01-03T00:00:00.000Z')
      };
      this.agents.set(agent.id, updated);
      updatedChildren.push(updated);
    }

    return updatedChildren;
  }

  async delete(id: string): Promise<AgentProfile> {
    const existing = this.agents.get(id);
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    this.agents.delete(id);
    return existing;
  }
}

class InMemoryTaskRepositoryStub implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  seed(task: Task): void {
    this.tasks.set(task.id, task);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: `task-${this.tasks.size + 1}`,
      title: input.title,
      description: input.description,
      status: 'pending',
      priority: input.priority ?? 'medium',
      projectId: input.projectId,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdBy: input.createdBy,
      dependsOnTaskIds: input.dependsOnTaskIds ?? [],
      readinessRules: input.readinessRules ?? [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => task.projectId === projectId);
  }

  async reassignAgent(previousAgentId: string, nextAgentId: string): Promise<Task[]> {
    const updatedTasks: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.assigneeAgentId !== previousAgentId && task.createdBy !== previousAgentId) {
        continue;
      }

      const updated: Task = {
        ...task,
        assigneeAgentId: task.assigneeAgentId === previousAgentId ? nextAgentId : task.assigneeAgentId,
        createdBy: task.createdBy === previousAgentId ? nextAgentId : task.createdBy,
        updatedAt: new Date('2026-01-02T00:00:00.000Z')
      };
      this.tasks.set(task.id, updated);
      updatedTasks.push(updated);
    }

    return updatedTasks;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updated: Task = {
      ...existing,
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdBy: input.createdBy,
      priority: input.priority,
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, status: Task['status']): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updated: Task = {
      ...existing,
      status,
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async updatePriority(id: string, priority: Task['priority']): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    const updated: Task = {
      ...existing,
      priority,
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`TASK_NOT_FOUND:${id}`);
    }

    this.tasks.delete(id);
    return existing;
  }
}

class InMemoryProjectRepositoryStub implements ProjectRepository {
  private readonly projects = new Map<string, Project>();

  seed(project: Project): void {
    this.projects.set(project.id, project);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const project: Project = {
      id: `project-${this.projects.size + 1}`,
      name: input.name,
      description: input.description,
      ownerAgentId: input.ownerAgentId,
      parentProjectId: input.parentProjectId ?? null,
      dirPath: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    this.projects.set(project.id, project);
    return project;
  }

  async reassignOwner(previousAgentId: string, nextAgentId: string): Promise<Project[]> {
    const updatedProjects: Project[] = [];
    for (const project of this.projects.values()) {
      if (project.ownerAgentId !== previousAgentId) {
        continue;
      }

      const updated: Project = {
        ...project,
        ownerAgentId: nextAgentId,
        updatedAt: new Date('2026-01-02T00:00:00.000Z')
      };
      this.projects.set(project.id, updated);
      updatedProjects.push(updated);
    }

    return updatedProjects;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const updated: Project = {
      ...existing,
      name: input.name,
      description: input.description,
      ownerAgentId: input.ownerAgentId,
      parentProjectId: input.parentProjectId ?? null,
      updatedAt: new Date('2026-01-03T00:00:00.000Z')
    };
    this.projects.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    this.projects.delete(id);
    return existing;
  }

  async setDirPath(id: string, dirPath: string): Promise<void> {
    const existing = this.projects.get(id);
    if (existing) {
      this.projects.set(id, { ...existing, dirPath });
    }
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async list(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }
}
