import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import DatabaseConstructor from 'better-sqlite3';

import type {
  CreateKnowledgeChunkInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeEmbeddingInput,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeRepository,
  KnowledgeSearchMatch,
  ListKnowledgeDocumentsFilter,
  SearchKnowledgeEmbeddingsInput,
  UpdateKnowledgeDocumentInput
} from '../modules/knowledge/knowledge.repository.js';

type SqliteRow = Record<string, unknown>;

export interface SqliteVectorKnowledgeRepositoryOptions {
  dbPath: string;
  vectorDimensions?: number;
}

export class SqliteVectorKnowledgeRepository implements KnowledgeRepository {
  private readonly db: DatabaseConstructor.Database;
  private readonly vectorDimensions: number;

  constructor(options: SqliteVectorKnowledgeRepositoryOptions) {
    this.vectorDimensions = options.vectorDimensions ?? 256;
    mkdirSync(path.dirname(options.dbPath), { recursive: true });

    this.db = new DatabaseConstructor(options.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.createSchema();
    this.initializeVector();
  }

  async createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO knowledge_documents (
           id, name, file_type, source, project_id, version, status, checksum, file_path,
           markdown_path, converter_command, converter_meta, error_message, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.fileType,
        input.source,
        input.projectId ?? null,
        input.version,
        input.status,
        input.checksum,
        input.filePath,
        input.markdownPath ?? null,
        input.converterCommand ?? null,
        stringifyJson(input.converterMeta),
        input.errorMessage ?? null,
        now,
        now
      );
    return this.requireDocument(id);
  }

