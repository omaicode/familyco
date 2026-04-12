import { randomUUID } from 'node:crypto';

import type {
  AgentRun,
  AgentRunListQuery,
  AgentRunRepository,
  CreateAgentRunInput,
  UpdateAgentRunStateInput
} from '@familyco/core';

export class InMemoryAgentRunRepository implements AgentRunRepository {
  private readonly runs: AgentRun[] = [];

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const now = new Date();
    const run: AgentRun = {
      id: randomUUID(),
      companyId: input.companyId,
      rootAgentId: input.rootAgentId,
      parentRunId: input.parentRunId ?? null,
      triggerType: input.triggerType,
      state: input.state ?? 'queued',
      inputSummary: input.inputSummary,
      outputSummary: null,
      linkedProjectId: input.linkedProjectId ?? null,
      linkedTaskId: input.linkedTaskId ?? null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.runs.push(run);
    return run;
  }

  async updateState(id: string, input: UpdateAgentRunStateInput): Promise<AgentRun> {
    const index = this.runs.findIndex((run) => run.id === id);
    if (index < 0) {
      throw new Error('AGENT_RUN_NOT_FOUND');
    }

    const current = this.runs[index];
    const now = new Date();
    const startedAt = current.startedAt ?? (input.state === 'planning' || input.state === 'executing' ? now : null);
    const finishedAt = input.state === 'completed' || input.state === 'failed' || input.state === 'cancelled'
      ? now
      : null;

    const updated: AgentRun = {
      ...current,
      state: input.state,
      outputSummary: input.outputSummary ?? current.outputSummary,
      startedAt,
      finishedAt,
      updatedAt: now
    };

    this.runs[index] = updated;
    return updated;
  }

  async getById(id: string): Promise<AgentRun | null> {
    return this.runs.find((run) => run.id === id) ?? null;
  }

  async list(query: AgentRunListQuery = {}): Promise<AgentRun[]> {
    const filtered = this.runs.filter((run) => {
      if (query.rootAgentId && run.rootAgentId !== query.rootAgentId) return false;
      if (query.state && run.state !== query.state) return false;
      if (query.triggerType && run.triggerType !== query.triggerType) return false;
      if (query.from && run.createdAt < query.from) return false;
      if (query.to && run.createdAt > query.to) return false;
      return true;
    });

    const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = query.offset ?? 0;
    const limit = query.limit ?? sorted.length;

    return sorted.slice(offset, offset + limit);
  }
}
