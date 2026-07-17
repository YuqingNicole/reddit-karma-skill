/**
 * Reddit OFFICIAL API client (OAuth2).
 *
 * All calls go through https://oauth.reddit.com with a compliant User-Agent and
 * a bearer token obtained via the authorization-code flow. This is the ONLY
 * Reddit access path in the product — no browser automation, no detection
 * evasion. A simple in-process limiter keeps us under Reddit's published budget.
 */
import { REDDIT_RATE, REDDIT_SCOPES, DISCLOSURE } from "./compliance";

const OAUTH_BASE = "https://oauth.reddit.com";
const WWW_BASE = "https://www.reddit.com";

function userAgent(): string {
  const ua = process.env.REDDIT_USER_AGENT;
  if (!ua) throw new Error("REDDIT_USER_AGENT is required by Reddit (see .env.example).");
  return ua;
}

// --- OAuth flow -----------------------------------------------------------

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID ?? "",
    response_type: "code",
    state,
    redirect_uri: `${process.env.APP_URL}/api/auth/reddit/callback`,
    duration: "permanent", // get a refresh token
    scope: REDDIT_SCOPES.join(" "),
  });
  return `${WWW_BASE}/api/v1/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function basicAuth(): string {
  const id = process.env.REDDIT_CLIENT_ID ?? "";
  const secret = process.env.REDDIT_CLIENT_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${process.env.APP_URL}/api/auth/reddit/callback`,
  });
  const res = await fetch(`${WWW_BASE}/api/v1/access_token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body,
  });
  if (!res.ok) throw new Error(`Reddit token exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh });
  const res = await fetch(`${WWW_BASE}/api/v1/access_token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body,
  });
  if (!res.ok) throw new Error(`Reddit token refresh failed: ${res.status}`);
  return res.json();
}

// --- Rate limiter ---------------------------------------------------------
// Process-local sliding window. In a multi-instance deploy, back this with
// Redis so the budget is shared across instances.
const callTimestamps: number[] = [];
let lastWriteAt = 0;

async function throttle(isWrite: boolean): Promise<void> {
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > 60_000) callTimestamps.shift();
  if (callTimestamps.length >= REDDIT_RATE.requestsPerMinute) {
    const waitFor = 60_000 - (now - callTimestamps[0]);
    await new Promise((r) => setTimeout(r, Math.max(0, waitFor)));
  }
  if (isWrite) {
    const gap = Date.now() - lastWriteAt;
    if (gap < REDDIT_RATE.minGapMsBetweenWrites) {
      await new Promise((r) => setTimeout(r, REDDIT_RATE.minGapMsBetweenWrites - gap));
    }
    lastWriteAt = Date.now();
  }
  callTimestamps.push(Date.now());
}

// --- Authed requests ------------------------------------------------------

async function api(
  token: string,
  path: string,
  init: RequestInit & { write?: boolean } = {},
): Promise<any> {
  await throttle(Boolean(init.write));
  const res = await fetch(`${OAUTH_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent(),
    },
  });
  if (res.status === 401) throw new Error("REDDIT_UNAUTHORIZED"); // caller should refresh
  if (!res.ok) throw new Error(`Reddit API ${path} failed: ${res.status}`);
  return res.json();
}

export interface RedditIdentity {
  name: string;
  totalKarma: number;
  commentKarma: number;
}

export async function getMe(token: string): Promise<RedditIdentity> {
  const d = await api(token, "/api/v1/me");
  return { name: d.name, totalKarma: d.total_karma, commentKarma: d.comment_karma };
}

export interface InboxReply {
  id: string;
  from: string;
  subreddit: string;
  isNew: boolean;
  body: string;
  context: string;
}

export async function getInbox(token: string, limit = 25): Promise<InboxReply[]> {
  const d = await api(token, `/message/inbox?limit=${limit}`);
  return (d.data?.children ?? [])
    .filter((m: any) => m.kind === "t1")
    .map((m: any): InboxReply => ({
      id: m.data.name,
      from: m.data.author,
      subreddit: m.data.subreddit,
      isNew: !!m.data.new,
      body: m.data.body,
      context: `https://reddit.com${m.data.context}`,
    }));
}

/**
 * Submit a post. Only ever called after a human clicks Approve. If disclosure
 * is enabled, we append a short, honest footer to the body.
 */
export async function submitPost(
  token: string,
  opts: { subreddit: string; title: string; text?: string; url?: string; disclose?: boolean },
) {
  const isSelf = Boolean(opts.text);
  const text = opts.disclose && isSelf ? `${opts.text}\n\n^(${DISCLOSURE.postFooter})` : opts.text;
  const body = new URLSearchParams({
    sr: opts.subreddit,
    kind: isSelf ? "self" : "link",
    title: opts.title,
    api_type: "json",
    ...(isSelf ? { text: text ?? "" } : { url: opts.url ?? "" }),
  });
  const d = await api(token, "/api/submit", {
    method: "POST",
    write: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return { errors: d.json?.errors ?? [], url: d.json?.data?.url ?? null };
}

export async function submitComment(token: string, thingId: string, text: string) {
  const body = new URLSearchParams({ thing_id: thingId, text, api_type: "json" });
  const d = await api(token, "/api/comment", {
    method: "POST",
    write: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return { errors: d.json?.errors ?? [] };
}
