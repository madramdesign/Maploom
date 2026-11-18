import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './env';

/**
 * Minimal database port: parameterised SQL in, rows out. Two adapters:
 *   - Postgres (`pg`) when DATABASE_URL is set  → production
 *   - PGlite (Postgres compiled to WASM, embedded) otherwise → zero-setup dev & tests
 * Both speak the same SQL dialect, so there is exactly one schema.
 * All statements MUST use $1-style parameters; never interpolate values.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id            TEXT PRIMARY KEY,
     email         TEXT UNIQUE,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS projects (
     id            TEXT PRIMARY KEY,
     owner_hash    TEXT NOT NULL,
     user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
     name          TEXT NOT NULL,
     status        TEXT NOT NULL DEFAULT 'draft',
     style_id      TEXT NOT NULL,
     product_id    TEXT NOT NULL,
     variant_id    TEXT NOT NULL,
     location_enc  TEXT NOT NULL,
     geography_key TEXT,
     version       INTEGER NOT NULL DEFAULT 1,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner_hash, updated_at DESC);
   CREATE TABLE IF NOT EXISTS design_versions (
     id            TEXT PRIMARY KEY,
     project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     version       INTEGER NOT NULL,
     design_enc    TEXT NOT NULL,
     note          TEXT,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (project_id, version)
   );
   CREATE TABLE IF NOT EXISTS jobs (
     id            TEXT PRIMARY KEY,
     type          TEXT NOT NULL,
     status        TEXT NOT NULL DEFAULT 'queued',
     owner_hash    TEXT,
     input_enc     TEXT NOT NULL,
     result        JSONB,
     error_code    TEXT,
     error_detail  TEXT,
     progress      REAL NOT NULL DEFAULT 0,
     stage         TEXT,
     attempts      INTEGER NOT NULL DEFAULT 0,
     max_attempts  INTEGER NOT NULL DEFAULT 3,
     run_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     started_at    TIMESTAMPTZ,
     finished_at   TIMESTAMPTZ
   );
   CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, run_after);
   CREATE TABLE IF NOT EXISTS exports (
     id            TEXT PRIMARY KEY,
     job_id        TEXT REFERENCES jobs(id) ON DELETE SET NULL,
     project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
     owner_hash    TEXT,
     preset        TEXT NOT NULL,
     format        TEXT NOT NULL,
     width         INTEGER NOT NULL,
     height        INTEGER NOT NULL,
     bytes         BIGINT NOT NULL,
     file_key      TEXT NOT NULL,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at    TIMESTAMPTZ NOT NULL
   );
   CREATE TABLE IF NOT EXISTS orders (
     id                TEXT PRIMARY KEY,
     project_id        TEXT REFERENCES projects(id) ON DELETE SET NULL,
     design_version    INTEGER,
     owner_hash        TEXT NOT NULL,
     status            TEXT NOT NULL DEFAULT 'pending_payment',
     product_id        TEXT NOT NULL,
     variant_id        TEXT NOT NULL,
     quantity          INTEGER NOT NULL DEFAULT 1,
     currency          TEXT NOT NULL,
     total_cents       INTEGER NOT NULL,
     payment_provider  TEXT,
     payment_ref       TEXT,
     print_provider    TEXT,
     print_ref         TEXT,
     created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS order_events (
     id            TEXT PRIMARY KEY,
     order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     type          TEXT NOT NULL,
     data          JSONB,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS api_usage (
     day           DATE NOT NULL,
     provider      TEXT NOT NULL,
     calls         INTEGER NOT NULL DEFAULT 0,
     errors        INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (day, provider)
   );`,
];

export async function migrate(db: Db): Promise<void> {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const rows = await db.query<{ version: number }>('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((r) => Number(r.version)));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    if (applied.has(i + 1)) continue;
    for (const stmt of MIGRATIONS[i].split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
    await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [i + 1]);
  }
}

export async function openPglite(dir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  // PGlite is single-connection: serialise so interleaved awaits cannot overlap.
  let chain: Promise<unknown> = Promise.resolve();
  return {
    query<T>(sql: string, params: unknown[] = []) {
      const run = () => pg.query<T>(sql, params as never[]).then((r) => r.rows);
      const p = chain.then(run, run);
      chain = p.catch(() => undefined);
      return p;
    },
    close: () => pg.close(),
  };
}

export async function openPostgres(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params as never[]);
      return res.rows as T[];
    },
    close: () => pool.end(),
  };
}

const g = globalThis as unknown as { __maploomDb?: Promise<Db> };

/** Process-wide database handle (survives Next.js dev hot reloads). */
export function getDb(): Promise<Db> {
  if (!g.__maploomDb) {
    g.__maploomDb = (async () => {
      const e = env();
      const db = e.DATABASE_URL ? await openPostgres(e.DATABASE_URL) : await openPglite(join(e.dataDir, 'pglite'));
      await migrate(db);
      return db;
    })();
    g.__maploomDb.catch(() => {
      g.__maploomDb = undefined;
    });
  }
  return g.__maploomDb;
}
