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
