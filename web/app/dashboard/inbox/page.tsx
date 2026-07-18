import { PaywallGate } from "@/components/PaywallGate";
import { requirePaid } from "@/lib/subscription";
import { getInbox } from "@/lib/reddit";
import { getCurrentUser } from "@/lib/session";
import { getFreshAccessToken } from "@/lib/reddit-auth";

/**
 * Inbox management. Loads replies via the official API. Replying posts through
 * the official API too — you type it, you send it.
 */
export default async function InboxPage() {
  const gate = requirePaid();
  const user = getCurrentUser();

  let replies: Awaited<ReturnType<typeof getInbox>> = [];
  let loadError: string | null = null;
  if (gate.ok && user) {
    const token = await getFreshAccessToken(user);
    if (token) {
      try {
        replies = await getInbox(token, 25);
      } catch (e) {
        loadError = "Could not load inbox — reconnect Reddit if this persists.";
      }
    } else {
      loadError = "Reddit session expired — reconnect your account.";
    }
  }

  return (
    <PaywallGate ok={gate.ok} reason={"reason" in gate ? gate.reason : undefined}>
      <h2 className="mb-4 font-semibold">Replies</h2>
      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {!loadError && replies.length === 0 && (
        <p className="text-sm text-neutral-500">No replies right now.</p>
      )}
      <ul className="space-y-3">
        {replies.map((r) => (
          <li key={r.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>
                <strong>u/{r.from}</strong>{" "}
                <span className="text-neutral-500">in r/{r.subreddit}</span>
              </span>
              {r.isNew && <span className="text-xs text-brand">new</span>}
            </div>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{r.body}</p>
            {/* Reply posts via official API on submit; human writes + sends. */}
            <form action="/api/reddit/reply" method="POST" className="mt-3 flex gap-2">
              <input type="hidden" name="thingId" value={r.id} />
              <input
                name="text"
                placeholder="Write a reply…"
                className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
              />
              <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg">
                Reply
              </button>
            </form>
          </li>
        ))}
      </ul>
    </PaywallGate>
  );
}
