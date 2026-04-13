import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

export interface MigrationRunResult {
  status: 'ok' | 'degraded';
  dbPath: string;
  readOnlyMode: boolean;
  pendingCount: number;
  appliedCount: number;
  backupPath?: string;
  errorMessage?: string;
}

interface MigrationFile {
  name: string;
  sqlPath: string;
  sql: string;
  checksum: string;
}

const MIGRATION_TABLE = '_prisma_migrations';

export async function runMigrationsWithSafety(): Promise<MigrationRunResult> {
  const dbPath = resolveDatabasePath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const migrationFiles = await loadMigrationFiles();
  if (migrationFiles.length === 0) {
    return {
      status: 'ok',
      dbPath,
      readOnlyMode: false,
      pendingCount: 0,
      appliedCount: 0
    };
  }

  const lockPath = `${dbPath}.migrate.lock`;
  const lockHandle = await acquireLock(lockPath);

  try {
    const dbExists = await fileExists(dbPath);
    const db = new Database(dbPath);
    let backupPath: string | undefined;
    let pendingCount = 0;
    let dbClosed = false;
    const closeDb = (): void => {
      if (dbClosed) {
        return;
      }

      try {
        db.close();
      } finally {
        dbClosed = true;
      }
    };

    try {
      ensureMigrationTable(db);
      const applied = new Set<string>(
        db
          .prepare(
            `SELECT migration_name FROM ${MIGRATION_TABLE}
             WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
          )
          .pluck()
          .all() as string[]
      );

      const pending = migrationFiles.filter((item) => !applied.has(item.name));
      pendingCount = pending.length;
      if (pending.length === 0) {
        return {
          status: 'ok',
          dbPath,
          readOnlyMode: false,
          pendingCount: 0,
          appliedCount: 0
        };
      }

      backupPath = dbExists ? await createBackup(dbPath) : undefined;

      let appliedCount = 0;
      for (const migration of pending) {
        applyMigration(db, migration);
        appliedCount += 1;
      }

      if (backupPath) {
        await deleteBackup(backupPath);
      }

      await cleanupOldBackups(dbPath);

      return {
        status: 'ok',
        dbPath,
        readOnlyMode: false,
        pendingCount: pending.length,
        appliedCount
      };
    } catch (error) {
      closeDb();
      const errorDetail = error instanceof Error ? error.message : String(error);

      if (backupPath) {
        try {
          await restoreBackup(backupPath, dbPath);

          return {
            status: 'degraded',
            dbPath,
            readOnlyMode: true,
            pendingCount,
            appliedCount: 0,
            backupPath,
            errorMessage: `Migration failed and database was restored from backup: ${backupPath}. Root cause: ${errorDetail}`
          };
        } catch (restoreError) {
          const restoreDetail = restoreError instanceof Error ? restoreError.message : String(restoreError);

          return {
            status: 'degraded',
            dbPath,
            readOnlyMode: true,
            pendingCount,
            appliedCount: 0,
            backupPath,
            errorMessage: `Migration failed and backup restore also failed. Migration error: ${errorDetail}. Restore error: ${restoreDetail}`
          };
        }

      }

      return {
        status: 'degraded',
        dbPath,
        readOnlyMode: true,
        pendingCount,
        appliedCount: 0,
        errorMessage: `Migration failed before backup restoration: ${errorDetail}`
      };
    } finally {
      closeDb();
    }
  } finally {
    await releaseLock(lockHandle, lockPath);
  }
}

function applyMigration(db: Database.Database, migration: MigrationFile): void {
  const migrationId = randomUUID();

  db.prepare(
    `INSERT INTO ${MIGRATION_TABLE}
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES
      (?, ?, NULL, ?, NULL, NULL, CURRENT_TIMESTAMP, 0)`
  ).run(migrationId, migration.checksum, migration.name);

  try {
    db.exec('BEGIN');
    db.exec(migration.sql);
    db.prepare(
      `UPDATE ${MIGRATION_TABLE}
       SET finished_at = CURRENT_TIMESTAMP,
           applied_steps_count = 1
       WHERE id = ?`
    ).run(migrationId);
    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors and keep original error.
    }

    db.prepare(`UPDATE ${MIGRATION_TABLE} SET logs = ? WHERE id = ?`).run(
      error instanceof Error ? error.message : String(error),
      migrationId
    );
    throw error;
  }
}

function ensureMigrationTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      finished_at DATETIME,
      migration_name TEXT NOT NULL,
      logs TEXT,
      rolled_back_at DATETIME,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function loadMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = await resolveMigrationsPath();
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  const files: MigrationFile[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const name = entry.name;
    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    if (!(await fileExists(sqlPath))) {
      continue;
    }

    const sql = await fs.readFile(sqlPath, 'utf8');
    files.push({
      name,
      sqlPath,
      sql,
      checksum: hash(sql)
    });
  }

  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

async function resolveMigrationsPath(): Promise<string> {
  const candidates = [
    process.env.FAMILYCO_MIGRATIONS_PATH,
    path.resolve(process.cwd(), 'prisma/migrations'),
    path.resolve(process.cwd(), '../../prisma/migrations'),
    path.resolve(process.cwd(), '../../packages/db/prisma/migrations'),
    path.resolve((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? '', 'prisma/migrations')
  ];
  const filtered = candidates.filter((value): value is string => Boolean(value && value.length > 0));
  for (const candidate of filtered) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate prisma migrations directory for runtime migration execution');
}

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_URL ?? 'file:../../prisma/dev.db';

  if (raw.startsWith('file://')) {
    const urlPath = decodeURIComponent(new URL(raw).pathname);
    if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(urlPath)) {
      return urlPath.slice(1);
    }

    return urlPath;
  }

  if (raw.startsWith('file:')) {
    return path.resolve(process.cwd(), raw.slice('file:'.length));
  }

  throw new Error(`Unsupported DATABASE_URL protocol for desktop runtime: ${raw}`);
}

async function createBackup(dbPath: string): Promise<string> {
  const backupsDir = path.join(path.dirname(dbPath), 'backups');
  await fs.mkdir(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `${path.basename(dbPath)}.${timestamp}.bak`);
  await fs.copyFile(dbPath, backupPath);
  return backupPath;
}

async function deleteBackup(backupPath: string): Promise<void> {
  await fs.unlink(backupPath).catch(() => undefined);
}

async function restoreBackup(backupPath: string, dbPath: string): Promise<void> {
  await fs.copyFile(backupPath, dbPath);
}

async function cleanupOldBackups(dbPath: string): Promise<void> {
  const backupsDir = path.join(path.dirname(dbPath), 'backups');
  if (!(await fileExists(backupsDir))) {
    return;
  }

  const files = await fs.readdir(backupsDir, { withFileTypes: true });
  const backupFiles = files
    .filter((entry) => entry.isFile() && entry.name.startsWith(path.basename(dbPath)) && entry.name.endsWith('.bak'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const toDelete = backupFiles.slice(3);
  await Promise.all(toDelete.map(async (file) => fs.unlink(path.join(backupsDir, file))));
}

async function acquireLock(lockPath: string): Promise<fs.FileHandle> {
  try {
    return await fs.open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }

    const stats = await fs.stat(lockPath);
    const staleThresholdMs = 5 * 60 * 1000;
    if (Date.now() - stats.mtimeMs > staleThresholdMs) {
      await fs.unlink(lockPath);
      return fs.open(lockPath, 'wx');
    }

    throw new Error('Database migration lock is active; another process may be upgrading the database');
  }
}

async function releaseLock(handle: fs.FileHandle, lockPath: string): Promise<void> {
  await handle.close();
  await fs.unlink(lockPath).catch(() => undefined);
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
