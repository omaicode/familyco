import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { ToolExecutionResult } from '@familyco/core';
import { invalidArguments } from './tool.helpers.js';

const MAX_READ_BYTES = 256 * 1024;
const MAX_SEARCH_BYTES = 128 * 1024;
const DEFAULT_MAX_RESULTS = 10;
const MAX_MAX_RESULTS = 25;
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.turbo']);
const WORKSPACE_ROOT_MARKERS = ['pnpm-workspace.yaml', 'turbo.json', '.git'] as const;

export interface ResolvedWorkspacePath {
  path: string;
  relativePath: string;
}

export async function resolveWorkspacePath(candidate: unknown, toolName: string): Promise<ResolvedWorkspacePath | ToolExecutionResult> {
  const input = typeof candidate === 'string' ? candidate.trim() : '';
  if (!input) {
    return invalidArguments(toolName, `${toolName} expects a non-empty path`);
  }

  const workspaceRoot = await resolveWorkspaceRoot();
  const resolvedPath = path.resolve(workspaceRoot, input);
  const relativePath = path.relative(workspaceRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return invalidArguments(toolName, `${toolName} only allows paths inside the current workspace`);
  }

  return {
    path: resolvedPath,
    relativePath: normalizePath(relativePath || path.basename(resolvedPath))
  };
}

export async function readTextFile(filePath: string, maxBytes: number = MAX_READ_BYTES): Promise<string> {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error('FILE_NOT_REGULAR');
  }

  if (info.size > maxBytes) {
    throw new Error(`FILE_TOO_LARGE:${info.size}:${maxBytes}`);
  }

  const raw = await readFile(filePath);
  if (raw.includes(0)) {
    throw new Error('FILE_BINARY_UNSUPPORTED');
  }

  return raw.toString('utf8');
}

export async function searchWorkspaceFiles(input: {
  query: string;
  directoryPath: string;
  maxResults?: number;
}): Promise<Array<{ path: string; snippet?: string }>> {
  const query = input.query.trim().toLowerCase();
  const maxResults = normalizeMaxResults(input.maxResults);
  const results: Array<{ path: string; snippet?: string }> = [];
  const workspaceRoot = await resolveWorkspaceRoot();

  async function visitDirectory(currentPath: string): Promise<void> {
    if (results.length >= maxResults) {
      return;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxResults) {
        return;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await visitDirectory(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = normalizePath(path.relative(workspaceRoot, entryPath));
      const nameMatch = entry.name.toLowerCase().includes(query);
      const contentMatch = await readSearchSnippet(entryPath, query);
      if (!nameMatch && !contentMatch) {
        continue;
      }

      results.push({
        path: relativePath,
        snippet: contentMatch ?? undefined
      });
    }
  }

  await visitDirectory(input.directoryPath);
  return results;
}

async function readSearchSnippet(filePath: string, query: string): Promise<string | null> {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > MAX_SEARCH_BYTES) {
      return null;
    }

    const raw = await readFile(filePath);
    if (raw.includes(0)) {
      return null;
    }

    const text = raw.toString('utf8');
    const matchIndex = text.toLowerCase().indexOf(query);
    if (matchIndex < 0) {
      return null;
    }

    const start = Math.max(matchIndex - 80, 0);
    const end = Math.min(matchIndex + query.length + 80, text.length);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = typeof error.code === 'string' ? error.code : '';
      if (code === 'ENOENT' || code === 'EPERM' || code === 'EACCES') {
        return null;
      }
    }

    throw error;
  }
}

function normalizeMaxResults(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_RESULTS;
  }

  const normalized = Math.trunc(value);
  if (normalized <= 0) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(normalized, MAX_MAX_RESULTS);
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

async function resolveWorkspaceRoot(): Promise<string> {
  const configuredRoot = typeof process.env.FAMILYCO_WORKSPACE_ROOT === 'string'
    ? process.env.FAMILYCO_WORKSPACE_ROOT.trim()
    : '';

  if (configuredRoot.length > 0) {
    return path.resolve(configuredRoot);
  }

  const fallbackRoot = path.resolve(process.cwd());
  let currentPath = fallbackRoot;

  while (true) {
    if (await hasWorkspaceMarker(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return fallbackRoot;
    }

    currentPath = parentPath;
  }
}

async function hasWorkspaceMarker(directoryPath: string): Promise<boolean> {
  for (const marker of WORKSPACE_ROOT_MARKERS) {
    if (await pathExists(path.join(directoryPath, marker))) {
      return true;
    }
  }

  return false;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = typeof error.code === 'string' ? error.code : '';
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return false;
      }
    }

    throw error;
  }
}
