"use client";

import { useState } from "react";

/**
 * Human-in-the-loop drafting. Generate -> edit -> approve. "Approve" is the
 * only path that sends, and it goes through the official-API route with the
 * final, human-edited text.
 */
export function DraftAssistant() {
  const [context, setContext] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);

  async function generate() {
    setLoading(true);
    setApproved(false);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const data = await res.json();
      setDraft(data.draft ?? "");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          What are you responding to? (paste the post/comment, or describe the topic)
        </label>
        <textarea
          rows={8}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent p-2 text-sm"
          placeholder="e.g. A thread asking how people stay consistent shipping side projects…"
        />
        <button
          onClick={generate}
          disabled={loading || !context.trim()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {loading ? "Drafting…" : "Suggest a draft"}
        </button>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Draft (edit before approving)</label>
        <textarea
          rows={8}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setApproved(false);
          }}
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent p-2 text-sm"
          placeholder="Your reviewed draft appears here…"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setApproved(true)}
            disabled={!draft.trim()}
            className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand disabled:opacity-50"
          >
            Approve
          </button>
          {approved && (
            <span className="text-xs text-neutral-500">
              Approved — send it from Schedule or reply in Inbox.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
