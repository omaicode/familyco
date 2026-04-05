export interface Setting {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSettingInput {
  key: string;
  value: unknown;
}
