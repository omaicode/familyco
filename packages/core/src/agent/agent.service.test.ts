import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentService } from './agent.service.js';
import type { AgentProfile, AgentRepository, CreateAgentInput } from './index.js';
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
    createdAt: now,
    updatedAt: now
  });

  const executive = await service.findExecutiveAgent();

  assert.equal(executive?.id, 'agent-active');
});

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
}
