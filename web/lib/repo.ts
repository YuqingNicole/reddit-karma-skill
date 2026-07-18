/**
 * Repository layer — the only place that reads/writes user + session rows.
 * Swap the SQLite calls here for Postgres without touching the rest of the app.
 */
import crypto from "crypto";
import { db } from "./db";
import type { Plan } from "./subscription";

export interface User {
  id: string;
  reddit_username: string;
  reddit_access_token: string | null;
  reddit_refresh_token: string | null;
  reddit_token_expires_at: number | null;
  stripe_customer_id: string | null;
  plan: Plan;
  subscription_status: string | null;
  created_at: number;
  updated_at: number;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// --- Users ----------------------------------------------------------------

export function getUserById(id: string): User | null {
  return (db().prepare("SELECT * FROM users WHERE id = ?").get(id) as User) ?? null;
}

export function getUserByStripeCustomerId(customerId: string): User | null {
  return (
    (db().prepare("SELECT * FROM users WHERE stripe_customer_id = ?").get(customerId) as User) ??
    null
  );
}

export function getUserByRedditUsername(username: string): User | null {
  return (
    (db().prepare("SELECT * FROM users WHERE reddit_username = ?").get(username) as User) ?? null
  );
}

/**
 * Insert or update a user on Reddit login, persisting the OAuth tokens.
 * Returns the full user row.
 */
export function upsertUserWithRedditTokens(input: {
  redditUsername: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}): User {
  const now = Date.now();
  const existing = getUserByRedditUsername(input.redditUsername);
  if (existing) {
    db()
      .prepare(
        `UPDATE users SET reddit_access_token = ?, reddit_refresh_token = COALESCE(?, reddit_refresh_token),
         reddit_token_expires_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(input.accessToken, input.refreshToken ?? null, input.expiresAt, now, existing.id);
    return getUserById(existing.id)!;
  }
  const id = crypto.randomUUID();
  db()
    .prepare(
      `INSERT INTO users (id, reddit_username, reddit_access_token, reddit_refresh_token,
        reddit_token_expires_at, plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'free', ?, ?)`,
    )
    .run(
      id,
      input.redditUsername,
      input.accessToken,
      input.refreshToken ?? null,
      input.expiresAt,
      now,
      now,
    );
  return getUserById(id)!;
}

export function updateRedditTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt: number },
): void {
  db()
    .prepare(
      `UPDATE users SET reddit_access_token = ?, reddit_refresh_token = COALESCE(?, reddit_refresh_token),
       reddit_token_expires_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(tokens.accessToken, tokens.refreshToken ?? null, tokens.expiresAt, Date.now(), userId);
}

export function setStripeCustomer(userId: string, customerId: string): void {
  db()
    .prepare("UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?")
    .run(customerId, Date.now(), userId);
}

/** Set plan + subscription status. Used by the Stripe webhook. */
export function setSubscription(userId: string, plan: Plan, status: string | null): void {
  db()
    .prepare("UPDATE users SET plan = ?, subscription_status = ?, updated_at = ? WHERE id = ?")
    .run(plan, status, Date.now(), userId);
}

// --- Sessions -------------------------------------------------------------

export function createSession(userId: string): string {
  const id = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db()
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, now, now + SESSION_TTL_MS);
  return id;
}

export function getUserBySession(sessionId: string): User | null {
  const row = db()
    .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { user_id: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteSession(sessionId);
    return null;
  }
  return getUserById(row.user_id);
}

export function deleteSession(sessionId: string): void {
  db().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

// --- Scheduled jobs -------------------------------------------------------

export type JobStatus = "pending" | "processing" | "sent" | "failed" | "canceled";

export interface Job {
  id: string;
  user_id: string;
  kind: "self" | "link";
  subreddit: string;
  title: string;
  body: string | null;
  url: string | null;
  disclose: number; // 0 | 1
  run_at: number;
  status: JobStatus;
  result_url: string | null;
  error: string | null;
  attempts: number;
  created_at: number;
  updated_at: number;
}

export function countJobsForUser(userId: string): number {
  return (
    db().prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id = ?").get(userId) as { c: number }
  ).c;
}

export function createJob(input: {
  userId: string;
  kind: "self" | "link";
  subreddit: string;
  title: string;
  body?: string;
  url?: string;
  disclose: boolean;
  runAt: number;
}): Job {
  const id = crypto.randomUUID();
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO jobs (id, user_id, kind, subreddit, title, body, url, disclose, run_at,
        status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    )
    .run(
      id,
      input.userId,
      input.kind,
      input.subreddit,
      input.title,
      input.body ?? null,
      input.url ?? null,
      input.disclose ? 1 : 0,
      input.runAt,
      now,
      now,
    );
  return db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job;
}

export function listJobsForUser(userId: string, limit = 25): Job[] {
  return db()
    .prepare("SELECT * FROM jobs WHERE user_id = ? ORDER BY run_at DESC LIMIT ?")
    .all(userId, limit) as Job[];
}

/** How many posts this user has sent since `sinceMs` (for the daily cap). */
export function countSentSince(userId: string, sinceMs: number): number {
  return (
    db()
      .prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id = ? AND status = 'sent' AND updated_at >= ?")
      .get(userId, sinceMs) as { c: number }
  ).c;
}

/**
 * Atomically claim up to `limit` due, pending jobs by flipping them to
 * 'processing'. The transaction prevents two workers from grabbing the same job.
 */
export function claimDueJobs(now: number, limit: number): Job[] {
  const claim = db().transaction((n: number, lim: number) => {
    const rows = db()
      .prepare(
        "SELECT id FROM jobs WHERE status = 'pending' AND run_at <= ? ORDER BY run_at ASC LIMIT ?",
      )
      .all(n, lim) as { id: string }[];
    const upd = db().prepare(
      "UPDATE jobs SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ? AND status = 'pending'",
    );
    const claimed: Job[] = [];
    for (const { id } of rows) {
      const info = upd.run(Date.now(), id);
      if (info.changes === 1) {
        claimed.push(db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job);
      }
    }
    return claimed;
  });
  return claim(now, limit);
}

export function markJobSent(id: string, resultUrl: string | null): void {
  db()
    .prepare("UPDATE jobs SET status = 'sent', result_url = ?, error = NULL, updated_at = ? WHERE id = ?")
    .run(resultUrl, Date.now(), id);
}

export function markJobFailed(id: string, error: string): void {
  db()
    .prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
    .run(error.slice(0, 500), Date.now(), id);
}

/** Push a claimed job back to pending with a later run time (e.g. daily cap hit). */
export function requeueJob(id: string, runAt: number): void {
  db()
    .prepare("UPDATE jobs SET status = 'pending', run_at = ?, updated_at = ? WHERE id = ?")
    .run(runAt, Date.now(), id);
}

/** Cancel a still-pending job the user owns. Returns true if one was canceled. */
export function cancelJob(id: string, userId: string): boolean {
  const info = db()
    .prepare("UPDATE jobs SET status = 'canceled', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'pending'")
    .run(Date.now(), id, userId);
  return info.changes === 1;
}
