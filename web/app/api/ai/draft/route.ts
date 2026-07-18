import { NextRequest, NextResponse } from "next/server";
import { requirePaid } from "@/lib/subscription";
import { DRAFTING_POLICY } from "@/lib/compliance";

/**
 * AI drafting. Returns a SUGGESTION only — the client shows it for human review
 * and never auto-sends (DRAFTING_POLICY.autoSend === false). The system prompt
 * forbids fake personas and disallowed content.
 *
 * If ANTHROPIC_API_KEY is set, we call the Claude API; otherwise we return a
 * clearly-marked placeholder so the scaffold runs without a key.
 */
const SYSTEM = [
  "You help a Reddit user draft a genuine, useful comment or post.",
  "Rules: write in the user's own voice as themselves — never invent a fake persona,",
  "never impersonate anyone, never fabricate experiences or credentials.",
  "No spam, no covert marketing, no vote manipulation. Keep it specific and honest.",
  "The user will review and edit before anything is posted.",
].join(" ");

export async function POST(req: NextRequest) {
  const gate = await requirePaid();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 402 });
  }

  const { context } = await req.json().catch(() => ({ context: "" }));
  if (!context || typeof context !== "string") {
    return NextResponse.json({ error: "Provide some context to draft from." }, { status: 400 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({
      draft:
        "[scaffold] Set ANTHROPIC_API_KEY to enable AI drafts. A real draft would " +
        "respond specifically to:\n\n" +
        context.slice(0, 240),
      policy: DRAFTING_POLICY,
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Draft a Reddit comment responding to this. Keep it 2-4 sentences, natural and specific:\n\n${context}`,
          },
        ],
      }),
    });
    const data = await res.json();
    const draft = data?.content?.[0]?.text ?? "";
    return NextResponse.json({ draft, policy: DRAFTING_POLICY });
  } catch {
    return NextResponse.json({ error: "Drafting failed. Try again." }, { status: 502 });
  }
}
