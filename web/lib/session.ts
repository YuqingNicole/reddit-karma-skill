/**
 * Session = an opaque, server-side session id stored in an httpOnly cookie.
 * No user data (tokens, plan) lives in the cookie anymore — it's all in the DB,
 * resolved through `repo.ts`.
 */
import { cookies } from "next/headers";
import { createSession, deleteSession, getUserBySession, type User } from "./repo";

const COOKIE = "ar_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Start a logged-in session for a user and set the cookie. */
export function startSession(userId: string): void {
  const sid = createSession(userId);
  cookies().set(COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** The currently logged-in user, or null. Synchronous (SQLite + cookie). */
export function getCurrentUser(): User | null {
  const sid = cookies().get(COOKIE)?.value;
  if (!sid) return null;
  return getUserBySession(sid);
}

export function endSession(): void {
  const sid = cookies().get(COOKIE)?.value;
  if (sid) deleteSession(sid);
  cookies().delete(COOKIE);
}
