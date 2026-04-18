import type { TaskPriority, TaskReadinessRule, ToolExecutionResult } from '@familyco/core';
import { normalizeTaskDependencyIds, normalizeTaskReadinessRules } from '@familyco/core';

import type { ServerToolDefinition, ToolDefinitionSummary } from './tool.types.js';

export function invalidArguments(toolName: string, message: string): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    error: {
      code: 'TOOL_INVALID_ARGUMENTS',
      message
    }
  };
}

export function unavailableTool(toolName: string, message: string): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    error: {
      code: 'TOOL_UNAVAILABLE',
      message
    }
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Validates a string value without collapsing internal whitespace.
 * Use this for free-text fields (e.g. comment body, message content)
 * where newlines and formatting must be preserved.
 */
export function asTextString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function asTaskPriority(value: unknown): TaskPriority | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent'
    ? value
    : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value.filter((item): item is string => typeof item === 'string');
    return normalizeTaskDependencyIds(normalized);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const normalized = parsed.filter((item): item is string => typeof item === 'string');
      return normalizeTaskDependencyIds(normalized);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return normalizeTaskDependencyIds(value.split(',').map((entry) => entry.trim()));
}

export function asTaskReadinessRules(value: unknown): TaskReadinessRule[] | undefined {
  const parsed = parseUnknownArray(value);
  if (!parsed) {
    return undefined;
  }

  const rules: TaskReadinessRule[] = [];
  for (const item of parsed) {
    if (!isRecord(item)) {
      return undefined;
    }

    if (item.type !== 'task_status') {
      return undefined;
    }

    const taskId = asNonEmptyString(item.taskId);
    const status = typeof item.status === 'string' ? item.status : undefined;
    if (!taskId || !isTaskStatus(status)) {
      return undefined;
    }

    rules.push({
      type: 'task_status',
      taskId,
      status,
      ...(asTextString(item.description) ? { description: asTextString(item.description) } : {})
    });
  }

  try {
    return normalizeTaskReadinessRules(rules);
  } catch {
    return undefined;
  }
}

export function resolveDotPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

export function extractEntityId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return asNonEmptyString(value.id);
}

export function extractEntityLabel(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return asNonEmptyString(value.title) ?? asNonEmptyString(value.name);
}

export function toToolSummary(tool: ServerToolDefinition): ToolDefinitionSummary {
  const customFields = tool.customFields
    ? Object.fromEntries(
      Object.entries(tool.customFields).map(([key, definition]) => [
        key,
        {
          ...definition,
          ...(definition.options ? { options: [...definition.options] } : {})
        }
      ])
    )
    : undefined;

  return {
    name: tool.name,
    description: tool.description,
    parameters: [...tool.parameters],
    enabledByDefault: tool.enabledByDefault,
    ...(customFields ? { customFields } : {})
  };
}

export function summarizeSlashDescription(description: string, fallback: string): string {
  const normalized = description.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69).trimEnd()}...`;
}

export function parseKeyValueArgs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = input.split(/\s+/).map((part) => part.trim()).filter((part) => part.length > 0);

  for (const part of parts) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0 || separatorIndex === part.length - 1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key.length > 0 && value.length > 0) {
      result[key] = value;
    }
  }

  return result;
}

function parseUnknownArray(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isTaskStatus(value: unknown): value is 'pending' | 'in_progress' | 'review' | 'done' | 'blocked' | 'cancelled' {
  return (
    value === 'pending'
    || value === 'in_progress'
    || value === 'review'
    || value === 'done'
    || value === 'blocked'
    || value === 'cancelled'
  );
}
