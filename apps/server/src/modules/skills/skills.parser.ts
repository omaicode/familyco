export interface ParsedSkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string | null;
  tags: string[];
  defaultEnabled: boolean;
  applyTo: string[];
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
  const metadata = asRecord(frontmatter.metadata);

  const idSource = firstNonEmpty(asString(frontmatter.name), input.defaultId);
  const id = normalizeSkillId(idSource);
  if (!id) {
    throw new Error('SKILL_INVALID_ID:Skill id cannot be empty');
  }

  const headingTitle = extractHeading(body);
  const description = firstNonEmpty(asString(frontmatter.description), extractFirstParagraph(body));
  if (!description) {
    throw new Error('SKILL_INVALID_DESCRIPTION:Skill description is required');
  }

  return {
    id,
    name: firstNonEmpty(asString(frontmatter.title), headingTitle, toTitleFromId(id)),
    description,
    version: asString(metadata.version) ?? null,
    tags: parseTags(metadata.tags),
    defaultEnabled: asBoolean(metadata.default) ?? asBoolean(metadata.is_default) ?? false,
    applyTo: parseApplyTo(metadata.apply_to)
  };
}

interface FrontmatterObject {
  [key: string]: FrontmatterValue;
}

type FrontmatterValue = string | boolean | string[] | FrontmatterObject;

function parseFrontmatter(raw: string | undefined): FrontmatterObject {
  if (!raw) {
    return {};
  }

  const lines = raw.split(/\r?\n/);
  const output: FrontmatterObject = {};
  let currentObjectKey: string | null = null;

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
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

    if (indent === 0) {
      if (!value) {
        output[key] = {};
        currentObjectKey = key;
        continue;
      }

      output[key] = parseScalarValue(value);
      currentObjectKey = null;
      continue;
    }

    if (!currentObjectKey) {
      continue;
    }

    const parent = asRecord(output[currentObjectKey]);
    parent[key] = parseScalarValue(value);
    output[currentObjectKey] = parent;
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

function parseTags(raw: FrontmatterValue | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeTag(String(item)))
      .filter((item) => item.length > 0);
  }

  if (typeof raw !== 'string') {
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

function parseApplyTo(raw: FrontmatterValue | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }

  if (typeof raw !== 'string') {
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
      .map((item) => unquote(item.trim()))
      .filter((item) => item.length > 0);
  }

  return [unquote(trimmed)].filter((item) => item.length > 0);
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

function parseScalarValue(value: string): FrontmatterValue {
  const trimmed = value.trim();
  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter((item) => item.length > 0);
  }

  return unquote(trimmed);
}

function asString(value: FrontmatterValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: FrontmatterValue | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asRecord(value: FrontmatterValue | undefined): FrontmatterObject {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value;
  }

  return {};
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}
