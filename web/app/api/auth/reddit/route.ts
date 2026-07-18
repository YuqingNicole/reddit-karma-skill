import { NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeUrl } from "@/lib/reddit";

/**
 * Start the Reddit OAuth authorization-code flow. We set a short-lived `state`
 * cookie to protect against CSRF and verify it in the callback.
 */
export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("ar_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
