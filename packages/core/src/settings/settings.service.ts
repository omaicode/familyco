import type { Setting, UpsertSettingInput } from './settings.entity.js';

export interface SettingsRepository {
  get(key: string): Promise<Setting | null>;
  list(): Promise<Setting[]>;
  upsert(input: UpsertSettingInput): Promise<Setting>;
}

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  get(key: string): Promise<Setting | null> {
    return this.repository.get(key);
  }

  list(): Promise<Setting[]> {
    return this.repository.list();
  }

  upsert(input: UpsertSettingInput): Promise<Setting> {
    return this.repository.upsert(input);
  }
}
