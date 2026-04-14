import type { ApprovalMode } from '@familyco/core';
import type { PluginCapabilityDescriptor, PluginManifest } from '@familyco/core';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ParsePluginMarkdownInput {
  content: string;
  defaultId: string;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const VALID_CAPABILITY_KINDS = new Set(['tool', 'skill', 'model-provider', 'web-fetch', 'web-search']);
const VALID_APPROVAL_MODES = new Set<string>(['auto', 'suggest_only', 'require_review']);

export function parsePluginMarkdown(input: ParsePluginMarkdownInput): PluginManifest {
  const frontmatterMatch = input.content.match(FRONTMATTER_PATTERN);
  const frontmatter = parseFrontmatter(frontmatterMatch?.[1]);
  const body = frontmatterMatch ? input.content.slice(frontmatterMatch[0].length) : input.content;
  const metadata = asRecord(frontmatter.metadata);

  const id = normalizePluginId(asString(frontmatter.name) ?? input.defaultId);
  if (!id) {
    throw new Error('PLUGIN_INVALID_ID:Plugin id cannot be empty');
  }

  const description = asString(frontmatter.description) ?? extractFirstParagraph(body);
  if (!description) {
    throw new Error('PLUGIN_INVALID_DESCRIPTION:Plugin description is required');
  }

  const version = asString(metadata.version) ?? '0.0.0';
  const author = asString(metadata.author) ?? undefined;
  const entry = asString(frontmatter.entry) ?? 'index.ts';
  const tags = parseTags(metadata.tags);

  const rawApproval = asString(metadata.approval_mode) ?? asString(metadata.approvalMode) ?? 'require_review';
  const defaultApprovalMode: ApprovalMode = VALID_APPROVAL_MODES.has(rawApproval)
    ? (rawApproval as ApprovalMode)
    : 'require_review';

  const headingTitle = extractHeading(body);
  const name = asString(frontmatter.title) ?? headingTitle ?? toTitleFromId(id);

  const capabilities = parseCapabilities(frontmatter.capabilities);

  return {
    id,
    name,
    description,
    version,
    author,
    tags,
    entry,
    capabilities,
    defaultApprovalMode
  };
}

// ---------------------------------------------------------------------------
// Frontmatter helpers (mirrors skills.parser pattern)
// ---------------------------------------------------------------------------

interface FrontmatterObject {
  [key: string]: FrontmatterValue;
}

type FrontmatterValue = string | boolean | FrontmatterValue[] | FrontmatterObject;

function parseFrontmatter(raw: string | undefined): FrontmatterObject {
  if (!raw) return {};

  const lines = raw.split(/\r?\n/);
  const output: FrontmatterObject = {};
  let currentKey: string | null = null;
  let currentArray: FrontmatterValue[] | null = null;

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item (  - value)
    if (trimmed.startsWith('- ') && currentKey && indent > 0) {
      const itemValue = trimmed.slice(2).trim();
      if (!currentArray) {
        currentArray = [];
        output[currentKey] = currentArray;
      }
      // Could be an inline object: - kind: tool, or just a scalar
      if (itemValue.includes(':')) {
        const obj: FrontmatterObject = {};
        for (const pair of itemValue.split(',')) {
          const ci = pair.indexOf(':');
          if (ci < 1) continue;
          obj[pair.slice(0, ci).trim()] = parseScalar(pair.slice(ci + 1).trim());
        }
        currentArray.push(obj);
      } else {
        currentArray.push(parseScalar(itemValue));
      }
      continue;
    }

    const delimiterIndex = trimmed.indexOf(':');
    if (delimiterIndex < 1) continue;

    const key = trimmed.slice(0, delimiterIndex).trim();
    const value = trimmed.slice(delimiterIndex + 1).trim();

    if (indent === 0) {
      currentArray = null;
      if (!value) {
        output[key] = {};
        currentKey = key;
        continue;
      }
      output[key] = parseScalar(value);
      currentKey = key;
      continue;
    }

    if (currentKey) {
      currentArray = null;
      const parent = asRecord(output[currentKey]);
      if (!value) {
        parent[key] = {};
        currentKey = key;
        output[currentKey] = parent;
        continue;
      }
      parent[key] = parseScalar(value);
      output[currentKey] = parent;
    }
  }

  return output;
}

function parseScalar(value: string): string | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return unquote(value);
}

function unquote(value: string): string {
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  return value;
}

function asString(value: FrontmatterValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: FrontmatterValue | undefined): FrontmatterObject {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as FrontmatterObject;
  }
  return {};
}

function parseTags(raw: FrontmatterValue | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((i) => (typeof i === 'string' ? i.trim().toLowerCase() : ''))
      .filter((i) => i.length > 0);
  }
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map((i) => unquote(i.trim()).toLowerCase()).filter((i) => i.length > 0);
  }
  return trimmed.split(',').map((i) => unquote(i.trim()).toLowerCase()).filter((i) => i.length > 0);
}

function parseCapabilities(raw: FrontmatterValue | undefined): PluginCapabilityDescriptor[] {
  if (!Array.isArray(raw)) return [];

  const result: PluginCapabilityDescriptor[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const obj = item as FrontmatterObject;
    const kind = asString(obj.kind);
    if (!kind || !VALID_CAPABILITY_KINDS.has(kind)) continue;

    const name = asString(obj.name) ?? '';
    const description = asString(obj.description) ?? '';

    if (kind === 'model-provider') {
      const adapterId = asString(obj.adapterId) ?? asString(obj.adapter_id) ?? name;
      result.push({ kind, adapterId, name, description } as PluginCapabilityDescriptor);
    } else {
      result.push({ kind, name, description } as PluginCapabilityDescriptor);
    }
  }
  return result;
}

function extractHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractFirstParagraph(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    return trimmed;
  }
  return null;
}

function normalizePluginId(value: string | null): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[^a-z0-9-_ ]+/g, '').replace(/[_\s]+/g, '-');
}

function toTitleFromId(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
