/**
 * SQLite data layer (better-sqlite3).
 *
 * Chosen for a zero-config local scaffold: synchronous API, single file, no
 * server. For production you can swap this module's queries for Postgres —
 * everything else talks to the repository in `repo.ts`, not to SQLite directly.
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                       TEXT PRIMARY KEY,
  reddit_username          TEXT UNIQUE NOT NULL,
  reddit_access_token      TEXT,
  reddit_refresh_token     TEXT,
  reddit_token_expires_at  INTEGER,
  stripe_customer_id       TEXT,
  plan                     TEXT NOT NULL DEFAULT 'free',
  subscription_status      TEXT,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
`;

// Reuse one connection across hot-reloads / route invocations in dev.
const globalForDb = globalThis as unknown as { __arDb?: Database.Database };

export function db(): Database.Database {
  if (globalForDb.__arDb) return globalForDb.__arDb;

  const dbPath =
    process.env.DATABASE_PATH || path.join(process.cwd(), "data", "autoreddit.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);

  globalForDb.__arDb = conn;
  return conn;
}
