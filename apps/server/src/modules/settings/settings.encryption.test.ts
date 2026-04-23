import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { randomBytes } from 'node:crypto';

import { SettingsEncryption } from './settings.encryption.js';

const makeKey = (): string => randomBytes(32).toString('hex');

describe('SettingsEncryption', () => {
  it('encrypts and decrypts a string value correctly', () => {
    const enc = new SettingsEncryption(makeKey());
    const plaintext = 'sk-test-12345';
    const encrypted = enc.encrypt(plaintext);

    assert.equal(typeof encrypted.$enc, 'string');
    assert.notEqual(encrypted.$enc, plaintext);

    const decrypted = enc.decrypt(encrypted);
    assert.equal(decrypted, plaintext);
  });

  it('isEncryptedValue returns true for encrypted shape, false for strings', () => {
    const enc = new SettingsEncryption(makeKey());
    assert.equal(enc.isEncryptedValue({ $enc: 'iv:tag:cipher' }), true);
    assert.equal(enc.isEncryptedValue('plaintext'), false);
    assert.equal(enc.isEncryptedValue(null), false);
    assert.equal(enc.isEncryptedValue(42), false);
  });

  it('isSensitiveKey matches apiKey patterns only', () => {
    const enc = new SettingsEncryption(makeKey());
    assert.equal(enc.isSensitiveKey('provider.apiKey'), true);
    assert.equal(enc.isSensitiveKey('provider.openai.apiKey'), true);
    assert.equal(enc.isSensitiveKey('provider.claude.apiKey'), true);
    assert.equal(enc.isSensitiveKey('provider.openai.oauth.accessToken'), true);
    assert.equal(enc.isSensitiveKey('provider.openai.oauth.refreshToken'), true);
    assert.equal(enc.isSensitiveKey('provider.name'), false);
    assert.equal(enc.isSensitiveKey('provider.defaultModel'), false);
    assert.equal(enc.isSensitiveKey('company.name'), false);
  });

  it('encryptSettingValue encrypts sensitive keys and leaves others alone', () => {
    const enc = new SettingsEncryption(makeKey());
    const encrypted = enc.encryptSettingValue('provider.openai.apiKey', 'sk-abc');
    assert.equal(enc.isEncryptedValue(encrypted), true);

    const unchanged = enc.encryptSettingValue('provider.name', 'openai');
    assert.equal(unchanged, 'openai');
  });

  it('encryptSettingValue does not double-encrypt already encrypted values', () => {
    const enc = new SettingsEncryption(makeKey());
    const first = enc.encryptSettingValue('provider.apiKey', 'sk-secret');
    const second = enc.encryptSettingValue('provider.apiKey', first);
    assert.deepEqual(first, second);
  });

  it('decryptIfNeeded returns plaintext for non-encrypted values', () => {
    const enc = new SettingsEncryption(makeKey());
    assert.equal(enc.decryptIfNeeded('plain'), 'plain');
    assert.equal(enc.decryptIfNeeded(42), 42);
  });

  it('decryptIfNeeded decrypts encrypted values', () => {
    const enc = new SettingsEncryption(makeKey());
    const encrypted = enc.encrypt('my-api-key');
    assert.equal(enc.decryptIfNeeded(encrypted), 'my-api-key');
  });

  it('throws on invalid key length', () => {
    assert.throws(
      () => new SettingsEncryption('tooshort'),
      /must be exactly 32 bytes/u
    );
  });

  it('different keys produce different ciphertext', () => {
    const enc1 = new SettingsEncryption(makeKey());
    const enc2 = new SettingsEncryption(makeKey());
    const a = enc1.encrypt('test');
    const b = enc2.encrypt('test');
    assert.notEqual(a.$enc, b.$enc);
  });

  it('same plaintext encrypts to different ciphertext each call (random IV)', () => {
    const enc = new SettingsEncryption(makeKey());
    const a = enc.encrypt('test');
    const b = enc.encrypt('test');
    assert.notEqual(a.$enc, b.$enc);
  });
});
