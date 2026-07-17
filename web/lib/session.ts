/**
 * Minimal signed-cookie session (no external dependency).
 *
 * This is a scaffold: it stores a small session payload in an HMAC-signed
 * cookie. For production, swap in a real session store / NextAuth and persist
 * Reddit tokens + Stripe customer/subscription in your database, not the cookie.
 */
import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "ar_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionData {
  redditUsername?: string;
  redditAccessToken?: string;
  redditRefreshToken?: string;
  redditTokenExpiresAt?: number; // epoch ms
  stripeCustomerId?: string;
  plan?: "free" | "starter" | "pro";
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (see .env.example).");
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): SessionData {
  if (!token) return {};
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return {};
  const expected = sign(payload);
  // constant-time compare
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return {};
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

export function getSession(): SessionData {
  return decode(cookies().get(COOKIE)?.value);
}

export function setSession(data: SessionData): void {
  cookies().set(COOKIE, encode(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession(): void {
  cookies().delete(COOKIE);
}
