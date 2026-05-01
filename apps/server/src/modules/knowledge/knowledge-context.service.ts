import type { KnowledgePromptContextResult } from './knowledge.types.js';
import type { KnowledgeService } from './knowledge.service.js';

export interface BuildKnowledgeContextInput {
  query: string;
  projectId?: string;
  documentId?: string;
  maxItems?: number;
  maxChars?: number;
}

export class KnowledgeContextService {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  async buildPromptContext(input: BuildKnowledgeContextInput): Promise<KnowledgePromptContextResult> {
    const query = input.query.trim();
    if (query.length === 0) {
      return {
        context: '',
        items: []
      };
    }

    const topK = normalizeTopK(input.maxItems);
    const maxChars = normalizeMaxChars(input.maxChars);
    const retrieval = await this.knowledgeService.retrieve({
      query,
      topK,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.documentId ? { documentId: input.documentId } : {})
    });

    if (retrieval.items.length === 0) {
      return {
        context: '',
        items: []
      };
    }

    const lines: string[] = [
      'Knowledge Context (retrieved from internal documents):',
      'Use these snippets when relevant. If used in reasoning, cite snippet IDs like [knowledge:1].'
    ];

    let consumedChars = 0;
    const acceptedItems: typeof retrieval.items = [];
    for (const [index, item] of retrieval.items.entries()) {
      const snippetId = index + 1;
      const header = `[knowledge:${snippetId}] score=${item.score.toFixed(3)} doc="${item.documentName}" section="${item.sectionPath ?? 'n/a'}"`;
      const content = item.content.trim();
      const block = `${header}\n${content}`;
      if (consumedChars + block.length > maxChars) {
        break;
      }
      consumedChars += block.length;
      acceptedItems.push(item);
      lines.push(block);
    }

    if (acceptedItems.length === 0) {
      return {
        context: '',
        items: []
      };
    }

    return {
      context: lines.join('\n\n'),
      items: acceptedItems
    };
  }
}

function normalizeTopK(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 6;
  }
  return Math.max(1, Math.min(Math.floor(value), 20));
}

function normalizeMaxChars(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 7000;
  }
  return Math.max(1000, Math.min(Math.floor(value), 20_000));
}
