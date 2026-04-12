import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM encryption for sensitive settings values.
 *
 * Encrypted values are stored as JSON objects with the shape:
 *   { "$enc": "<iv_hex>:<authTag_hex>:<ciphertext_hex>" }
 *
 * Keys considered sensitive: any key ending in `.apiKey`
 * (e.g. `provider.apiKey`, `provider.openai.apiKey`).
 *
 * Decryption transparently handles legacy plaintext values and will
 * auto-upgrade them to encrypted form on the next write.
 */

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MARKER = '$enc';

const SENSITIVE_PATTERNS: RegExp[] = [
  /\.apiKey$/u,
  /^provider\.apiKey$/u
];

export interface EncryptedSettingValue {
  [MARKER]: string;
}

export class SettingsEncryption {
  private readonly key: Buffer;

  constructor(keyHex: string) {
    const buf = Buffer.from(keyHex, 'hex');
    if (buf.length !== 32) {
      throw new Error(
        `SETTINGS_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars). Got ${buf.length} bytes.`
      );
    }
    this.key = buf;
  }

  isSensitiveKey(settingKey: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(settingKey));
  }

  isEncryptedValue(value: unknown): value is EncryptedSettingValue {
    return (
      typeof value === 'object' &&
      value !== null &&
      MARKER in value &&
      typeof (value as Record<string, unknown>)[MARKER] === 'string'
    );
  }

  encrypt(plaintext: string): EncryptedSettingValue {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    return { [MARKER]: payload };
  }

  decrypt(value: EncryptedSettingValue): string {
    const parts = value[MARKER].split(':');
    if (parts.length !== 3) {
      throw new Error('SETTINGS_DECRYPTION_FAILED:Malformed encrypted value');
    }

    const [ivHex, tagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('SETTINGS_DECRYPTION_FAILED:Invalid IV or auth tag length');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /**
   * Decrypts a value if it is encrypted, returns it as-is otherwise.
   * Sensitive plaintext strings are returned unchanged — the caller
   * (repository) is responsible for auto-upgrading on write.
   */
  decryptIfNeeded(value: unknown): unknown {
    if (this.isEncryptedValue(value)) {
      return this.decrypt(value);
    }

    return value;
  }

  /**
   * Encrypts a plaintext string for a sensitive setting.
   * If the value is already encrypted (e.g. re-saving without change) it is
   * returned as-is.
   */
  encryptSettingValue(settingKey: string, value: unknown): unknown {
    if (!this.isSensitiveKey(settingKey)) {
      return value;
    }

    if (this.isEncryptedValue(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return this.encrypt(value);
    }

    return value;
  }
}

/**
 * Build a `SettingsEncryption` instance from the `SETTINGS_ENCRYPTION_KEY`
 * environment variable, or return `null` if the variable is not set.
 *
 * In production (`NODE_ENV=production`) the key is required — the caller
 * (validated in `main.ts`) must enforce this.
 */
export function createSettingsEncryption(): SettingsEncryption | null {
  const keyHex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!keyHex || keyHex.trim().length === 0) {
    return null;
  }

  return new SettingsEncryption(keyHex.trim());
}
