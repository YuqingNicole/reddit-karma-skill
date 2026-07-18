/**
 * Session = an opaque, server-side session id in an httpOnly cookie. No user
 * data (tokens, plan) lives in the cookie — it's all in Postgres, via repo.ts.
 * DB access is async, so these helpers are async too.
 */
import { cookies } from "next/headers";
import { createSession, deleteSession, getUserBySession, type User } from "./repo";

const COOKIE = "ar_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Start a logged-in session for a user and set the cookie. */
export async function startSession(userId: string): Promise<void> {
  const sid = await createSession(userId);
  cookies().set(COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** The currently logged-in user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const sid = cookies().get(COOKIE)?.value;
  if (!sid) return null;
  return getUserBySession(sid);
}

export async function endSession(): Promise<void> {
  const sid = cookies().get(COOKIE)?.value;
  if (sid) await deleteSession(sid);
  cookies().delete(COOKIE);
}
