import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SettingsService } from '@familyco/core';

export type ChatAttachmentKind = 'file' | 'audio';

export interface ChatAttachmentRecord {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  mediaType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
  transcript?: string;
}

export interface ChatAttachmentData extends ChatAttachmentRecord {
  data: Uint8Array;
}

export class ChatAttachmentStore {
  constructor(
    private readonly settingsService: SettingsService,
    private rootDir = null as string | null
  ) {}

  async save(input: {
    name: string;
    mediaType: string;
    data: Uint8Array;
    kind?: ChatAttachmentKind;
  }): Promise<ChatAttachmentRecord> {
    const workspacePathSetting = await this.settingsService.get('workspace.path');
    const workspacePath = typeof workspacePathSetting?.value == 'string' ? workspacePathSetting.value : process.cwd();
    this.rootDir = path.join(workspacePath, 'chat-attachments');
    await fs.mkdir(this.rootDir, { recursive: true });

    const id = randomUUID();
    const storageKey = id;
    const record: ChatAttachmentRecord = {
      id,
      kind: input.kind ?? inferAttachmentKind(input.mediaType),
      name: sanitizeAttachmentName(input.name),
      mediaType: input.mediaType.trim() || 'application/octet-stream',
      sizeBytes: input.data.byteLength,
      storageKey,
      createdAt: new Date().toISOString()
    };

    await Promise.all([
      fs.writeFile(this.getBinaryPath(storageKey), input.data),
      fs.writeFile(this.getMetadataPath(storageKey), JSON.stringify(record, null, 2), 'utf8')
    ]);

    return record;
  }

  async read(id: string): Promise<ChatAttachmentData | null> {
    const record = await this.getMetadata(id);
    if (!record) {
      return null;
    }

    const data = await fs.readFile(this.getBinaryPath(record.storageKey)).catch((error: unknown) => {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    });

    if (!data) {
      return null;
    }

    return { ...record, data: new Uint8Array(data) };
  }

  async getMetadata(id: string): Promise<ChatAttachmentRecord | null> {
    const raw = await fs.readFile(this.getMetadataPath(id), 'utf8').catch((error: unknown) => {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    });

    if (!raw) {
      return null;
    }

    return parseChatAttachmentRecord(raw);
  }

  async updateMetadata(id: string, patch: Partial<Pick<ChatAttachmentRecord, 'transcript'>>): Promise<ChatAttachmentRecord> {
    const current = await this.getMetadata(id);
    if (!current) {
      throw new Error(`CHAT_ATTACHMENT_NOT_FOUND:${id}`);
    }

    const next: ChatAttachmentRecord = {
      ...current,
      ...(patch.transcript !== undefined ? { transcript: patch.transcript } : {})
    };
    await fs.writeFile(this.getMetadataPath(current.storageKey), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  private getBinaryPath(storageKey: string): string {
    if (!this.rootDir) {
      throw new Error('ChatAttachmentStore rootDir is not initialized');
    }
    return path.join(this.rootDir, `${storageKey}.bin`);
  }

  private getMetadataPath(storageKey: string): string {
    if (!this.rootDir) {
      throw new Error('ChatAttachmentStore rootDir is not initialized');
    }
    return path.join(this.rootDir, `${storageKey}.json`);
  }
}

function inferAttachmentKind(mediaType: string): ChatAttachmentKind {
  return mediaType.toLowerCase().startsWith('audio/') ? 'audio' : 'file';
}

function sanitizeAttachmentName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'attachment';
}

function parseChatAttachmentRecord(raw: string): ChatAttachmentRecord | null {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (
    typeof parsed.id !== 'string' ||
    (parsed.kind !== 'file' && parsed.kind !== 'audio') ||
    typeof parsed.name !== 'string' ||
    typeof parsed.mediaType !== 'string' ||
    typeof parsed.sizeBytes !== 'number' ||
    typeof parsed.storageKey !== 'string' ||
    typeof parsed.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: parsed.id,
    kind: parsed.kind,
    name: parsed.name,
    mediaType: parsed.mediaType,
    sizeBytes: parsed.sizeBytes,
    storageKey: parsed.storageKey,
    createdAt: parsed.createdAt,
    ...(typeof parsed.transcript === 'string' ? { transcript: parsed.transcript } : {})
  };
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT';
}
