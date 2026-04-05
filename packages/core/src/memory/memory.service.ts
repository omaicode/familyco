import type { AddMemoryEntryInput, MemoryEntry } from './memory.entity.js';

export interface MemoryService {
  add(input: AddMemoryEntryInput): Promise<MemoryEntry>;
  listRecent(agentId: string, limit: number): Promise<MemoryEntry[]>;
  clear(agentId: string): Promise<void>;
}

export class InMemoryMemoryService implements MemoryService {
  private readonly entries = new Map<string, MemoryEntry[]>();

  async add(input: AddMemoryEntryInput): Promise<MemoryEntry> {
    const list = this.entries.get(input.agentId) ?? [];
    const entry: MemoryEntry = {
      id: `mem-${input.agentId}-${list.length + 1}`,
      agentId: input.agentId,
      role: input.role,
      content: input.content,
      metadata: input.metadata,
      createdAt: new Date()
    };

    list.push(entry);
    this.entries.set(input.agentId, list);
    return entry;
  }

  async listRecent(agentId: string, limit: number): Promise<MemoryEntry[]> {
    const list = this.entries.get(agentId) ?? [];
    if (limit <= 0) {
      return [];
    }

    return list.slice(-limit);
  }

  async clear(agentId: string): Promise<void> {
    this.entries.delete(agentId);
  }
}
