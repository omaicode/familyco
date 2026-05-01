import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface KnowledgeBinaryStatus {
  installed: boolean;
  path: string;
  platform: string;
  downloadUrl: string;
}

export interface KnowledgeBinaryDownloadResult {
  accepted: boolean;
  installed: boolean;
  path?: string;
  message?: string;
}

export interface KnowledgeBinaryRuntime {
  getStatus: () => Promise<KnowledgeBinaryStatus>;
  downloadBinary: () => Promise<KnowledgeBinaryDownloadResult>;
}

export interface CreateKnowledgeBinaryRuntimeOptions {
  userDataPath: string;
}

export function createKnowledgeBinaryRuntime(options: CreateKnowledgeBinaryRuntimeOptions): KnowledgeBinaryRuntime {
  const binaryPath = resolveBinaryPath(options.userDataPath, process.platform);
  const downloadUrl = resolveBinaryDownloadUrl(process.platform);

  const getStatus = async (): Promise<KnowledgeBinaryStatus> => ({
    installed: await canAccess(binaryPath),
    path: binaryPath,
    platform: process.platform,
    downloadUrl
  });

  const downloadBinary = async (): Promise<KnowledgeBinaryDownloadResult> => {
    try {
      const status = await getStatus();
      if (status.installed) {
        return {
          accepted: true,
          installed: true,
          path: binaryPath
        };
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        throw new Error('EMPTY_BINARY_PAYLOAD');
      }

      await mkdir(path.dirname(binaryPath), { recursive: true });
      await writeFile(binaryPath, bytes, { mode: 0o755 });

      if (process.platform !== 'win32') {
        await chmod(binaryPath, 0o755);
      }

      return {
        accepted: true,
        installed: true,
        path: binaryPath
      };
    } catch (error) {
      return {
        accepted: false,
        installed: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  };

  return {
    getStatus,
    downloadBinary
  };
}

function resolveBinaryPath(userDataPath: string, platform: NodeJS.Platform): string {
  const fileName = platform === 'win32' ? 'familyco-py.exe' : 'familyco-py';
  return path.join(userDataPath, 'bin', fileName);
}

function resolveBinaryDownloadUrl(platform: NodeJS.Platform): string {
  switch (platform) {
    case 'linux':
      return 'https://github.com/omaicode/familyco-py/releases/latest/download/familyco-py-linux-x64';
    case 'darwin':
      return 'https://github.com/omaicode/familyco-py/releases/latest/download/familyco-py-macos-x64';
    case 'win32':
      return 'https://github.com/omaicode/familyco-py/releases/latest/download/familyco-py-windows-x64.exe';
    default:
      throw new Error(`KNOWLEDGE_PLATFORM_UNSUPPORTED:${platform}`);
  }
}

async function canAccess(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}
