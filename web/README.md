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
- SQLite persistence (better-sqlite3) — `lib/db.ts` (schema), `lib/repo.ts`
  (the only module that touches the DB — swap it for Postgres in one place)
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
| Database | `DATABASE_PATH` | SQLite file (default `./data/autoreddit.db`); auto-created on first run. |
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

Reddit OAuth tokens and subscription state live in SQLite, not the cookie:

- `users` — reddit username, access/refresh tokens + expiry, stripe customer id,
  plan, subscription status.
- `sessions` — opaque session id → user id, with an expiry (FK-cascades on user
  delete). The cookie holds only the session id.

Flow: Reddit login upserts the user + tokens and starts a session; the Stripe
webhook is the source of truth for `plan` (keyed by reddit username on first
checkout, by stripe customer id thereafter); expired Reddit tokens are refreshed
and re-persisted automatically (`lib/reddit-auth.ts`).

**Swap to Postgres** by reimplementing `lib/db.ts` + `lib/repo.ts` against your
driver — nothing else touches the database.

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

## What's still stubbed (finish before production)

- **Token encryption at rest**: tokens are stored plaintext in SQLite for the
  scaffold — encrypt them (or use a secrets manager) in production.
- **Dashboard data**: overview counts are placeholders (the Schedule queue is
  real; wire the overview to `countSentSince` / `listJobsForUser`).
- **Retries**: failed jobs stay `failed`; add backoff/retry off `attempts` if you
  want automatic re-tries.

## Not affiliated with Reddit, Inc.
