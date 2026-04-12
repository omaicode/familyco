import { PrismaClient } from './generated/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:../../prisma/dev.db',
});

export const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient;
}
