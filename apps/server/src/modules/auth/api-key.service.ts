import { createHash, scryptSync } from 'node:crypto';

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
  migrateHash(input: { fromHash: string; toHash: string }): Promise<ApiKeyRecord | null>;
  revokeByHash(keyHash: string): Promise<ApiKeyRecord | null>;
}

export class ApiKeyService {
  private static readonly SCRYPT_KEY_LENGTH = 64;

  constructor(
    private readonly repository: ApiKeyRepository,
    private readonly salt: string
  ) {}

  hash(rawApiKey: string): string {
    const derivedKey = scryptSync(rawApiKey, this.salt, ApiKeyService.SCRYPT_KEY_LENGTH);
    return `scrypt$${derivedKey.toString('hex')}`;
  }

  async verify(rawApiKey: string): Promise<ApiKeyRecord | null> {
    const currentHash = this.hash(rawApiKey);
    const currentRecord = await this.repository.findActiveByHash(currentHash);
    if (currentRecord) {
      return currentRecord;
    }

    const legacyHash = this.hashLegacy(rawApiKey);
    const legacyRecord = await this.repository.findActiveByHash(legacyHash);
    if (!legacyRecord) {
      return null;
    }

    return this.repository.migrateHash({
      fromHash: legacyHash,
      toHash: currentHash
    });
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
    const currentHash = this.hash(rawApiKey);
    const revokedCurrent = await this.repository.revokeByHash(currentHash);
    if (revokedCurrent) {
      return revokedCurrent;
    }

    return this.repository.revokeByHash(this.hashLegacy(rawApiKey));
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

  private hashLegacy(rawApiKey: string): string {
    return createHash('sha256').update(`${this.salt}:${rawApiKey}`).digest('hex');
  }
}
