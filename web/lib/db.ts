/**
 * Postgres data layer (node-postgres).
 *
 * Works with any Postgres: Vercel Postgres, Neon, Supabase, RDS, etc. On
 * serverless (Vercel), use the provider's POOLED connection string so many
 * short-lived function invocations don't exhaust connections.
 *
 * Everything else in the app talks to the repository in `repo.ts`, not to this
 * module — swap providers here without touching the rest.
 */
import { Pool } from "pg";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                       TEXT PRIMARY KEY,
  reddit_username          TEXT UNIQUE NOT NULL,
  reddit_access_token      TEXT,
  reddit_refresh_token     TEXT,
  reddit_token_expires_at  BIGINT,
  stripe_customer_id       TEXT,
  plan                     TEXT NOT NULL DEFAULT 'free',
  subscription_status      TEXT,
  created_at               BIGINT NOT NULL,
  updated_at               BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  subreddit    TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  url          TEXT,
  disclose     BOOLEAN NOT NULL DEFAULT TRUE,
  run_at       BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  result_url   TEXT,
  error        TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at);
`;

// BIGINT comes back from pg as a string by default; parse the epoch-ms columns
// back to JS numbers. (OID 20 = int8.)
import { types } from "pg";
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

// Reuse the pool + one-time schema init across serverless invocations / dev HMR.
const g = globalThis as unknown as { __arPool?: Pool; __arInit?: Promise<void> };

export function pool(): Pool {
  if (g.__arPool) return g.__arPool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or POSTGRES_URL) is required — see .env.example.");
  }
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  g.__arPool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 3),
    ssl: process.env.PG_SSL === "disable" || local ? undefined : { rejectUnauthorized: false },
  });
  return g.__arPool;
}

async function ensureSchema(): Promise<void> {
  if (!g.__arInit) {
    g.__arInit = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        // Reset so a transient failure can retry on the next request.
        g.__arInit = undefined;
        throw e;
      });
  }
  return g.__arInit;
}

/** Run a query, returning the rows. Ensures the schema exists first. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const res = await pool().query(text, params);
  return res.rows as T[];
}
