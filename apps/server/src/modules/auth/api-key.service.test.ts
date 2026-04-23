import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryApiKeyRepository } from '../../repositories/in-memory-api-key.repository.js';
import { ApiKeyService } from './api-key.service.js';

const SALT = 'test-salt';

function hashLegacy(rawApiKey: string): string {
  return createHash('sha256').update(`${SALT}:${rawApiKey}`).digest('hex');
}

test('ApiKeyService verifies and migrates legacy hash to scrypt format', async () => {
  const repository = new InMemoryApiKeyRepository();
  const service = new ApiKeyService(repository, SALT);

  const seeded = await repository.ensureActive({
    name: 'legacy-key',
    keyHash: hashLegacy('legacy-secret')
  });

  const verified = await service.verify('legacy-secret');

  assert.ok(verified);
  assert.equal(verified.id, seeded.id);
  assert.equal(verified.keyHash.startsWith('scrypt$'), true);

  const currentHashRecord = await repository.findActiveByHash(service.hash('legacy-secret'));
  assert.ok(currentHashRecord);
  assert.equal(currentHashRecord.id, seeded.id);

  const legacyHashRecord = await repository.findActiveByHash(hashLegacy('legacy-secret'));
  assert.equal(legacyHashRecord, null);
});

test('ApiKeyService revoke still works for legacy-hashed keys during transition', async () => {
  const repository = new InMemoryApiKeyRepository();
  const service = new ApiKeyService(repository, SALT);

  await repository.ensureActive({
    name: 'legacy-key',
    keyHash: hashLegacy('legacy-secret')
  });

  const revoked = await service.revoke('legacy-secret');
  assert.ok(revoked);
  assert.equal(revoked.active, false);

  const verified = await service.verify('legacy-secret');
  assert.equal(verified, null);
});
