import { randomUUID } from 'node:crypto';

import type {
  AgentProfile,
  AgentRepository,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput
} from '@familyco/core';

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
      updatedAt: new Date()
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
      updatedAt: new Date()
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
        updatedAt: new Date()
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
