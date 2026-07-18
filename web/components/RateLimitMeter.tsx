import { POSTING_LIMITS } from "@/lib/compliance";

export function RateLimitMeter({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span>
          {used}/{max} today
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-2 rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DailyLimits({ comments, posts }: { comments: number; posts: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <RateLimitMeter label="Comments" used={comments} max={POSTING_LIMITS.commentsPerDay} />
      <RateLimitMeter label="Posts" used={posts} max={POSTING_LIMITS.postsPerDay} />
    </div>
  );
}
