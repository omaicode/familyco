export interface ParsedSkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string | null;
  tags: string[];
}

interface ParseSkillMarkdownInput {
  content: string;
  defaultId: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseSkillMarkdown(input: ParseSkillMarkdownInput): ParsedSkillMetadata {
  const frontmatterMatch = input.content.match(FRONTMATTER_PATTERN);
  const frontmatter = parseFrontmatter(frontmatterMatch?.[1]);
  const body = frontmatterMatch ? input.content.slice(frontmatterMatch[0].length) : input.content;

  const idSource = firstNonEmpty(frontmatter.name, input.defaultId);
  const id = normalizeSkillId(idSource);
  if (!id) {
    throw new Error('SKILL_INVALID_ID:Skill id cannot be empty');
  }

  const headingTitle = extractHeading(body);
  const description = firstNonEmpty(frontmatter.description, extractFirstParagraph(body));
  if (!description) {
    throw new Error('SKILL_INVALID_DESCRIPTION:Skill description is required');
  }

  return {
    id,
    name: firstNonEmpty(frontmatter.title, headingTitle, toTitleFromId(id)),
    description,
    version: frontmatter.version ?? null,
    tags: parseTags(frontmatter.tags)
  };
}

function parseFrontmatter(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  const lines = raw.split(/\r?\n/);
  const output: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const delimiterIndex = trimmed.indexOf(':');
    if (delimiterIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, delimiterIndex).trim();
    const value = trimmed.slice(delimiterIndex + 1).trim();
    output[key] = unquote(value);
  }

  return output;
}

function extractHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) {
    return null;
  }

  return match[1].trim();
}

function extractFirstParagraph(content: string): string | null {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) {
      continue;
    }

    return trimmed;
  }

  return null;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => normalizeTag(item))
      .filter((item) => item.length > 0);
  }

  return trimmed
    .split(',')
    .map((item) => normalizeTag(item))
    .filter((item) => item.length > 0);
}

function normalizeTag(value: string): string {
  return unquote(value.trim()).toLowerCase();
}

function normalizeSkillId(value: string | null): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]+/g, '')
    .replace(/[_\s]+/g, '-');
}

function toTitleFromId(id: string): string {
  return id
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

