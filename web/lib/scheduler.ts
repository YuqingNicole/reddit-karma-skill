/**
 * Scheduler core: send due scheduled posts through the official API.
 *
 * Pure logic, driven by /api/cron/dispatch (Vercel Cron or any cron) or the
 * standalone worker in worker/worker.mjs. Every send:
 *  - goes through the official API with a fresh token (refreshed if needed),
 *  - is spaced by the write rate-limiter in lib/reddit.ts,
 *  - respects the per-account daily post cap (defers instead of over-posting).
 */
import {
  claimDueJobs,
  countSentSince,
  getUserById,
  markJobFailed,
  markJobSent,
  requeueJob,
  type Job,
} from "./repo";
import { getFreshAccessToken } from "./reddit-auth";
import { submitPost } from "./reddit";
import { POSTING_LIMITS } from "./compliance";

function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface JobResult {
  id: string;
  status: "sent" | "failed" | "deferred";
  detail?: string;
}

export async function runDueScheduledPosts(limit = 10): Promise<{
  claimed: number;
  results: JobResult[];
}> {
  const now = Date.now();
  const jobs = await claimDueJobs(now, limit);
  const results: JobResult[] = [];

  for (const job of jobs) {
    results.push(await sendOne(job, now));
  }
  return { claimed: jobs.length, results };
}

async function sendOne(job: Job, now: number): Promise<JobResult> {
  const user = await getUserById(job.user_id);
  if (!user) {
    await markJobFailed(job.id, "user not found");
    return { id: job.id, status: "failed", detail: "user not found" };
  }

  // Daily cap: don't exceed POSTING_LIMITS.postsPerDay. Defer to next hour.
  const sentToday = await countSentSince(user.id, startOfLocalDay(now));
  if (sentToday >= POSTING_LIMITS.postsPerDay) {
    await requeueJob(job.id, now + 60 * 60 * 1000);
    return { id: job.id, status: "deferred", detail: "daily post cap reached" };
  }

  const token = await getFreshAccessToken(user);
  if (!token) {
    await markJobFailed(job.id, "no valid Reddit token — user must reconnect");
    return { id: job.id, status: "failed", detail: "no token" };
  }

  try {
    const res = await submitPost(token, {
      subreddit: job.subreddit,
      title: job.title,
      text: job.kind === "self" ? job.body ?? "" : undefined,
      url: job.kind === "link" ? job.url ?? "" : undefined,
      disclose: job.disclose,
    });
    if (res.errors.length) {
      const msg = JSON.stringify(res.errors);
      await markJobFailed(job.id, msg);
      return { id: job.id, status: "failed", detail: msg };
    }
    await markJobSent(job.id, res.url);
    return { id: job.id, status: "sent", detail: res.url ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markJobFailed(job.id, msg);
    return { id: job.id, status: "failed", detail: msg };
  }
}
