import { DailyLimits } from "@/components/RateLimitMeter";
import { currentPlan } from "@/lib/subscription";

/**
 * Overview. In production, read today's counts + connected-account karma from
 * your DB / the Reddit API. Values below are placeholders for the scaffold.
 */
export default function DashboardOverview() {
  const plan = currentPlan();
  const usage = { comments: 4, posts: 1 }; // TODO: load real counts

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Plan" value={plan} />
        <Stat label="Scheduled posts" value="3 queued" />
        <Stat label="Unread replies" value="2" />
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="mb-4 font-semibold">Today&apos;s activity (rate-limited)</h2>
        <DailyLimits comments={usage.comments} posts={usage.posts} />
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
