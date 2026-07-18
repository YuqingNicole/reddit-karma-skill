/**
 * Returns a valid Reddit access token for a user, refreshing + persisting it if
 * it has expired (or is about to). Keeps token lifecycle in the DB.
 */
import { refreshToken } from "./reddit";
import { updateRedditTokens, type User } from "./repo";

const SKEW_MS = 60_000; // refresh a minute early

export async function getFreshAccessToken(user: User): Promise<string | null> {
  if (!user.reddit_access_token) return null;

  const expiresAt = user.reddit_token_expires_at ?? 0;
  if (expiresAt - SKEW_MS > Date.now()) {
    return user.reddit_access_token;
  }
  if (!user.reddit_refresh_token) {
    // No refresh token — caller should send the user back through OAuth.
    return null;
  }
  try {
    const t = await refreshToken(user.reddit_refresh_token);
    const newExpiry = Date.now() + t.expires_in * 1000;
    await updateRedditTokens(user.id, {
      accessToken: t.access_token,
      refreshToken: t.refresh_token, // Reddit may or may not rotate it
      expiresAt: newExpiry,
    });
    return t.access_token;
  } catch {
    return null;
  }
}
