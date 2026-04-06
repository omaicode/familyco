import { Prisma, type PrismaClient } from '../db/prisma/client';
import type { Setting, SettingsRepository, UpsertSettingInput } from '@familyco/core';

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<Setting | null> {
    const item = await this.prisma.settings.findUnique({ where: { key } });
    return item ? toSetting(item) : null;
  }

  async list(): Promise<Setting[]> {
    const items = await this.prisma.settings.findMany({
      orderBy: { key: 'asc' }
    });

    return items.map(toSetting);
  }

  async upsert(input: UpsertSettingInput): Promise<Setting> {
    const item = await this.prisma.settings.upsert({
      where: { key: input.key },
      update: {
        value: input.value as Prisma.InputJsonValue
      },
      create: {
        key: input.key,
        value: input.value as Prisma.InputJsonValue
      }
    });

    return toSetting(item);
  }
}

function toSetting(item: {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Setting {
  return {
    key: item.key,
    value: item.value,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}
