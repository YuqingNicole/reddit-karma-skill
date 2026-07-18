import { PaywallGate } from "@/components/PaywallGate";
import { requirePaid } from "@/lib/subscription";
import { getCurrentUser } from "@/lib/session";
import { listJobsForUser, type Job } from "@/lib/repo";

/**
 * Post scheduling. Submitting queues a job (POST /api/reddit/schedule); the
 * scheduler sends it via the official API at the chosen time, within rate
 * limits. Nothing sends without this explicit human action.
 */
export default function SchedulePage() {
  const gate = requirePaid();
  const user = getCurrentUser();
  const jobs = gate.ok && user ? listJobsForUser(user.id, 25) : [];

  return (
    <PaywallGate ok={gate.ok} reason={"reason" in gate ? gate.reason : undefined}>
      <div className="grid gap-8 lg:grid-cols-2">
        <form action="/api/reddit/schedule" method="POST" className="space-y-4">
          <h2 className="font-semibold">Schedule a post</h2>
          <Field name="subreddit" label="Subreddit" placeholder="SideProject" required />
          <Field name="title" label="Title" placeholder="What did you build?" required />
          <div>
            <label className="block text-sm font-medium">Body (self post)</label>
            <textarea
              name="text"
              rows={5}
              className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent p-2 text-sm"
              placeholder="Markdown supported… (leave blank and fill URL below for a link post)"
            />
          </div>
          <Field name="url" label="Link URL (for link posts)" placeholder="https://…" />
          <Field name="runAt" label="Send at" type="datetime-local" required />
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" name="disclose" defaultChecked />
            Add a small &ldquo;Scheduled with autoreddit.ai&rdquo; footer
          </label>
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg">
            Queue post
          </button>
        </form>

        <div>
          <h2 className="font-semibold">Queue</h2>
          {jobs.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Nothing scheduled yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {jobs.map((j) => (
                <QueueRow key={j.id} job={j} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </PaywallGate>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-600",
  processing: "text-blue-600",
  sent: "text-green-600",
  failed: "text-red-600",
  canceled: "text-neutral-400 line-through",
};

function QueueRow({ job }: { job: Job }) {
  return (
    <li className="rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="truncate">
          <span className="text-neutral-500">r/{job.subreddit}</span> · {job.title}
        </span>
        <span className={`ml-2 shrink-0 text-xs ${STATUS_STYLE[job.status] ?? ""}`}>
          {job.status}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
        <span>{new Date(job.run_at).toLocaleString()}</span>
        {job.status === "pending" && (
          <form action="/api/reddit/schedule/cancel" method="POST">
            <input type="hidden" name="jobId" value={job.id} />
            <button className="text-red-500 hover:underline">Cancel</button>
          </form>
        )}
        {job.status === "sent" && job.result_url && (
          <a href={job.result_url} className="text-brand hover:underline" target="_blank" rel="noreferrer">
            view
          </a>
        )}
        {job.status === "failed" && job.error && (
          <span className="max-w-[50%] truncate text-red-500" title={job.error}>
            {job.error}
          </span>
        )}
      </div>
    </li>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent p-2 text-sm"
      />
    </div>
  );
}
