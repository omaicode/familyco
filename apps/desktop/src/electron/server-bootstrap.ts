import { createApp, createPgliteClient } from '@familyco/server';

export interface EmbeddedServerRuntime {
  baseUrl: string;
  close: () => Promise<void>;
}

export interface EmbeddedServerBootstrapOptions {
  host?: string;
  port?: number;
  authApiKey?: string;
  /**
   * Absolute path to the directory where PGlite will store its data.
   * Example: app.getPath('userData') + '/pgdata'
   * If omitted, PGlite runs in-memory (data lost on restart).
   */
  dataDir?: string;
}

export const startEmbeddedServer = async (
  options: EmbeddedServerBootstrapOptions = {}
): Promise<EmbeddedServerRuntime> => {
  const host = options.host ?? process.env.DESKTOP_SERVER_HOST ?? '127.0.0.1';
  const port = Number(options.port ?? process.env.DESKTOP_SERVER_PORT ?? 3040);

  // Resolve PGlite data directory.
  // Use 'file://' prefix so PGlite knows to persist to disk.
  const rawDataDir = options.dataDir ?? process.env.PGLITE_DATA_DIR;
  const dataDir = rawDataDir
    ? rawDataDir.startsWith('file://') ? rawDataDir : `file://${rawDataDir}`
    : undefined;

  const prismaClient = await createPgliteClient({ dataDir });

  const app = createApp({
    logger: true,
    repositoryDriver: 'pglite',
    queueDriver: (process.env.FAMILYCO_QUEUE_DRIVER as 'memory' | 'bullmq' | undefined) ?? 'memory',
    authApiKey: options.authApiKey,
    prismaClient
  });

  await app.listen({ host, port });

  return {
    baseUrl: `http://${host}:${port}`,
    close: () => app.close()
  };
};
