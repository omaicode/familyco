import { randomUUID } from 'node:crypto';

import type { AgentProfile, AgentRepository, AgentStatus, CreateAgentInput } from '@familyco/core';

export class InMemoryAgentRepository implements AgentRepository {
  private readonly agents = new Map<string, AgentProfile>();

  async create(input: CreateAgentInput): Promise<AgentProfile> {
    const now = new Date();
    const agent: AgentProfile = {
      id: randomUUID(),
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

  async findChildren(parentAgentId: string): Promise<AgentProfile[]> {
    return Array.from(this.agents.values()).filter((agent) => agent.parentAgentId === parentAgentId);
  }

  async list(): Promise<AgentProfile[]> {
    return Array.from(this.agents.values());
  }

  async pause(id: string): Promise<AgentProfile> {
    return this.setStatus(id, 'paused');
  }

  async setStatus(id: string, status: AgentStatus): Promise<AgentProfile> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    const updatedAgent: AgentProfile = {
      ...agent,
      status,
      updatedAt: new Date()
    };

    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  async updateParent(id: string, parentAgentId: string | null): Promise<AgentProfile> {
    const existing = this.agents.get(id);
    if (!existing) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    const updated: AgentProfile = {
      ...existing,
      parentAgentId,
      updatedAt: new Date()
    };

    this.agents.set(id, updated);
    return updated;
  }
}
