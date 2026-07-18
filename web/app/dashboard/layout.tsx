import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DisclosureBanner } from "@/components/DisclosureBanner";
import { getCurrentUser } from "@/lib/session";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/schedule", label: "Schedule" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/drafts", label: "AI Drafts" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user) redirect("/api/auth/reddit");

  return (
    <main>
      <Nav authed />
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-neutral-500">
              u/{user.reddit_username} · {user.plan} plan
            </p>
          </div>
        </div>

        <DisclosureBanner />

        <nav className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-brand dark:text-neutral-400"
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  );
}
