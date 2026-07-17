import { NextRequest, NextResponse } from "next/server";
import { requirePaid } from "@/lib/subscription";

/**
 * Queue a scheduled post. This route only records the job; a background worker
 * (cron / queue) sends it at runAt via the official API, within rate limits.
 * The user explicitly submitted it, so this is the human-approval step.
 */
export async function POST(req: NextRequest) {
  const gate = requirePaid();
  if (!gate.ok) {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing`, 303);
  }

  const form = await req.formData();
  const job = {
    subreddit: String(form.get("subreddit") ?? "").trim(),
    title: String(form.get("title") ?? "").trim(),
    text: String(form.get("text") ?? ""),
    runAt: String(form.get("runAt") ?? ""),
    disclose: form.get("disclose") === "on",
  };

  if (!job.subreddit || !job.title || !job.runAt) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?error=missing`, 303);
  }

  // TODO: insert `job` into your jobs table for the worker to pick up, and
  // enforce POSTING_LIMITS.scheduledJobsPerAccount here.
  void job;

  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?queued=1`, 303);
}