  async updateDocument(id: string, input: UpdateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    const updates: string[] = [];
    const values: unknown[] = [];
    const updatedAt = new Date().toISOString();

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.fileType !== undefined) {
      updates.push('file_type = ?');
      values.push(input.fileType);
    }
    if (input.source !== undefined) {
      updates.push('source = ?');
      values.push(input.source);
    }
    if (input.projectId !== undefined) {
      updates.push('project_id = ?');
      values.push(input.projectId);
    }
    if (input.version !== undefined) {
      updates.push('version = ?');
      values.push(input.version);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.checksum !== undefined) {
      updates.push('checksum = ?');
      values.push(input.checksum);
    }
    if (input.filePath !== undefined) {
      updates.push('file_path = ?');
      values.push(input.filePath);
    }
    if (input.markdownPath !== undefined) {
      updates.push('markdown_path = ?');
      values.push(input.markdownPath);
    }
    if (input.converterCommand !== undefined) {
      updates.push('converter_command = ?');
      values.push(input.converterCommand);
    }
    if (input.converterMeta !== undefined) {
      updates.push('converter_meta = ?');
      values.push(stringifyJson(input.converterMeta));
    }
    if (input.errorMessage !== undefined) {
      updates.push('error_message = ?');
      values.push(input.errorMessage);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(updatedAt);
      values.push(id);
      this.db.prepare(`UPDATE knowledge_documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.requireDocument(id);
  }

  async getDocumentById(id: string): Promise<KnowledgeDocumentRecord | null> {
    const row = this.db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(id) as SqliteRow | undefined;
    return row ? toDocumentRecord(row) : null;
  }

  async deleteDocument(id: string): Promise<void> {
    const result = this.db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new Error(`KNOWLEDGE_DOCUMENT_NOT_FOUND:${id}`);
    }
  }

  async listDocuments(filter: ListKnowledgeDocumentsFilter = {}): Promise<KnowledgeDocumentRecord[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.projectId) {
      where.push('project_id = ?');
      values.push(filter.projectId);
    }
    if (filter.status) {
      where.push('status = ?');
      values.push(filter.status);
    }

    const sql = [
      'SELECT * FROM knowledge_documents',
      where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
      'ORDER BY updated_at DESC',
      typeof filter.limit === 'number' ? 'LIMIT ?' : ''
    ]
      .filter((part) => part.length > 0)
      .join(' ');

    if (typeof filter.limit === 'number') {
      values.push(Math.max(1, Math.min(Math.floor(filter.limit), 1000)));
    }

    const rows = this.db.prepare(sql).all(...values) as SqliteRow[];
    return rows.map((row) => toDocumentRecord(row));
  }

  async deleteChunksByDocumentId(documentId: string): Promise<void> {
    this.db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(documentId);
  }

  async createChunks(input: CreateKnowledgeChunkInput[]): Promise<KnowledgeChunkRecord[]> {
    const now = new Date().toISOString();
    const rows: KnowledgeChunkRecord[] = [];
    const insert = this.db.prepare(
      `INSERT INTO knowledge_chunks (
         id, document_id, chunk_index, section_path, page, content, token_estimate, metadata, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction((items: CreateKnowledgeChunkInput[]) => {
      for (const item of items) {
        const id = randomUUID();
        insert.run(
          id,
          item.documentId,
          item.chunkIndex,
          item.sectionPath ?? null,
          item.page ?? null,
          item.content,
          item.tokenEstimate ?? null,
          stringifyJson(item.metadata),
          now
        );
        rows.push({
          id,
          documentId: item.documentId,
          chunkIndex: item.chunkIndex,
          sectionPath: item.sectionPath ?? null,
          page: item.page ?? null,
          content: item.content,
          tokenEstimate: item.tokenEstimate ?? null,
          metadata: item.metadata ?? null,
          createdAt: new Date(now)
        });
      }
    });

    transaction(input);
    return rows;
  }

  async createEmbeddings(input: CreateKnowledgeEmbeddingInput[]): Promise<void> {
    const update = this.db.prepare(
      `UPDATE knowledge_chunks
       SET embedding = vector_as_f32(?),
           embedding_model = ?,
           embedding_dimensions = ?
       WHERE id = ?`
    );

    const transaction = this.db.transaction((items: CreateKnowledgeEmbeddingInput[]) => {
      for (const item of items) {
        const result = update.run(JSON.stringify(item.vector), item.model, item.dimensions, item.chunkId);
        if (result.changes === 0) {
          throw new Error(`KNOWLEDGE_CHUNK_NOT_FOUND:${item.chunkId}`);
        }
      }
    });

    transaction(input);
  }

  async listChunksByDocumentId(documentId: string): Promise<KnowledgeChunkRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT id, document_id, chunk_index, section_path, page, content, token_estimate, metadata, created_at
         FROM knowledge_chunks
         WHERE document_id = ?
         ORDER BY chunk_index ASC`
      )
      .all(documentId) as SqliteRow[];

    return rows.map((row) => toChunkRecord(row));
  }

  async searchEmbeddings(input: SearchKnowledgeEmbeddingsInput): Promise<KnowledgeSearchMatch[]> {
    const topK = Math.max(1, Math.min(Math.floor(input.topK), 50));
    const minScore = typeof input.minScore === 'number' ? input.minScore : -1;
    const queryVector = JSON.stringify(input.queryVector);

    const filters: string[] = ["d.status = 'indexed'", 'c.embedding IS NOT NULL'];
    const values: unknown[] = [queryVector];
    if (input.projectId) {
      filters.push('d.project_id = ?');
      values.push(input.projectId);
    }
    if (input.documentId) {
      filters.push('d.id = ?');
      values.push(input.documentId);
    }
    values.push(topK);

    const rows = this.db
      .prepare(
        `SELECT
           c.id AS chunk_id,
           c.chunk_index AS chunk_index,
           c.section_path AS section_path,
           c.page AS page,
           c.content AS content,
           c.metadata AS metadata,
           c.embedding_model AS model,
           d.id AS document_id,
           d.name AS document_name,
           d.project_id AS project_id,
           d.source AS source,
           v.distance AS distance
         FROM vector_full_scan('knowledge_chunks', 'embedding', vector_as_f32(?)) AS v
         JOIN knowledge_chunks c ON c.rowid = v.rowid
         JOIN knowledge_documents d ON d.id = c.document_id
         WHERE ${filters.join(' AND ')}
         ORDER BY v.distance ASC
         LIMIT ?`
      )
      .all(...values) as SqliteRow[];

    return rows
      .map((row: SqliteRow): KnowledgeSearchMatch | null => {
        const score = normalizeCosineScore(Number(row.distance));
        if (!Number.isFinite(score) || score < minScore) {
          return null;
        }
        return {
          score,
          model: typeof row.model === 'string' && row.model.length > 0 ? row.model : 'unknown',
          documentId: String(row.document_id),
          documentName: String(row.document_name),
          projectId: row.project_id === null ? null : String(row.project_id),
          source: String(row.source),
          id: String(row.chunk_id),
          chunkIndex: Number(row.chunk_index),
          sectionPath: row.section_path === null ? null : String(row.section_path),
          page: row.page === null ? null : Number(row.page),
          content: String(row.content),
          metadata: parseJsonRecord(row.metadata)
        };
      })
      .filter((item): item is KnowledgeSearchMatch => item !== null);
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        source TEXT NOT NULL,
        project_id TEXT,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        checksum TEXT NOT NULL,
        file_path TEXT NOT NULL,
        markdown_path TEXT,
        converter_command TEXT,
        converter_meta TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS knowledge_documents_project_status_idx
        ON knowledge_documents (project_id, status, updated_at);

      CREATE INDEX IF NOT EXISTS knowledge_documents_status_updated_idx
        ON knowledge_documents (status, updated_at);

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        section_path TEXT,
        page INTEGER,
        content TEXT NOT NULL,
        token_estimate INTEGER,
        metadata TEXT,
        embedding BLOB,
        embedding_model TEXT,
        embedding_dimensions INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY(document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS knowledge_chunks_document_chunk_idx
        ON knowledge_chunks (document_id, chunk_index);
    `);
  }

