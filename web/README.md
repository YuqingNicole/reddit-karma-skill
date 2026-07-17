# autoreddit.ai — web frontend

A Next.js (App Router, TypeScript) full-stack scaffold for a **compliant**
Reddit management product: post scheduling, inbox management, and an AI drafting
assistant — all through Reddit's **official API**, with automation disclosed and
every post approved by a human.

> This is deliberately *not* the AppleScript/Chrome engine in `../cli/`. That
> engine drives a real browser and is designed to be undetectable; this product
> uses the official OAuth API, discloses automation, and gates posting behind
> human approval. Keep the two separate.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Reddit OAuth2 (official API) — `lib/reddit.ts`
- Stripe subscriptions — `lib/stripe.ts`, `app/api/stripe/*`
- Signed-cookie session (scaffold) — `lib/session.ts`

## Run

```bash
cd web
cp .env.example .env.local   # fill in the values (see below)
npm install
npm run dev                  # http://localhost:3000
npm run typecheck            # optional: tsc --noEmit
```

## Configuration

| Area | Where | Notes |
|------|-------|-------|
| Reddit OAuth | `REDDIT_CLIENT_ID/SECRET`, `REDDIT_USER_AGENT` | Create a **web app** at reddit.com/prefs/apps; redirect URI = `$APP_URL/api/auth/reddit/callback`. Reddit requires the exact User-Agent format. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Create two recurring prices; point a webhook at `/api/stripe/webhook`. |
| Sessions | `SESSION_SECRET` | `openssl rand -hex 32`. |
| AI drafts | `ANTHROPIC_API_KEY` | Optional; without it the assistant returns a placeholder. |

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing + compliance summary |
| `/pricing` | Plans → Stripe Checkout (`POST /api/stripe/checkout`) |
| `/dashboard` | Overview + rate-limit meters |
| `/dashboard/schedule` | Queue posts (paid) |
| `/dashboard/inbox` | Read + reply to replies via official API (paid) |
| `/dashboard/drafts` | AI draft → human edits → approve (paid) |
| `/api/auth/reddit`, `/api/auth/reddit/callback` | OAuth flow |
| `/api/stripe/checkout`, `/api/stripe/webhook` | Subscriptions |
| `/api/reddit/schedule`, `/api/reddit/reply`, `/api/ai/draft` | Feature actions |

## Compliance model (`lib/compliance.ts`)

- **Official API only** — OAuth2, minimal scopes, compliant User-Agent.
- **Under Reddit's budget** — a process-local limiter caps requests/minute and
  spaces out writes (`lib/reddit.ts`). Back it with Redis for multi-instance.
- **Human-approved posting** — scheduling, replying, and drafting all require a
  human action; the AI assistant suggests and never auto-sends
  (`DRAFTING_POLICY.autoSend === false`), and won't write as a fake persona.
- **Disclosure** — an in-app banner, and an optional footer on scheduled posts.

## What's stubbed (finish before production)

- **Persistence**: replace the cookie session with a DB. Store Reddit tokens
  (encrypted) and subscription state there — the Stripe webhook can't write the
  cookie, so plan state *must* live in a DB (see the TODOs in
  `app/api/stripe/webhook/route.ts`).
- **Scheduler worker**: `/api/reddit/schedule` records jobs; add a cron/queue
  worker that sends them at `runAt` via `submitPost`, honoring rate limits.
- **Token refresh**: call `refreshToken` when `redditTokenExpiresAt` passes.
- **Dashboard data**: overview counts and the queue list are placeholders.

## Not affiliated with Reddit, Inc.
