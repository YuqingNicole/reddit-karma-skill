import Link from "next/link";

export function Nav({ authed }: { authed?: boolean }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="inline-block h-6 w-6 rounded-full bg-brand" />
        autoreddit<span className="text-brand">.ai</span>
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/pricing" className="hover:text-brand">Pricing</Link>
        {authed ? (
          <Link href="/dashboard" className="hover:text-brand">Dashboard</Link>
        ) : (
          <a
            href="/api/auth/reddit"
            className="rounded-md bg-brand px-3 py-1.5 font-medium text-brand-fg"
          >
            Connect Reddit
          </a>
        )}
      </nav>
    </header>
  );
}
