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

  async migrateHash(input: { fromHash: string; toHash: string }): Promise<ApiKeyRecord | null> {
    const existing = await this.prisma.apiKey.findUnique({
      where: { keyHash: input.fromHash }
    });

    if (!existing || !existing.active) {
      return null;
    }

    const target = await this.prisma.apiKey.findUnique({
      where: { keyHash: input.toHash }
    });

    if (target) {
      const [activeTarget] = await this.prisma.$transaction([
        this.prisma.apiKey.update({
          where: { keyHash: input.toHash },
          data: { active: true }
        }),
        this.prisma.apiKey.update({
          where: { keyHash: input.fromHash },
          data: { active: false }
        })
      ]);
      return activeTarget;
    }

    return this.prisma.apiKey.update({
      where: { keyHash: input.fromHash },
      data: { keyHash: input.toHash }
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
