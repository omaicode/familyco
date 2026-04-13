import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Converts a project name to a safe directory slug.
 * Cross-platform safe: only lowercase alphanumeric and hyphens.
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
}

/**
 * Creates the project directory under the workspace.
 * Returns the created path, or null if workspacePath is not configured.
 * Silently no-ops if the workspace path is absent or creation fails non-fatally.
 */
export async function ensureProjectWorkspaceDir(
  workspacePath: string | null | undefined,
  projectName: string
): Promise<string | null> {
  if (!workspacePath || workspacePath.trim().length === 0) {
    return null;
  }

  const normalizedWorkspace = path.normalize(workspacePath.trim());
  if (!path.isAbsolute(normalizedWorkspace)) {
    return null;
  }

  const slug = nameToSlug(projectName);
  const projectDir = path.join(normalizedWorkspace, 'projects', slug);

  await mkdir(projectDir, { recursive: true });
  return projectDir;
}
