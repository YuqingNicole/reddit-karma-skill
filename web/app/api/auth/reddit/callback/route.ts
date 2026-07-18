import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getMe } from "@/lib/reddit";
import { upsertUserWithRedditTokens } from "@/lib/repo";
import { startSession } from "@/lib/session";

/**
 * Reddit redirects here with ?code&state. We verify state, exchange the code
 * for tokens, upsert the user (tokens persisted in the DB), and start a
 * server-side session.
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
    const user = await upsertUserWithRedditTokens({
      redditUsername: me.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
    await startSession(user.id);
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/?error=oauth_failed`);
  }

  const res = NextResponse.redirect(`${process.env.APP_URL}/dashboard`);
  res.cookies.delete("ar_oauth_state");
  return res;
}
