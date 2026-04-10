import { Prisma, type PrismaClient } from '../db/prisma/client.js';
import type { Setting, SettingsRepository, UpsertSettingInput } from '@familyco/core';
import type { SettingsEncryption } from '../modules/settings/settings.encryption.js';

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly encryption: SettingsEncryption | null = null
  ) {}

  async get(key: string): Promise<Setting | null> {
    const item = await this.prisma.settings.findUnique({ where: { key } });
    if (!item) {
      return null;
    }

    const setting = toSetting(item);
    if (!this.encryption) {
      return setting;
    }

    const decrypted = this.encryption.decryptIfNeeded(setting.value);

    // Auto-upgrade: if the stored value was plaintext for a sensitive key,
    // re-save it encrypted so it won't be readable as plaintext anymore.
    if (
      decrypted === setting.value &&
      this.encryption.isSensitiveKey(key) &&
      typeof setting.value === 'string' &&
      setting.value.trim().length > 0
    ) {
      await this.upsert({ key, value: setting.value });
      return { ...setting, value: decrypted };
    }

    return { ...setting, value: decrypted };
  }

  async list(): Promise<Setting[]> {
    const items = await this.prisma.settings.findMany({
      orderBy: { key: 'asc' }
    });

    return items.map((item) => {
      const setting = toSetting(item);
      if (!this.encryption) {
        return setting;
      }

      return { ...setting, value: this.encryption.decryptIfNeeded(setting.value) };
    });
  }

  async upsert(input: UpsertSettingInput): Promise<Setting> {
    const valueToStore = this.encryption
      ? this.encryption.encryptSettingValue(input.key, input.value)
      : input.value;

    const item = await this.prisma.settings.upsert({
      where: { key: input.key },
      update: {
        value: valueToStore as Prisma.InputJsonValue
      },
      create: {
        key: input.key,
        value: valueToStore as Prisma.InputJsonValue
      }
    });

    const setting = toSetting(item);
    if (!this.encryption) {
      return setting;
    }

    return { ...setting, value: this.encryption.decryptIfNeeded(setting.value) };
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
