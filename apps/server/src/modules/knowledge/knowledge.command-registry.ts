import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { SettingsService } from '@familyco/core';

import type { KnowledgeConverterCommandDefinition } from './knowledge.types.js';

export interface KnowledgeConverterRunInput {
  binaryPath: string;
  inputPath: string;
  outputDir: string;
}

export interface KnowledgeConverterRunResult {
  markdownFiles: Array<{ path: string; content: string }>;
  metadata: Record<string, unknown>;
}

export interface KnowledgeConverterCommand {
  readonly id: string;
  readonly description: string;
  run(input: KnowledgeConverterRunInput): Promise<KnowledgeConverterRunResult>;
}

export class DocConvertKnowledgeCommand implements KnowledgeConverterCommand {
  readonly id = 'doc-convert';
  readonly description = 'Run familyco-py doc-convert and extract markdown output files.';

  async run(input: KnowledgeConverterRunInput): Promise<KnowledgeConverterRunResult> {
    const execution = await runProcess(input.binaryPath, [
      'doc-convert',
      input.inputPath,
      '--output-dir',
      input.outputDir
    ]);

    const markdownPaths = await listMarkdownFiles(input.outputDir);
    if (markdownPaths.length === 0) {
      throw new Error(`KNOWLEDGE_CONVERTER_NO_MARKDOWN:${input.outputDir}`);
    }

    const markdownFiles = await Promise.all(
      markdownPaths.map(async (markdownPath) => ({
        path: markdownPath,
        content: await readFile(markdownPath, 'utf8')
      }))
    );

    return {
      markdownFiles,
      metadata: {
        stdout: execution.stdout,
        stderr: execution.stderr,
        fileCount: markdownFiles.length
      }
    };
  }
}

export class KnowledgeCommandRegistry {
  private readonly commands = new Map<string, KnowledgeConverterCommand>();

  register(command: KnowledgeConverterCommand): void {
    this.commands.set(command.id, command);
  }

  get(id: string): KnowledgeConverterCommand | null {
    return this.commands.get(id) ?? null;
  }

  list(): KnowledgeConverterCommandDefinition[] {
    return Array.from(this.commands.values()).map((command) => ({
      id: command.id,
      description: command.description
    }));
  }
}

export function createDefaultKnowledgeCommandRegistry(): KnowledgeCommandRegistry {
  const registry = new KnowledgeCommandRegistry();
  registry.register(new DocConvertKnowledgeCommand());
  return registry;
}

export async function resolveKnowledgeConverterBinaryPath(settingsService: SettingsService): Promise<string> {
  const configured = await settingsService.get('knowledge.converter.binaryPath');
  const configuredPath = typeof configured?.value === 'string' ? configured.value.trim() : '';
  if (configuredPath.length > 0 && existsSync(configuredPath)) {
    return configuredPath;
  }

  const envPath = process.env.FAMILYCO_KNOWLEDGE_BINARY_PATH?.trim();
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const defaultName = process.platform === 'win32' ? 'familyco-py.exe' : 'familyco-py';
  const codebaseRoot = resolveCodebaseRoot();
  const defaultPath = path.join(codebaseRoot, 'bin', defaultName);
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  throw new Error('KNOWLEDGE_CONVERTER_BINARY_MISSING');
}

export async function createKnowledgeTempDir(prefix = 'familyco-knowledge-'): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.once('error', (error) => {
      reject(new Error(`KNOWLEDGE_CONVERTER_FAILED:${error.message}`));
    });

    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`KNOWLEDGE_CONVERTER_FAILED:${stderr.trim() || stdout.trim() || `exit code ${code}`}`));
        return;
      }

      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function listMarkdownFiles(rootPath: string): Promise<string[]> {
  const output: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name.toLowerCase().endsWith('.md') || entry.name.toLowerCase().endsWith('.markdown')) {
        output.push(absolutePath);
      }
    }
  }

  await walk(rootPath);
  return output.sort((left, right) => left.localeCompare(right));
}

const CODEBASE_ROOT_MARKERS = ['pnpm-workspace.yaml', 'turbo.json', '.git'] as const;

function resolveCodebaseRoot(): string {
  const configuredRoot = process.env.FAMILYCO_WORKSPACE_ROOT?.trim();
  if (configuredRoot && path.isAbsolute(configuredRoot) && existsSync(configuredRoot)) {
    return configuredRoot;
  }

  const initCwd = process.env.INIT_CWD?.trim();
  if (initCwd && path.isAbsolute(initCwd) && hasCodebaseMarker(initCwd)) {
    return initCwd;
  }

  const fallbackRoot = path.resolve(process.cwd());
  let currentPath = fallbackRoot;

  while (true) {
    if (hasCodebaseMarker(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return fallbackRoot;
    }

    currentPath = parentPath;
  }
}

function hasCodebaseMarker(directoryPath: string): boolean {
  return CODEBASE_ROOT_MARKERS.some((marker) => existsSync(path.join(directoryPath, marker)));
}
