import { createHash } from 'node:crypto';

export interface KnowledgeEmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embedMany(input: string[]): Promise<number[][]>;
  embedOne(input: string): Promise<number[]>;
}

export class HashKnowledgeEmbeddingProvider implements KnowledgeEmbeddingProvider {
  readonly id = 'hash-v1';
  readonly dimensions: number;

  constructor(dimensions = 256) {
    this.dimensions = dimensions;
  }

  async embedMany(input: string[]): Promise<number[][]> {
    return input.map((value) => this.embedSync(value));
  }

  async embedOne(input: string): Promise<number[]> {
    return this.embedSync(input);
  }

  private embedSync(input: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = tokenize(input);

    if (tokens.length === 0) {
      return vector;
    }

    for (const token of tokens) {
      const digest = createHash('sha256').update(token).digest();
      const index = digest.readUInt32BE(0) % this.dimensions;
      const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
      vector[index] += sign * (1 + ((digest[5] ?? 0) / 255));
    }

    normalizeL2(vector);
    return vector;
  }
}

function tokenize(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length === 0) {
    return [];
  }

  return normalized
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeL2(vector: number[]): void {
  const sumSquares = vector.reduce((sum, item) => sum + (item * item), 0);
  if (sumSquares <= 0) {
    return;
  }

  const norm = Math.sqrt(sumSquares);
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = vector[index] / norm;
  }
}
