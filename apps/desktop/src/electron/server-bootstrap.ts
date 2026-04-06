import { createApp } from '@familyco/server';

export interface EmbeddedServerRuntime {
  baseUrl: string;
  close: () => Promise<void>;
}

export interface EmbeddedServerBootstrapOptions {
  host?: string;
  port?: number;
  authApiKey?: string;
}

/**
 * Starts the embedded Fastify server for Electron Desktop.
 *
 * IMPORTANT: Before calling this function, `process.env.DATABASE_URL` MUST be
 * set to the SQLite file path (e.g. `file:///abs/path/familyco.db`).
 * This is handled by `main.ts` via a dynamic import to guarantee ordering.
 */
export const startEmbeddedServer = async (
  options: EmbeddedServerBootstrapOptions = {}
): Promise<EmbeddedServerRuntime> => {
  const host = options.host ?? process.env.DESKTOP_SERVER_HOST ?? '127.0.0.1';
  const port = Number(options.port ?? process.env.DESKTOP_SERVER_PORT ?? 3040);

  const app = createApp({
    logger: true,
    repositoryDriver: 'prisma',
    queueDriver: (process.env.FAMILYCO_QUEUE_DRIVER as 'memory' | 'bullmq' | undefined) ?? 'memory',
    authApiKey: options.authApiKey
  });

  await app.listen({ host, port });

  return {
    baseUrl: `http://${host}:${port}`,
    close: () => app.close()
  };
};
