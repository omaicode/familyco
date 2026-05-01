import { randomUUID } from 'node:crypto';

import type {
  CreateKnowledgeChunkInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeEmbeddingInput,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEmbeddingRecord,
  KnowledgeRepository,
  KnowledgeSearchMatch,
  ListKnowledgeDocumentsFilter,
  SearchKnowledgeEmbeddingsInput,
  UpdateKnowledgeDocumentInput
} from '../modules/knowledge/knowledge.repository.js';

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly documents = new Map<string, KnowledgeDocumentRecord>();
  private readonly chunks = new Map<string, KnowledgeChunkRecord>();
  private readonly chunksByDocumentId = new Map<string, string[]>();
  private readonly embeddingsByChunkId = new Map<string, KnowledgeEmbeddingRecord>();

  async createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    const now = new Date();
    const document: KnowledgeDocumentRecord = {
      id: input.id ?? randomUUID(),
      name: input.name,
      fileType: input.fileType,
      source: input.source,
      projectId: input.projectId ?? null,
      version: input.version,
      status: input.status,
      checksum: input.checksum,
      filePath: input.filePath,
      markdownPath: input.markdownPath ?? null,
      converterCommand: input.converterCommand ?? null,
      converterMeta: input.converterMeta ?? null,
      errorMessage: input.errorMessage ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.documents.set(document.id, document);
    return { ...document };
  }

  async updateDocument(id: string, input: UpdateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error(`KNOWLEDGE_DOCUMENT_NOT_FOUND:${id}`);
    }

    const updated: KnowledgeDocumentRecord = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.fileType !== undefined ? { fileType: input.fileType } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.version !== undefined ? { version: input.version } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.checksum !== undefined ? { checksum: input.checksum } : {}),
      ...(input.filePath !== undefined ? { filePath: input.filePath } : {}),
      ...(input.markdownPath !== undefined ? { markdownPath: input.markdownPath } : {}),
      ...(input.converterCommand !== undefined ? { converterCommand: input.converterCommand } : {}),
      ...(input.converterMeta !== undefined ? { converterMeta: input.converterMeta } : {}),
      ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
      updatedAt: new Date()
    };

    this.documents.set(id, updated);
    return { ...updated };
  }

  async getDocumentById(id: string): Promise<KnowledgeDocumentRecord | null> {
    const document = this.documents.get(id);
    return document ? { ...document } : null;
  }

  async deleteDocument(id: string): Promise<void> {
    const exists = this.documents.has(id);
    if (!exists) {
      throw new Error(`KNOWLEDGE_DOCUMENT_NOT_FOUND:${id}`);
    }
    await this.deleteChunksByDocumentId(id);
    this.documents.delete(id);
    this.chunksByDocumentId.delete(id);
  }

  async listDocuments(filter: ListKnowledgeDocumentsFilter = {}): Promise<KnowledgeDocumentRecord[]> {
    const limit = normalizeLimit(filter.limit);
    return Array.from(this.documents.values())
      .filter((item) => (filter.projectId ? item.projectId === filter.projectId : true))
      .filter((item) => (filter.status ? item.status === filter.status : true))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, limit)
      .map((item) => ({ ...item }));
  }

  async deleteChunksByDocumentId(documentId: string): Promise<void> {
    const chunkIds = this.chunksByDocumentId.get(documentId) ?? [];
    for (const chunkId of chunkIds) {
      this.chunks.delete(chunkId);
      this.embeddingsByChunkId.delete(chunkId);
    }
    this.chunksByDocumentId.set(documentId, []);
  }

  async createChunks(input: CreateKnowledgeChunkInput[]): Promise<KnowledgeChunkRecord[]> {
    const created: KnowledgeChunkRecord[] = [];
    for (const item of input) {
      const chunk: KnowledgeChunkRecord = {
        id: randomUUID(),
        documentId: item.documentId,
        chunkIndex: item.chunkIndex,
        sectionPath: item.sectionPath ?? null,
        page: item.page ?? null,
        content: item.content,
        tokenEstimate: item.tokenEstimate ?? null,
        metadata: item.metadata ?? null,
        createdAt: new Date()
      };
      this.chunks.set(chunk.id, chunk);
      const existing = this.chunksByDocumentId.get(chunk.documentId) ?? [];
      existing.push(chunk.id);
      this.chunksByDocumentId.set(chunk.documentId, existing);
      created.push({ ...chunk });
    }
    return created;
  }

  async createEmbeddings(input: CreateKnowledgeEmbeddingInput[]): Promise<void> {
    for (const item of input) {
      this.embeddingsByChunkId.set(item.chunkId, {
        id: randomUUID(),
        chunkId: item.chunkId,
        model: item.model,
        dimensions: item.dimensions,
        vector: [...item.vector],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  async listChunksByDocumentId(documentId: string): Promise<KnowledgeChunkRecord[]> {
    const chunkIds = this.chunksByDocumentId.get(documentId) ?? [];
    return chunkIds
      .map((chunkId) => this.chunks.get(chunkId))
      .filter((item): item is KnowledgeChunkRecord => Boolean(item))
      .sort((left, right) => left.chunkIndex - right.chunkIndex)
      .map((item) => ({ ...item }));
  }

  async searchEmbeddings(input: SearchKnowledgeEmbeddingsInput): Promise<KnowledgeSearchMatch[]> {
    const minScore = typeof input.minScore === 'number' ? input.minScore : -1;
    const matches: KnowledgeSearchMatch[] = [];
    for (const chunk of this.chunks.values()) {
      const document = this.documents.get(chunk.documentId);
      const embedding = this.embeddingsByChunkId.get(chunk.id);
      if (!document || !embedding || document.status !== 'indexed') {
        continue;
      }
      if (input.documentId && document.id !== input.documentId) {
        continue;
      }
      if (input.projectId && document.projectId !== input.projectId) {
        continue;
      }

      const score = cosineSimilarity(input.queryVector, embedding.vector);
      if (!Number.isFinite(score) || score < minScore) {
        continue;
      }

      matches.push({
        score,
        model: embedding.model,
        documentId: document.id,
        documentName: document.name,
        projectId: document.projectId,
        source: document.source,
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        sectionPath: chunk.sectionPath,
        page: chunk.page,
        content: chunk.content,
        metadata: chunk.metadata
      });
    }

    return matches.sort((left, right) => right.score - left.score).slice(0, Math.max(1, Math.min(input.topK, 50)));
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 200;
  }
  return Math.max(1, Math.min(Math.floor(limit), 1000));
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }

  if (leftNorm <= 0 || rightNorm <= 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
