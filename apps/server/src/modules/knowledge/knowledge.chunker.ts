export interface MarkdownChunkInput {
  sourceFile: string;
  content: string;
}

export interface MarkdownChunkOutput {
  sectionPath: string | null;
  content: string;
  tokenEstimate: number;
  metadata: Record<string, unknown>;
}

export interface ChunkMarkdownOptions {
  maxChars?: number;
  overlapChars?: number;
}

interface SectionBlock {
  headingPath: string[];
  body: string;
}

export function chunkMarkdownBySections(input: MarkdownChunkInput[], options: ChunkMarkdownOptions = {}): MarkdownChunkOutput[] {
  const maxChars = normalizeMaxChars(options.maxChars);
  const overlapChars = normalizeOverlapChars(options.overlapChars, maxChars);

  const chunks: MarkdownChunkOutput[] = [];
  for (const item of input) {
    const sections = extractSections(item.content);
    for (const section of sections) {
      const sectionPath = section.headingPath.length > 0 ? section.headingPath.join(' > ') : null;
      const sectionChunks = splitWithOverlap(section.body, maxChars, overlapChars);
      for (const chunk of sectionChunks) {
        const trimmed = chunk.trim();
        if (trimmed.length === 0) {
          continue;
        }

        chunks.push({
          sectionPath,
          content: trimmed,
          tokenEstimate: estimateTokenCount(trimmed),
          metadata: {
            sourceFile: item.sourceFile
          }
        });
      }
    }
  }

  return chunks;
}

function extractSections(markdown: string): SectionBlock[] {
  const lines = markdown.split(/\r?\n/);
  const sections: SectionBlock[] = [];
  const headingStack: string[] = [];
  let currentBody: string[] = [];
  let currentHeadingPath: string[] = [];

  const flush = (): void => {
    if (currentBody.length === 0) {
      return;
    }
    sections.push({
      headingPath: [...currentHeadingPath],
      body: currentBody.join('\n').trim()
    });
    currentBody = [];
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) {
      currentBody.push(line);
      continue;
    }

    flush();
    const depth = match[1]?.length ?? 1;
    const headingText = (match[2] ?? '').trim();
    if (!headingText) {
      continue;
    }

    headingStack.splice(depth - 1);
    headingStack[depth - 1] = headingText;
    currentHeadingPath = headingStack.filter((item) => item.length > 0);
    currentBody.push(line);
  }

  flush();
  return sections;
}

function splitWithOverlap(content: string, maxChars: number, overlapChars: number): string[] {
  if (content.length <= maxChars) {
    return [content];
  }

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    const end = Math.min(cursor + maxChars, content.length);
    let slice = content.slice(cursor, end);

    if (end < content.length) {
      const boundary = slice.lastIndexOf('\n\n');
      if (boundary > Math.floor(maxChars * 0.5)) {
        slice = slice.slice(0, boundary + 2);
      }
    }

    const trimmedSlice = slice.trim();
    if (trimmedSlice.length > 0) {
      chunks.push(trimmedSlice);
    }

    if (end >= content.length) {
      break;
    }

    const step = Math.max(1, slice.length - overlapChars);
    cursor += step;
  }

  return chunks;
}

function estimateTokenCount(content: string): number {
  const words = content.trim().split(/\s+/).filter((item) => item.length > 0).length;
  return Math.max(1, Math.round(words * 1.2));
}

function normalizeMaxChars(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1400;
  }
  return Math.min(4000, Math.max(400, Math.floor(value)));
}

function normalizeOverlapChars(value: number | undefined, maxChars: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.floor(maxChars * 0.15);
  }
  return Math.min(Math.floor(maxChars * 0.4), Math.max(0, Math.floor(value)));
}
