import { PaywallGate } from "@/components/PaywallGate";
import { requirePaid } from "@/lib/subscription";

/**
 * Post scheduling. Submitting queues a job (POST /api/reddit/schedule); a
 * background worker sends it via the official API at the chosen time, within
 * rate limits. Nothing sends without this explicit human action.
 */
export default function SchedulePage() {
  const gate = requirePaid();

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
              rows={6}
              className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent p-2 text-sm"
              placeholder="Markdown supported…"
            />
          </div>
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
          <ul className="mt-3 space-y-2 text-sm">
            {/* TODO: load from DB */}
            <QueueItem sub="SideProject" title="I shipped v2 of my tool" when="Today 21:00" />
            <QueueItem sub="indiehackers" title="What I learned launching" when="Tomorrow 08:00" />
          </ul>
        </div>
      </div>
    </PaywallGate>
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

function QueueItem({ sub, title, when }: { sub: string; title: string; when: string }) {
  return (
    <li className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2">
      <span>
        <span className="text-neutral-500">r/{sub}</span> · {title}
      </span>
      <span className="text-xs text-neutral-500">{when}</span>
    </li>
  );
}
