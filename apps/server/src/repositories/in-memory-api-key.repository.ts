import { randomUUID } from 'node:crypto';

import type { ApiKeyRecord, ApiKeyRepository } from '../modules/auth/api-key.service.js';

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  private readonly keys = new Map<string, ApiKeyRecord>();

  async findActiveByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const apiKey = this.keys.get(keyHash);
    if (!apiKey || !apiKey.active) {
      return null;
    }

    return apiKey;
  }

  async ensureActive(input: { name: string; keyHash: string }): Promise<ApiKeyRecord> {
    const existing = this.keys.get(input.keyHash);
    const now = new Date();

    if (existing) {
      const updated: ApiKeyRecord = {
        ...existing,
        name: input.name,
        active: true,
        updatedAt: now
      };
      this.keys.set(input.keyHash, updated);
      return updated;
    }

    const created: ApiKeyRecord = {
      id: randomUUID(),
      name: input.name,
      keyHash: input.keyHash,
      active: true,
      createdAt: now,
      updatedAt: now
    };

    this.keys.set(input.keyHash, created);
    return created;
  }

  async revokeByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const existing = this.keys.get(keyHash);
    if (!existing) {
      return null;
    }

    const revoked: ApiKeyRecord = {
      ...existing,
      active: false,
      updatedAt: new Date()
    };

    this.keys.set(keyHash, revoked);
    return revoked;
  }
}
