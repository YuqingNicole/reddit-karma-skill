import { NextRequest, NextResponse } from "next/server";
import { requirePaid } from "@/lib/subscription";
import { getCurrentUser } from "@/lib/session";
import { countJobsForUser, createJob } from "@/lib/repo";
import { POSTING_LIMITS } from "@/lib/compliance";

/**
 * Queue a scheduled post. This records a job in the DB; the scheduler
 * (/api/cron/dispatch or the worker) sends it at runAt via the official API,
 * within rate limits. The user explicitly submitted it — the human-approval step.
 */
export async function POST(req: NextRequest) {
  const gate = await requirePaid();
  if (!gate.ok) {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing`, 303);
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${process.env.APP_URL}/api/auth/reddit`, 303);
  }

  const form = await req.formData();
  const subreddit = String(form.get("subreddit") ?? "").trim().replace(/^r\//, "");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("text") ?? "");
  const url = String(form.get("url") ?? "").trim();
  const runAtRaw = String(form.get("runAt") ?? "");
  const disclose = form.get("disclose") === "on";

  const runAt = Date.parse(runAtRaw); // datetime-local -> local time
  const kind: "self" | "link" = url ? "link" : "self";

  if (!subreddit || !title || Number.isNaN(runAt)) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?error=missing`, 303);
  }
  if (runAt < Date.now() - 60_000) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?error=past`, 303);
  }
  if ((await countJobsForUser(user.id)) >= POSTING_LIMITS.scheduledJobsPerAccount) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?error=limit`, 303);
  }

  await createJob({
    userId: user.id,
    kind,
    subreddit,
    title,
    body: kind === "self" ? body : undefined,
    url: kind === "link" ? url : undefined,
    disclose,
    runAt,
  });

  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?queued=1`, 303);
}
