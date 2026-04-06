import 'dotenv/config';

import { type PrismaClient } from '@prisma/client';

import { createApp, type RepositoryDriver } from './app.js';
import { createPgliteClient } from './db/pglite-client.js';

const DEFAULT_JWT_SECRET = 'local-dev-secret';
const DEFAULT_API_KEY_SALT = 'local-dev-salt';
const DEFAULT_API_KEY = 'local-dev-api-key';

const isBlank = (value: string | undefined): boolean => !value || value.trim().length === 0;

function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredVars = ['JWT_SECRET', 'API_KEY_SALT', 'FAMILYCO_API_KEY'];
  const repositoryDriver = process.env.FAMILYCO_REPOSITORY_DRIVER ?? 'memory';
  const queueDriver = process.env.FAMILYCO_QUEUE_DRIVER ?? 'memory';

  if (repositoryDriver === 'prisma') {
    requiredVars.push('DATABASE_URL');
  }

  if (queueDriver === 'bullmq') {
    requiredVars.push('REDIS_URL');
  }

  const missingVars = requiredVars.filter((name) => isBlank(process.env[name]));

  if (missingVars.length > 0) {
    throw new Error(`Missing required production environment variables: ${missingVars.join(', ')}`);
  }

  if (process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET must not use local development default in production');
  }

  if (process.env.API_KEY_SALT === DEFAULT_API_KEY_SALT) {
    throw new Error('API_KEY_SALT must not use local development default in production');
  }

  if (process.env.FAMILYCO_API_KEY === DEFAULT_API_KEY) {
    throw new Error('FAMILYCO_API_KEY must not use local development default in production');
  }
}

async function start(): Promise<void> {
  validateProductionEnvironment();

  const repositoryDriver = (process.env.FAMILYCO_REPOSITORY_DRIVER ?? 'memory') as RepositoryDriver;
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';

  let prismaClient: PrismaClient | undefined;

  if (repositoryDriver === 'pglite') {
    // PGLITE_DATA_DIR controls where data is persisted:
    //   - unset / empty → in-memory (fast, data lost on restart — good for quick dev runs)
    //   - './dev.pgdata' → file system local directory (persistent dev)
    //   - 'file:///abs/path' → absolute filesystem path (production)
    const rawDataDir = process.env.PGLITE_DATA_DIR;
    const dataDir = rawDataDir?.trim() || undefined;
    prismaClient = await createPgliteClient({ dataDir });
  }

  const app = createApp({ repositoryDriver, prismaClient });

  app
    .listen({ host, port })
    .catch((error: unknown) => {
      app.log.error(error);
      process.exit(1);
    });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

