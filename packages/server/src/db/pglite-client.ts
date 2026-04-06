import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';

export interface PgliteClientOptions {
  /**
   * Storage location for PGlite:
   *  - undefined              → in-memory (data lost on restart, fast for dev/test)
   *  - 'file:///abs/path'     → filesystem (Node.js / Electron, persistent)
   *  - 'idb://database-name'  → IndexedDB  (browser-only, for future renderer mode)
   */
  dataDir?: string;
}

let _client: PrismaClient | null = null;

/**
 * Create (or return the cached) PrismaClient backed by an embedded PGlite instance.
 * Always call this before createApp() when using the 'pglite' repository driver.
 */
export async function createPgliteClient(options: PgliteClientOptions = {}): Promise<PrismaClient> {
  if (_client) return _client;

  const db = new PGlite(options.dataDir);
  await ensureSchema(db);

  const adapter = new PrismaPGlite(db);

  // pglite-prisma-adapter@0.6.x and @prisma/client@6.19.x resolve
  // @prisma/driver-adapter-utils from different node_modules paths, causing a
  // phantom structural incompatibility at the type level. Runtime interface is identical.
  _client = new PrismaClient(
    { adapter } as unknown as ConstructorParameters<typeof PrismaClient>[0]
  );

  return _client;
}

/** Reset the cached client (needed for tests). */
export function resetPgliteClientCache(): void {
  _client = null;
}

// ── Schema bootstrap ──────────────────────────────────────────────────────────

async function ensureSchema(db: PGlite): Promise<void> {
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'Agent'
     ) AS exists`
  );
  if (!rows[0]?.exists) {
    await db.exec(INITIAL_SCHEMA_SQL);
  }
}

/**
 * PostgreSQL DDL for the full FamilyCo schema.
 * This is the canonical source of truth for embedded PGlite.
 * When adding new models/fields, update this SQL and bump the version comment.
 *
 * Schema version: 2  (matches prisma/schema.prisma post-SQLite migration)
 */
const INITIAL_SCHEMA_SQL = /* sql */ `
CREATE TABLE "Agent" (
  "id"            TEXT          NOT NULL,
  "name"          TEXT          NOT NULL,
  "role"          TEXT          NOT NULL,
  "level"         TEXT          NOT NULL,
  "department"    TEXT          NOT NULL,
  "status"        TEXT          NOT NULL,
  "parentAgentId" TEXT,
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id"              TEXT          NOT NULL,
  "name"            TEXT          NOT NULL,
  "description"     TEXT          NOT NULL,
  "ownerAgentId"    TEXT          NOT NULL,
  "parentProjectId" TEXT,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id"              TEXT          NOT NULL,
  "title"           TEXT          NOT NULL,
  "description"     TEXT          NOT NULL,
  "status"          TEXT          NOT NULL,
  "projectId"       TEXT          NOT NULL,
  "assigneeAgentId" TEXT,
  "createdBy"       TEXT          NOT NULL,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
  "id"        TEXT          NOT NULL,
  "actorId"   TEXT          NOT NULL,
  "action"    TEXT          NOT NULL,
  "targetId"  TEXT,
  "status"    TEXT          NOT NULL,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- AuditLog intentionally has no FK on actorId to allow system actor entries.
CREATE TABLE "AuditLog" (
  "id"        TEXT          NOT NULL,
  "actorId"   TEXT          NOT NULL,
  "action"    TEXT          NOT NULL,
  "targetId"  TEXT,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settings" (
  "id"        TEXT          NOT NULL,
  "key"       TEXT          NOT NULL,
  "value"     JSONB         NOT NULL,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
  "id"        TEXT          NOT NULL,
  "name"      TEXT          NOT NULL,
  "keyHash"   TEXT          NOT NULL,
  "active"    BOOLEAN       NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- Foreign key constraints
ALTER TABLE "Agent"
  ADD CONSTRAINT "Agent_parentAgentId_fkey"
  FOREIGN KEY ("parentAgentId") REFERENCES "Agent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_ownerAgentId_fkey"
  FOREIGN KEY ("ownerAgentId") REFERENCES "Agent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_parentProjectId_fkey"
  FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_assigneeAgentId_fkey"
  FOREIGN KEY ("assigneeAgentId") REFERENCES "Agent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "Agent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Agent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unique indexes
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
`;
