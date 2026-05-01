import type {
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeDocumentStatus
} from './knowledge.repository.js';

export interface KnowledgeDocumentListItem {
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
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkListItem {
  id: string;
  documentId: string;
  chunkIndex: number;
  sectionPath: string | null;
  page: number | null;
  content: string;
  tokenEstimate: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface KnowledgeRetrieveItem {
  id: string;
  score: number;
  model: string;
  documentId: string;
  documentName: string;
  projectId: string | null;
  source: string;
  chunkIndex: number;
  sectionPath: string | null;
  page: number | null;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface KnowledgeRetrieveResult {
  query: string;
  topK: number;
  items: KnowledgeRetrieveItem[];
}

export interface KnowledgeIndexResult {
  document: KnowledgeDocumentListItem;
  chunkCount: number;
  embeddingModel: string;
}

export interface KnowledgePromptContextResult {
  context: string;
  items: KnowledgeRetrieveItem[];
}

export interface KnowledgeConverterCommandDefinition {
  id: string;
  description: string;
}

export function toKnowledgeDocumentListItem(document: KnowledgeDocumentRecord): KnowledgeDocumentListItem {
  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

export function toKnowledgeChunkListItem(chunk: KnowledgeChunkRecord): KnowledgeChunkListItem {
  return {
    ...chunk,
    createdAt: chunk.createdAt.toISOString()
  };
}
