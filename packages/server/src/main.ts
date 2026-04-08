import 'dotenv/config';

import { createApp, type RepositoryDriver } from './app.js';

const DEFAULT_JWT_SECRET = 'local-dev-secret';
const DEFAULT_API_KEY_SALT = 'local-dev-salt';
const DEFAULT_API_KEY = 'local-dev-api-key';

const isBlank = (value: string | undefined): boolean => !value || value.trim().length === 0;

function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredVars = ['JWT_SECRET', 'API_KEY_SALT', 'FAMILYCO_API_KEY'];
  const repositoryDriver = process.env.FAMILYCO_REPOSITORY_DRIVER ?? 'prisma';

  if (repositoryDriver === 'prisma') {
    requiredVars.push('DATABASE_URL');
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

  const repositoryDriver = (process.env.FAMILYCO_REPOSITORY_DRIVER ?? 'prisma') as RepositoryDriver;
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';

  const app = createApp({ repositoryDriver });

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

