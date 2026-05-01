export type KnowledgeDocumentStatus = 'uploaded' | 'indexing' | 'indexed' | 'failed';

export interface KnowledgeDocumentRecord {
  id: string;
  name: string;
  fileType: string;
  source: string;
  projectId: string | null;
  version: number;
  status: KnowledgeDocumentStatus;
  checksum: string;
  filePath: string;
  markdownPath: string | null;
  converterCommand: string | null;
  converterMeta: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  sectionPath: string | null;
  page: number | null;
  content: string;
  tokenEstimate: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface KnowledgeEmbeddingRecord {
  id: string;
  chunkId: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchKnowledgeEmbeddingsInput {
  queryVector: number[];
  topK: number;
  minScore?: number;
  projectId?: string;
  documentId?: string;
}

export interface KnowledgeSearchMatch {
  score: number;
  model: string;
  documentId: string;
  documentName: string;
  projectId: string | null;
  source: string;
  id: string;
  chunkIndex: number;
  sectionPath: string | null;
  page: number | null;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface CreateKnowledgeDocumentInput {
  id?: string;
  name: string;
  fileType: string;
  source: string;
  projectId?: string | null;
  version: number;
  status: KnowledgeDocumentStatus;
  checksum: string;
  filePath: string;
  markdownPath?: string | null;
  converterCommand?: string | null;
  converterMeta?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

export interface UpdateKnowledgeDocumentInput {
  name?: string;
  fileType?: string;
  source?: string;
  projectId?: string | null;
  version?: number;
  status?: KnowledgeDocumentStatus;
  checksum?: string;
  filePath?: string;
  markdownPath?: string | null;
  converterCommand?: string | null;
  converterMeta?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

export interface ListKnowledgeDocumentsFilter {
  projectId?: string;
  status?: KnowledgeDocumentStatus;
  limit?: number;
}

export interface CreateKnowledgeChunkInput {
  documentId: string;
  chunkIndex: number;
  sectionPath?: string | null;
  page?: number | null;
  content: string;
  tokenEstimate?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateKnowledgeEmbeddingInput {
  chunkId: string;
  model: string;
  dimensions: number;
  vector: number[];
}

export interface ListKnowledgeSearchCandidatesFilter {
  projectId?: string;
  documentId?: string;
}

export interface KnowledgeRepository {
  createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord>;
  updateDocument(id: string, input: UpdateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord>;
  getDocumentById(id: string): Promise<KnowledgeDocumentRecord | null>;
  deleteDocument(id: string): Promise<void>;
  listDocuments(filter?: ListKnowledgeDocumentsFilter): Promise<KnowledgeDocumentRecord[]>;
  deleteChunksByDocumentId(documentId: string): Promise<void>;
  createChunks(input: CreateKnowledgeChunkInput[]): Promise<KnowledgeChunkRecord[]>;
  createEmbeddings(input: CreateKnowledgeEmbeddingInput[]): Promise<void>;
  listChunksByDocumentId(documentId: string): Promise<KnowledgeChunkRecord[]>;
  searchEmbeddings(input: SearchKnowledgeEmbeddingsInput): Promise<KnowledgeSearchMatch[]>;
}
