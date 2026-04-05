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

export const startEmbeddedServer = async (
  options: EmbeddedServerBootstrapOptions = {}
): Promise<EmbeddedServerRuntime> => {
  const host = options.host ?? process.env.DESKTOP_SERVER_HOST ?? '127.0.0.1';
  const port = Number(options.port ?? process.env.DESKTOP_SERVER_PORT ?? 4000);

  const app = createApp({
    logger: true,
    repositoryDriver: (process.env.FAMILYCO_REPOSITORY_DRIVER as 'memory' | 'prisma' | undefined) ??
      'memory',
    queueDriver: (process.env.FAMILYCO_QUEUE_DRIVER as 'memory' | 'bullmq' | undefined) ?? 'memory',
    authApiKey: options.authApiKey
  });

  await app.listen({ host, port });

  return {
    baseUrl: `http://${host}:${port}`,
    close: () => app.close()
  };
};
