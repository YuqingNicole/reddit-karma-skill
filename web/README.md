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
- Postgres persistence (node-postgres) — `lib/db.ts` (pool + schema),
  `lib/repo.ts` (the only module that touches the DB). Works with Vercel
  Postgres, Neon, Supabase, or any Postgres.
- Server-side sessions — opaque id in an httpOnly cookie (`lib/session.ts`),
  resolved to a user row in the DB; Reddit tokens + plan live in the DB, never
  the cookie

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
| Database | `DATABASE_URL` (or `POSTGRES_URL`) | Postgres connection string. Use the **pooled** one on serverless. Schema auto-creates on first query. |
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
| `/api/reddit/schedule`, `/api/reddit/schedule/cancel`, `/api/reddit/reply`, `/api/ai/draft` | Feature actions |
| `/api/cron/dispatch` | Scheduler dispatch (cron / worker; `CRON_SECRET`) |

## Compliance model (`lib/compliance.ts`)

- **Official API only** — OAuth2, minimal scopes, compliant User-Agent.
- **Under Reddit's budget** — a process-local limiter caps requests/minute and
  spaces out writes (`lib/reddit.ts`). Back it with Redis for multi-instance.
- **Human-approved posting** — scheduling, replying, and drafting all require a
  human action; the AI assistant suggests and never auto-sends
  (`DRAFTING_POLICY.autoSend === false`), and won't write as a fake persona.
- **Disclosure** — an in-app banner, and an optional footer on scheduled posts.

## Persistence (`lib/db.ts`, `lib/repo.ts`)

Reddit OAuth tokens and subscription state live in **Postgres**, not the cookie:

- `users` — reddit username, access/refresh tokens + expiry, stripe customer id,
  plan, subscription status.
- `sessions` — opaque session id → user id, with an expiry (FK-cascades on user
  delete). The cookie holds only the session id.
- `jobs` — scheduled posts (see below).

Flow: Reddit login upserts the user + tokens and starts a session; the Stripe
webhook is the source of truth for `plan` (keyed by reddit username on first
checkout, by stripe customer id thereafter); expired Reddit tokens are refreshed
and re-persisted automatically (`lib/reddit-auth.ts`).

`lib/db.ts` holds a cached connection pool and creates the schema on first query
(idempotent `CREATE TABLE IF NOT EXISTS`). `lib/repo.ts` is the only module that
runs SQL — swap providers there. On serverless, use your provider's **pooled**
connection string and keep `PG_POOL_MAX` small.

## Scheduler (`jobs` table + worker)

Scheduled posts are real jobs in the DB, sent by a dispatcher:

- **Enqueue** — `POST /api/reddit/schedule` inserts a `pending` job (enforces the
  per-account job cap); the Schedule tab lists your queue with live status and a
  cancel button (`/api/reddit/schedule/cancel`).
- **Dispatch** — `GET/POST /api/cron/dispatch` (protected by `CRON_SECRET`) runs
  `runDueScheduledPosts()`: it **atomically claims** due jobs (`pending → processing`,
  so two workers never grab the same job), sends each via the official API with a
  fresh token, spaced by the write limiter, then marks `sent`/`failed`. If a
  user hit the daily post cap, the job is **deferred** (re-queued +1h) instead of
  over-posting.
- **Drive it** one of two ways:
  - **Vercel Cron** — `vercel.json` already schedules `/api/cron/dispatch` every
    minute; Vercel injects the `CRON_SECRET` auth header automatically.
  - **Self-hosted** — `npm run worker` (`worker/worker.mjs`) polls the dispatch
    endpoint on an interval. Needs `CRON_SECRET` + `DISPATCH_URL`.

Job lifecycle: `pending → processing → sent | failed`, or `pending → canceled`,
with `deferred` re-queueing back to `pending`.

## Deploy to Vercel

1. **Root Directory = `web`.** This repo's root is not the app (the Next app
   lives in `web/`). In the Vercel project: **Settings → Build & Deployment →
   Root Directory → `web`.** Without this, the build fails with "no Next.js
   version detected" — this is the #1 cause of failed deploys here.
2. **Provision Postgres** (Vercel Postgres / Neon / Supabase) and set
   `DATABASE_URL` to its **pooled** connection string. (SQLite can't run on
   Vercel — the serverless filesystem is read-only except `/tmp`.)
3. **Set env vars** (Project → Settings → Environment Variables): `APP_URL` (your
   deployed URL), `REDDIT_CLIENT_ID/SECRET/USER_AGENT`, `STRIPE_*`, `CRON_SECRET`,
   optional `ANTHROPIC_API_KEY`. Point the Reddit app's redirect URI and the
   Stripe webhook at the deployed URL.
4. **Scheduler** runs via Vercel Cron (`vercel.json`, every minute) — no separate
   worker process. `npm run worker` is only for non-serverless hosts.

## What's still stubbed (finish before production)

- **Token encryption at rest**: tokens are stored plaintext for the scaffold —
  encrypt them (or use a secrets manager) in production.
- **Dashboard data**: overview counts are placeholders (the Schedule queue is
  real; wire the overview to `countSentSince` / `listJobsForUser`).
- **Retries**: failed jobs stay `failed`; add backoff/retry off `attempts` if you
  want automatic re-tries.

## Support

Questions or issues: email **support@autoreddit.ai** · WeChat **c1426217526**.

## Not affiliated with Reddit, Inc.
