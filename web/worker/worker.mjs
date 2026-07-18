#!/usr/bin/env node
/**
 * Standalone scheduler worker for self-hosted (non-serverless) deploys.
 *
 * Polls the dispatch endpoint on an interval. On Vercel, use Vercel Cron
 * against /api/cron/dispatch instead of running this. Zero dependencies.
 *
 *   DISPATCH_URL      default http://localhost:3000/api/cron/dispatch
 *   CRON_SECRET       must match the app's CRON_SECRET
 *   WORKER_INTERVAL_MS default 30000
 */
const url = process.env.DISPATCH_URL || "http://localhost:3000/api/cron/dispatch";
const secret = process.env.CRON_SECRET;
const interval = Number(process.env.WORKER_INTERVAL_MS || 30_000);

if (!secret) {
  console.error("CRON_SECRET is required (must match the app).");
  process.exit(1);
}

let stopping = false;

async function tick() {
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
    if (!res.ok) {
      console.error(`[worker] dispatch ${res.status}`);
      return;
    }
    const summary = await res.json();
    if (summary.claimed > 0) {
      console.log(`[worker] ${new Date().toISOString()} sent batch:`, JSON.stringify(summary));
    }
  } catch (e) {
    console.error("[worker] error:", e?.message || e);
  }
}

async function loop() {
  console.log(`[worker] polling ${url} every ${interval}ms`);
  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, interval));
  }
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopping = true;
    console.log("\n[worker] shutting down");
    process.exit(0);
  });
}

loop();
