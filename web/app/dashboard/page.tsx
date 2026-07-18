import { DailyLimits } from "@/components/RateLimitMeter";
import { getCurrentUser } from "@/lib/session";
import { countJobsByStatus, countSentSince } from "@/lib/repo";
import { getFreshAccessToken } from "@/lib/reddit-auth";
import { getInbox } from "@/lib/reddit";

function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Overview with live data pulled from the DB + official API. */
export default async function DashboardOverview() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects; keeps types happy

  const now = Date.now();
  const [pending, sentToday] = await Promise.all([
    countJobsByStatus(user.id, "pending"),
    countSentSince(user.id, startOfLocalDay(now)),
  ]);

  // Unread replies — best effort; don't fail the page if Reddit is unreachable.
  let unread = 0;
  try {
    const token = await getFreshAccessToken(user);
    if (token) unread = (await getInbox(token, 25)).filter((r) => r.isNew).length;
  } catch {
    unread = 0;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Plan" value={user.plan} />
        <Stat label="Scheduled posts" value={`${pending} queued`} />
        <Stat label="Unread replies" value={String(unread)} />
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="mb-4 font-semibold">Today&apos;s activity (rate-limited)</h2>
        <DailyLimits comments={0} posts={sentToday} />
        <p className="mt-4 text-xs text-neutral-500">
          Limits are enforced server-side and kept under Reddit&apos;s official API budget.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold capitalize">{value}</div>
    </div>
  );
}
