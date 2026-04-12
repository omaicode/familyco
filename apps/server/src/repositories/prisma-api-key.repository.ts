import type { PrismaClient } from '@familyco/db';

import type { ApiKeyRecord, ApiKeyRepository } from '../modules/auth/api-key.service.js';

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash }
    });

    if (!apiKey || !apiKey.active) {
      return null;
    }

    return apiKey;
  }

  async ensureActive(input: { name: string; keyHash: string }): Promise<ApiKeyRecord> {
    return this.prisma.apiKey.upsert({
      where: { keyHash: input.keyHash },
      create: {
        name: input.name,
        keyHash: input.keyHash,
        active: true
      },
      update: {
        name: input.name,
        active: true
      }
    });
  }

  async revokeByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const existing = await this.prisma.apiKey.findUnique({
      where: { keyHash }
    });

    if (!existing) {
      return null;
    }

    return this.prisma.apiKey.update({
      where: { keyHash },
      data: {
        active: false
      }
    });
  }
}
