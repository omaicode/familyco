import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SettingsService } from '@familyco/core';

import { chunkMarkdownBySections } from './knowledge.chunker.js';
import {
  createDefaultKnowledgeCommandRegistry,
  createKnowledgeTempDir,
  resolveKnowledgeConverterBinaryPath,
  type KnowledgeCommandRegistry
} from './knowledge.command-registry.js';
import { HashKnowledgeEmbeddingProvider, type KnowledgeEmbeddingProvider } from './knowledge.embedder.js';
import type {
  CreateKnowledgeChunkInput,
  CreateKnowledgeEmbeddingInput,
  KnowledgeDocumentRecord,
  KnowledgeRepository
} from './knowledge.repository.js';
import type {
  KnowledgeConverterCommandDefinition,
  KnowledgeIndexResult,
  KnowledgeRetrieveResult
} from './knowledge.types.js';
import { toKnowledgeChunkListItem, toKnowledgeDocumentListItem } from './knowledge.types.js';

export interface UploadKnowledgeDocumentInput {
  name: string;
  fileType: string;
  source?: string;
  projectId?: string;
  data: Uint8Array;
}

export interface ListKnowledgeDocumentsInput {
  projectId?: string;
  status?: 'uploaded' | 'indexing' | 'indexed' | 'failed';
  limit?: number;
}

export interface IndexKnowledgeDocumentInput {
  documentId: string;
  commandId?: string;
  maxChars?: number;
  overlapChars?: number;
}

export interface RetrieveKnowledgeInput {
  query: string;
  topK?: number;
  minScore?: number;
  projectId?: string;
  documentId?: string;
}

export interface KnowledgeConverterStatus {
  installed: boolean;
  path: string | null;
}