  private initializeVector(): void {
    const extensionPath = resolveSqliteVectorExtensionPath();
    this.db.loadExtension(extensionPath);
    const options = `dimension=${this.vectorDimensions},type=FLOAT32,distance=COSINE`;
    this.db.prepare("SELECT vector_init('knowledge_chunks', 'embedding', ?)").get(options);
  }

  private requireDocument(documentId: string): KnowledgeDocumentRecord {
    const row = this.db
      .prepare('SELECT * FROM knowledge_documents WHERE id = ?')
      .get(documentId) as SqliteRow | undefined;
    if (!row) {
      throw new Error(`KNOWLEDGE_DOCUMENT_NOT_FOUND:${documentId}`);
    }
    return toDocumentRecord(row);
  }
}

function toDocumentRecord(row: SqliteRow): KnowledgeDocumentRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    fileType: String(row.file_type),
    source: String(row.source),
    projectId: row.project_id === null ? null : String(row.project_id),
    version: Number(row.version),
    status: normalizeStatus(String(row.status)),
    checksum: String(row.checksum),
    filePath: String(row.file_path),
    markdownPath: row.markdown_path === null ? null : String(row.markdown_path),
    converterCommand: row.converter_command === null ? null : String(row.converter_command),
    converterMeta: parseJsonRecord(row.converter_meta),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}

function toChunkRecord(row: SqliteRow): KnowledgeChunkRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    chunkIndex: Number(row.chunk_index),
    sectionPath: row.section_path === null ? null : String(row.section_path),
    page: row.page === null ? null : Number(row.page),
    content: String(row.content),
    tokenEstimate: row.token_estimate === null ? null : Number(row.token_estimate),
    metadata: parseJsonRecord(row.metadata),
    createdAt: new Date(String(row.created_at))
  };
}

function normalizeStatus(value: string): KnowledgeDocumentRecord['status'] {
  if (value === 'uploaded' || value === 'indexing' || value === 'indexed' || value === 'failed') {
    return value;
  }
  return 'uploaded';
}

function stringifyJson(value: Record<string, unknown> | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return JSON.stringify(value);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeCosineScore(distance: number): number {
  const rawScore = 1 - distance;
  if (!Number.isFinite(rawScore)) {
    return -1;
  }
  return Math.max(-1, Math.min(1, rawScore));
}

function resolveSqliteVectorExtensionPath(): string {
  const require = createRequire(import.meta.url);
  const sqliteVector = require('@sqliteai/sqlite-vector') as {
    getExtensionPath?: () => string;
  };
  if (typeof sqliteVector?.getExtensionPath !== 'function') {
    throw new Error('KNOWLEDGE_VECTOR_EXTENSION_RESOLVE_FAILED');
  }
  const extensionPath = sqliteVector.getExtensionPath();
  const unpackedPath = extensionPath.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2');
  if (unpackedPath !== extensionPath && existsSync(unpackedPath)) {
    return unpackedPath;
  }
  return extensionPath;
}
