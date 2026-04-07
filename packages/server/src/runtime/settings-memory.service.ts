import { randomUUID } from 'node:crypto';

import type { AddMemoryEntryInput, MemoryEntry, MemoryService, SettingsRepository } from '@familyco/core';

interface StoredMemoryEntry {
  id: string;
  agentId: string;
  role: MemoryEntry['role'];
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export class SettingsBackedMemoryService implements MemoryService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly maxEntries = 100
  ) {}

  async add(input: AddMemoryEntryInput): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `mem-${randomUUID()}`,
      agentId: input.agentId,
      role: input.role,
      content: input.content,
      metadata: input.metadata,
      createdAt: new Date()
    };

    const existing = await this.readEntries(input.agentId);
    const nextEntries = [...existing, entry].slice(-this.maxEntries);
    await this.writeEntries(input.agentId, nextEntries);
    return entry;
  }

  async listRecent(agentId: string, limit: number): Promise<MemoryEntry[]> {
    if (limit <= 0) {
      return [];
    }

    const existing = await this.readEntries(agentId);
    return existing.slice(-limit);
  }

  async clear(agentId: string): Promise<void> {
    await this.writeEntries(agentId, []);
  }

  private async readEntries(agentId: string): Promise<MemoryEntry[]> {
    const setting = await this.settingsRepository.get(this.toSettingKey(agentId));
    const value = setting?.value;

    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const record = item as Partial<StoredMemoryEntry>;
      if (
        typeof record.id !== 'string' ||
        typeof record.agentId !== 'string' ||
        typeof record.role !== 'string' ||
        typeof record.content !== 'string' ||
        typeof record.createdAt !== 'string'
      ) {
        return [];
      }

      return [
        {
          id: record.id,
          agentId: record.agentId,
          role: record.role,
          content: record.content,
          metadata: isRecord(record.metadata) ? record.metadata : undefined,
          createdAt: new Date(record.createdAt)
        } satisfies MemoryEntry
      ];
    });
  }

  private async writeEntries(agentId: string, entries: MemoryEntry[]): Promise<void> {
    await this.settingsRepository.upsert({
      key: this.toSettingKey(agentId),
      value: entries.map((entry) => ({
        id: entry.id,
        agentId: entry.agentId,
        role: entry.role,
        content: entry.content,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString()
      }))
    });
  }

  private toSettingKey(agentId: string): string {
    return `agent.memory.${agentId}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
