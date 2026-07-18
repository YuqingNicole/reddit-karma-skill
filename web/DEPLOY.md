# Deploying autoreddit.ai to Vercel

A step-by-step checklist. The app lives in `web/`, uses Postgres, and runs the
scheduler on Vercel Cron.

## 1. Point Vercel at the app

The repository root is **not** the app (it's a skills repo; the Next app is in
`web/`). In the Vercel project:

**Settings → Build & Deployment → Root Directory → `web`**

Without this, the build fails with *"No Next.js version detected"* — this is the
most common cause of failed deploys for this repo. Framework preset: **Next.js**
(auto-detected once the root directory is correct).

## 2. Provision Postgres

Use any Postgres — Vercel Postgres, Neon, or Supabase. Copy its **pooled**
connection string (Neon `-pooler` host; Supabase port `6543`).

> SQLite is intentionally not used: Vercel's serverless filesystem is read-only
> except `/tmp`, so a SQLite file can't persist. The schema auto-creates on the
> first query.

## 3. Environment variables

Set these in **Settings → Environment Variables** (Production + Preview):

| Var | Value |
|-----|-------|
| `APP_URL` | your deployed URL, e.g. `https://autoreddit.ai` |
| `DATABASE_URL` | Postgres **pooled** connection string |
| `TOKEN_ENC_KEY` | `openssl rand -hex 32` (encrypts Reddit tokens at rest) |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | from reddit.com/prefs/apps (type: **web app**) |
| `REDDIT_USER_AGENT` | e.g. `web:ai.autoreddit:0.1.0 (by /u/you)` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | from Stripe |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` | recurring price ids |
| `CRON_SECRET` | `openssl rand -hex 32` (protects the scheduler) |
| `ANTHROPIC_API_KEY` | optional — enables AI drafts |

## 4. Wire external services to the deployed URL

- **Reddit app** → redirect URI = `${APP_URL}/api/auth/reddit/callback`
- **Stripe webhook** → `${APP_URL}/api/stripe/webhook`, subscribed to
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`. Put its signing secret in
  `STRIPE_WEBHOOK_SECRET`.

## 5. Scheduler

`vercel.json` already registers a cron on `/api/cron/dispatch` every minute.
Vercel injects the `CRON_SECRET` auth header automatically once the env var is
set — nothing else to run. (The standalone `npm run worker` is only for
non-serverless hosts.)

## 6. Deploy & verify

1. Trigger a deploy (push to the connected branch, or "Redeploy").
2. Build should succeed now that Root Directory = `web`.
3. Visit `/`, click **Connect Reddit**, complete OAuth → you land on `/dashboard`.
4. Subscribe on `/pricing` (Stripe test card `4242 4242 4242 4242`) → the webhook
   flips your plan; paid features unlock.
5. Schedule a post a couple of minutes out → the cron sends it and the queue row
   flips to `sent`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build: "No Next.js version detected" | Root Directory not set to `web` (step 1). |
| Runtime: `DATABASE_URL is required` | Env var missing (step 3). |
| Runtime: connection/too many clients | Use the **pooled** connection string; keep `PG_POOL_MAX` small. |
| OAuth `redirect_uri` mismatch | Reddit app redirect URI must exactly equal `${APP_URL}/api/auth/reddit/callback`. |
| Plan never upgrades after payment | Stripe webhook URL/secret wrong, or events not subscribed (step 4). |
| Scheduled posts never send | `CRON_SECRET` unset, or cron disabled for the project. |