export class KnowledgeService {
  private readonly commandRegistry: KnowledgeCommandRegistry;
  private readonly embeddingProvider: KnowledgeEmbeddingProvider;

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly settingsService: SettingsService,
    options?: {
      commandRegistry?: KnowledgeCommandRegistry;
      embeddingProvider?: KnowledgeEmbeddingProvider;
    }
  ) {
    this.commandRegistry = options?.commandRegistry ?? createDefaultKnowledgeCommandRegistry();
    this.embeddingProvider = options?.embeddingProvider ?? new HashKnowledgeEmbeddingProvider();
  }

  listConverterCommands(): KnowledgeConverterCommandDefinition[] {
    return this.commandRegistry.list();
  }

  async getConverterStatus(): Promise<KnowledgeConverterStatus> {
    try {
      const binaryPath = await resolveKnowledgeConverterBinaryPath(this.settingsService);
      return {
        installed: true,
        path: binaryPath
      };
    } catch {
      return {
        installed: false,
        path: null
      };
    }
  }

  async listDocuments(input: ListKnowledgeDocumentsInput = {}): Promise<ReturnType<typeof toKnowledgeDocumentListItem>[]> {
    const rows = await this.repository.listDocuments({
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(typeof input.limit === 'number' ? { limit: input.limit } : {})
    });
    return rows.map(toKnowledgeDocumentListItem);
  }

  async listChunks(documentId: string): Promise<ReturnType<typeof toKnowledgeChunkListItem>[]> {
    const chunks = await this.repository.listChunksByDocumentId(documentId);
    return chunks.map(toKnowledgeChunkListItem);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const document = await this.requireDocument(documentId);
    await this.repository.deleteDocument(document.id);

    const originalRoot = path.dirname(path.dirname(document.filePath));
    await rm(originalRoot, { recursive: true, force: true });

    if (document.markdownPath) {
      await rm(path.dirname(document.markdownPath), { recursive: true, force: true });
    }
  }

  async uploadDocument(input: UploadKnowledgeDocumentInput): Promise<ReturnType<typeof toKnowledgeDocumentListItem>> {
    if (input.data.byteLength === 0) {
      throw new Error('KNOWLEDGE_DOCUMENT_EMPTY');
    }

    const documentId = randomUUID();
    const checksum = createHash('sha256').update(input.data).digest('hex');
    const documentsRoot = await this.resolveDocumentsRoot();
    const safeName = sanitizeFilename(input.name);
    const filePath = path.join(documentsRoot, documentId, 'original', safeName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(input.data));

    const created = await this.repository.createDocument({
      id: documentId,
      name: safeName,
      fileType: input.fileType.trim() || inferFileTypeFromName(safeName),
      source: input.source?.trim() || 'upload',
      projectId: input.projectId?.trim() || null,
      version: 1,
      status: 'uploaded',
      checksum,
      filePath
    });

    return toKnowledgeDocumentListItem(created);
  }

  async indexDocument(input: IndexKnowledgeDocumentInput): Promise<KnowledgeIndexResult> {
    const document = await this.requireDocument(input.documentId);
    const commandId = input.commandId?.trim() || 'doc-convert';
    const command = this.commandRegistry.get(commandId);
    if (!command) {
      throw new Error(`KNOWLEDGE_COMMAND_NOT_FOUND:${commandId}`);
    }

    await this.repository.updateDocument(document.id, {
      status: 'indexing',
      errorMessage: null
    });

    const tempOutputDir = await createKnowledgeTempDir();

    try {
      const binaryPath = await resolveKnowledgeConverterBinaryPath(this.settingsService);
      const commandResult = await command.run({
        binaryPath,
        inputPath: document.filePath,
        outputDir: tempOutputDir
      });

      const combinedMarkdown = commandResult.markdownFiles
        .map((item) => `# Source: ${path.basename(item.path)}\n\n${item.content.trim()}`)
        .join('\n\n');

      const markdownPath = await this.writeCombinedMarkdown(document.id, combinedMarkdown);
      const chunkInputs = chunkMarkdownBySections(
        commandResult.markdownFiles.map((item) => ({
          sourceFile: item.path,
          content: item.content
        })),
        {
          ...(input.maxChars !== undefined ? { maxChars: input.maxChars } : {}),
          ...(input.overlapChars !== undefined ? { overlapChars: input.overlapChars } : {})
        }
      );

      if (chunkInputs.length === 0) {
        throw new Error('KNOWLEDGE_NO_CHUNKS_GENERATED');
      }

      const vectors = await this.embeddingProvider.embedMany(chunkInputs.map((item) => item.content));
      await this.repository.deleteChunksByDocumentId(document.id);

      const createdChunks = await this.repository.createChunks(
        chunkInputs.map((item, index): CreateKnowledgeChunkInput => ({
          documentId: document.id,
          chunkIndex: index,
          sectionPath: item.sectionPath,
          content: item.content,
          tokenEstimate: item.tokenEstimate,
          metadata: item.metadata
        }))
      );

      const embeddingRows: CreateKnowledgeEmbeddingInput[] = createdChunks.map((chunk, index) => ({
        chunkId: chunk.id,
        model: this.embeddingProvider.id,
        dimensions: this.embeddingProvider.dimensions,
        vector: vectors[index] ?? []
      }));
      await this.repository.createEmbeddings(embeddingRows);

      const updatedDocument = await this.repository.updateDocument(document.id, {
        status: 'indexed',
        markdownPath,
        converterCommand: command.id,
        converterMeta: {
          ...commandResult.metadata,
          chunking: {
            maxChars: input.maxChars ?? 1400,
            overlapChars: input.overlapChars ?? Math.floor((input.maxChars ?? 1400) * 0.15)
          },
          embeddingModel: this.embeddingProvider.id,
          embeddingDimensions: this.embeddingProvider.dimensions
        },
        errorMessage: null,
        version: document.version + 1
      });

      return {
        document: toKnowledgeDocumentListItem(updatedDocument),
        chunkCount: createdChunks.length,
        embeddingModel: this.embeddingProvider.id
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.updateDocument(document.id, {
        status: 'failed',
        errorMessage: message
      });
      throw error;
    } finally {
      await rm(tempOutputDir, { recursive: true, force: true });
    }
  }

  async retrieve(input: RetrieveKnowledgeInput): Promise<KnowledgeRetrieveResult> {
    const topK = normalizeTopK(input.topK);
    const minScore = normalizeMinScore(input.minScore);
    const query = input.query.trim();
    if (query.length === 0) {
      throw new Error('KNOWLEDGE_QUERY_REQUIRED');
    }

    const queryVector = await this.embeddingProvider.embedOne(query);
    const scored = await this.repository.searchEmbeddings({
      queryVector,
      topK,
      minScore,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.documentId ? { documentId: input.documentId } : {})
    });

    return {
      query,
      topK,
      items: scored.map((item) => ({
        ...item,
        score: Number(item.score.toFixed(6))
      }))
    };
  }

  private async requireDocument(documentId: string): Promise<KnowledgeDocumentRecord> {
    const document = await this.repository.getDocumentById(documentId);
    if (!document) {
      throw new Error(`KNOWLEDGE_DOCUMENT_NOT_FOUND:${documentId}`);
    }
    return document;
  }

  private async resolveWorkspacePath(): Promise<string> {
    const workspaceSetting = await this.settingsService.get('workspace.path');
    const configuredWorkspace = typeof workspaceSetting?.value === 'string'
      ? workspaceSetting.value.trim()
      : '';

    if (configuredWorkspace.length > 0 && path.isAbsolute(configuredWorkspace) && existsSync(configuredWorkspace)) {
      return configuredWorkspace;
    }

    return process.cwd();
  }

  private async resolveDocumentsRoot(): Promise<string> {
    const workspacePath = await this.resolveWorkspacePath();
    return path.join(workspacePath, 'knowledge', 'documents');
  }

  private async resolveConvertedRoot(): Promise<string> {
    const workspacePath = await this.resolveWorkspacePath();
    return path.join(workspacePath, 'knowledge', 'converted');
  }

  private async writeCombinedMarkdown(documentId: string, content: string): Promise<string> {
    const convertedRoot = await this.resolveConvertedRoot();
    const filePath = path.join(convertedRoot, documentId, 'combined.md');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
    return filePath;
  }
}

export async function readKnowledgeDocumentFile(filePath: string): Promise<Uint8Array> {
  const buffer = await readFile(filePath);
  return new Uint8Array(buffer);
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'document';
  }

  return trimmed
    .replace(/[^\p{L}\p{N}._-]/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 160) || 'document';
}

function inferFileTypeFromName(name: string): string {
  const extension = path.extname(name).toLowerCase().replace('.', '');
  if (!extension) {
    return 'application/octet-stream';
  }
  return extension;
}

function normalizeTopK(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 6;
  }
  return Math.max(1, Math.min(Math.floor(value), 50));
}

function normalizeMinScore(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.12;
  }
  return Math.max(-1, Math.min(1, value));
}
