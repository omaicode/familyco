import type { Setting, SettingsRepository, UpsertSettingInput } from '@familyco/core';

export class InMemorySettingsRepository implements SettingsRepository {
  private readonly store = new Map<string, Setting>();

  async get(key: string): Promise<Setting | null> {
    return this.store.get(key) ?? null;
  }

  async list(): Promise<Setting[]> {
    return Array.from(this.store.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  async upsert(input: UpsertSettingInput): Promise<Setting> {
    const existing = this.store.get(input.key);
    const now = new Date();

    const next: Setting = {
      key: input.key,
      value: input.value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    this.store.set(input.key, next);
    return next;
  }
}
