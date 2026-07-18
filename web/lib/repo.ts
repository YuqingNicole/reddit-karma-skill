/**
 * Repository layer — the only place that reads/writes user + session + job rows.
 * All functions are async (Postgres). Swap the SQL here for another store
 * without touching the rest of the app.
 */
import crypto from "crypto";
import { query } from "./db";
import { decryptToken, encryptToken } from "./crypto";
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

async function one<T>(text: string, params: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Decrypt the token columns on a user row read from the DB. */
function decodeUser(u: User | null): User | null {
  if (!u) return null;
  u.reddit_access_token = decryptToken(u.reddit_access_token);
  u.reddit_refresh_token = decryptToken(u.reddit_refresh_token);
  return u;
}

// --- Users ----------------------------------------------------------------

export async function getUserById(id: string): Promise<User | null> {
  return decodeUser(await one<User>("SELECT * FROM users WHERE id = $1", [id]));
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | null> {
  return decodeUser(
    await one<User>("SELECT * FROM users WHERE stripe_customer_id = $1", [customerId]),
  );
}

export async function getUserByRedditUsername(username: string): Promise<User | null> {
  return decodeUser(await one<User>("SELECT * FROM users WHERE reddit_username = $1", [username]));
}

/** Insert or update a user on Reddit login, persisting the OAuth tokens. */
export async function upsertUserWithRedditTokens(input: {
  redditUsername: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}): Promise<User> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const rows = await query<User>(
    `INSERT INTO users (id, reddit_username, reddit_access_token, reddit_refresh_token,
       reddit_token_expires_at, plan, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'free', $6, $6)
     ON CONFLICT (reddit_username) DO UPDATE SET
       reddit_access_token = EXCLUDED.reddit_access_token,
       reddit_refresh_token = COALESCE(EXCLUDED.reddit_refresh_token, users.reddit_refresh_token),
       reddit_token_expires_at = EXCLUDED.reddit_token_expires_at,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      id,
      input.redditUsername,
      encryptToken(input.accessToken),
      encryptToken(input.refreshToken ?? null),
      input.expiresAt,
      now,
    ],
  );
  return decodeUser(rows[0])!;
}

export async function updateRedditTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt: number },
): Promise<void> {
  await query(
    `UPDATE users SET reddit_access_token = $1,
       reddit_refresh_token = COALESCE($2, reddit_refresh_token),
       reddit_token_expires_at = $3, updated_at = $4 WHERE id = $5`,
    [
      encryptToken(tokens.accessToken),
      encryptToken(tokens.refreshToken ?? null),
      tokens.expiresAt,
      Date.now(),
      userId,
    ],
  );
}

export async function setStripeCustomer(userId: string, customerId: string): Promise<void> {
  await query("UPDATE users SET stripe_customer_id = $1, updated_at = $2 WHERE id = $3", [
    customerId,
    Date.now(),
    userId,
  ]);
}

/** Set plan + subscription status. Used by the Stripe webhook. */
export async function setSubscription(
  userId: string,
  plan: Plan,
  status: string | null,
): Promise<void> {
  await query("UPDATE users SET plan = $1, subscription_status = $2, updated_at = $3 WHERE id = $4", [
    plan,
    status,
    Date.now(),
    userId,
  ]);
}

// --- Sessions -------------------------------------------------------------

export async function createSession(userId: string): Promise<string> {
  const id = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  await query(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
    [id, userId, now, now + SESSION_TTL_MS],
  );
  return id;
}

export async function getUserBySession(sessionId: string): Promise<User | null> {
  const row = await one<{ user_id: string; expires_at: number }>(
    "SELECT user_id, expires_at FROM sessions WHERE id = $1",
    [sessionId],
  );
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await deleteSession(sessionId);
    return null;
  }
  return getUserById(row.user_id);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE id = $1", [sessionId]);
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
  disclose: boolean;
  run_at: number;
  status: JobStatus;
  result_url: string | null;
  error: string | null;
  attempts: number;
  created_at: number;
  updated_at: number;
}

export async function countJobsForUser(userId: string): Promise<number> {
  const row = await one<{ c: string }>("SELECT COUNT(*)::int AS c FROM jobs WHERE user_id = $1", [
    userId,
  ]);
  return Number(row?.c ?? 0);
}

export async function createJob(input: {
  userId: string;
  kind: "self" | "link";
  subreddit: string;
  title: string;
  body?: string;
  url?: string;
  disclose: boolean;
  runAt: number;
}): Promise<Job> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const rows = await query<Job>(
    `INSERT INTO jobs (id, user_id, kind, subreddit, title, body, url, disclose, run_at,
       status, attempts, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 0, $10, $10)
     RETURNING *`,
    [
      id,
      input.userId,
      input.kind,
      input.subreddit,
      input.title,
      input.body ?? null,
      input.url ?? null,
      input.disclose,
      input.runAt,
      now,
    ],
  );
  return rows[0];
}

export function listJobsForUser(userId: string, limit = 25): Promise<Job[]> {
  return query<Job>("SELECT * FROM jobs WHERE user_id = $1 ORDER BY run_at DESC LIMIT $2", [
    userId,
    limit,
  ]);
}

export async function countJobsByStatus(userId: string, status: JobStatus): Promise<number> {
  const row = await one<{ c: string }>(
    "SELECT COUNT(*)::int AS c FROM jobs WHERE user_id = $1 AND status = $2",
    [userId, status],
  );
  return Number(row?.c ?? 0);
}

/** How many posts this user has sent since `sinceMs` (for the daily cap). */
export async function countSentSince(userId: string, sinceMs: number): Promise<number> {
  const row = await one<{ c: string }>(
    "SELECT COUNT(*)::int AS c FROM jobs WHERE user_id = $1 AND status = 'sent' AND updated_at >= $2",
    [userId, sinceMs],
  );
  return Number(row?.c ?? 0);
}

/**
 * Atomically claim up to `limit` due, pending jobs by flipping them to
 * 'processing'. FOR UPDATE SKIP LOCKED means two workers never grab the same
 * job even under concurrency.
 */
export function claimDueJobs(now: number, limit: number): Promise<Job[]> {
  return query<Job>(
    `UPDATE jobs SET status = 'processing', attempts = attempts + 1, updated_at = $1
     WHERE id IN (
       SELECT id FROM jobs WHERE status = 'pending' AND run_at <= $2
       ORDER BY run_at ASC LIMIT $3 FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [Date.now(), now, limit],
  );
}

export async function markJobSent(id: string, resultUrl: string | null): Promise<void> {
  await query(
    "UPDATE jobs SET status = 'sent', result_url = $1, error = NULL, updated_at = $2 WHERE id = $3",
    [resultUrl, Date.now(), id],
  );
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  await query("UPDATE jobs SET status = 'failed', error = $1, updated_at = $2 WHERE id = $3", [
    error.slice(0, 500),
    Date.now(),
    id,
  ]);
}

/** Push a claimed job back to pending with a later run time (e.g. daily cap hit). */
export async function requeueJob(id: string, runAt: number): Promise<void> {
  await query("UPDATE jobs SET status = 'pending', run_at = $1, updated_at = $2 WHERE id = $3", [
    runAt,
    Date.now(),
    id,
  ]);
}

/** Cancel a still-pending job the user owns. Returns true if one was canceled. */
export async function cancelJob(id: string, userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE jobs SET status = 'canceled', updated_at = $1 WHERE id = $2 AND user_id = $3 AND status = 'pending' RETURNING id",
    [Date.now(), id, userId],
  );
  return rows.length === 1;
}
