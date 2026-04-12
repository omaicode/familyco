import { createHash } from 'node:crypto';

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyHash: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyRepository {
  findActiveByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  ensureActive(input: { name: string; keyHash: string }): Promise<ApiKeyRecord>;
  revokeByHash(keyHash: string): Promise<ApiKeyRecord | null>;
}

export class ApiKeyService {
  constructor(
    private readonly repository: ApiKeyRepository,
    private readonly salt: string
  ) {}

  hash(rawApiKey: string): string {
    return createHash('sha256').update(`${this.salt}:${rawApiKey}`).digest('hex');
  }

  async verify(rawApiKey: string): Promise<ApiKeyRecord | null> {
    return this.repository.findActiveByHash(this.hash(rawApiKey));
  }

  async ensureBootstrapKey(name: string, rawApiKey: string): Promise<ApiKeyRecord> {
    return this.repository.ensureActive({
      name,
      keyHash: this.hash(rawApiKey)
    });
  }

  async create(name: string, rawApiKey: string): Promise<ApiKeyRecord> {
    return this.repository.ensureActive({
      name,
      keyHash: this.hash(rawApiKey)
    });
  }

  async revoke(rawApiKey: string): Promise<ApiKeyRecord | null> {
    return this.repository.revokeByHash(this.hash(rawApiKey));
  }

  async rotate(input: {
    name: string;
    currentApiKey: string;
    newApiKey: string;
  }): Promise<{ revoked: ApiKeyRecord; created: ApiKeyRecord }> {
    const revoked = await this.revoke(input.currentApiKey);
    if (!revoked) {
      throw new Error('AUTH_API_KEY_NOT_FOUND');
    }

    const created = await this.create(input.name, input.newApiKey);
    return {
      revoked,
      created
    };
  }
}
