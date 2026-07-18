import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledPosts } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduler dispatch endpoint. Sends any due scheduled posts.
 *
 * Protected by CRON_SECRET via `Authorization: Bearer <secret>`. Vercel Cron
 * injects this header automatically when CRON_SECRET is set; a self-hosted
 * cron / the worker in worker/worker.mjs sends it explicitly.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const batch = Number(process.env.CRON_BATCH ?? 10);
  const summary = await runDueScheduledPosts(batch);
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
