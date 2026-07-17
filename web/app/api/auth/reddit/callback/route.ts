import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getMe } from "@/lib/reddit";
import { getSession, setSession } from "@/lib/session";

/**
 * Reddit redirects here with ?code&state. We verify state, exchange the code
 * for tokens, look up the username, and store it in the session.
 *
 * Scaffold note: tokens live in the signed cookie here for simplicity. In
 * production, persist them (encrypted) in your DB keyed by user id.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("ar_oauth_state")?.value;

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${process.env.APP_URL}/?error=reddit_denied`);
  }
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${process.env.APP_URL}/?error=bad_state`);
  }

  try {
    const tokens = await exchangeCode(code);
    const me = await getMe(tokens.access_token);
    setSession({
      ...getSession(),
      redditUsername: me.name,
      redditAccessToken: tokens.access_token,
      redditRefreshToken: tokens.refresh_token,
      redditTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      plan: getSession().plan ?? "free",
    });
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/?error=oauth_failed`);
  }

  const res = NextResponse.redirect(`${process.env.APP_URL}/dashboard`);
  res.cookies.delete("ar_oauth_state");
  return res;
}
