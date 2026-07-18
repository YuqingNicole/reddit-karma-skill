import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getCurrentUser } from "@/lib/session";

const FEATURES = [
  {
    title: "Post scheduling",
    body: "Queue posts and let them go out at the right time — through Reddit's official API, within official rate limits, clearly marked as scheduled.",
  },
  {
    title: "Inbox management",
    body: "See every reply in one place and respond without tab-hopping. You write and send; nothing goes out on autopilot.",
  },
  {
    title: "AI drafting assistant",
    body: "Get draft suggestions for comments and posts. You review, edit, and approve — the AI never posts on its own or pretends to be someone else.",
  },
];

export default function Home() {
  const authed = Boolean(getCurrentUser());
  return (
    <main>
      <Nav authed={authed} />

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Run your Reddit presence,{" "}
          <span className="text-brand">the honest way.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
          autoreddit.ai schedules posts, organizes your inbox, and drafts with AI —
          all through Reddit&apos;s official API, with automation disclosed and every
          post approved by you.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href="/api/auth/reddit"
            className="rounded-md bg-brand px-5 py-2.5 font-medium text-brand-fg"
          >
            Connect Reddit
          </a>
          <Link
            href="/pricing"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-5 py-2.5 font-medium"
          >
            View pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Official Reddit API · No password sharing · Cancel anytime
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 grid gap-6 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-6"
          >
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold">How it stays compliant</h2>
          <ul className="mt-5 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
            <li>✅ Connects via Reddit OAuth — we never see or store your password.</li>
            <li>✅ Requests only the scopes needed, and stays under Reddit&apos;s API rate limits.</li>
            <li>✅ Anything that posts requires your explicit approval first.</li>
            <li>✅ Automation is disclosed in-app and can be footnoted on scheduled posts.</li>
            <li>✅ No fake personas, no detection evasion, no engagement botting.</li>
          </ul>
        </div>
      </section>

      <Footer />
    </main>
  );
}
