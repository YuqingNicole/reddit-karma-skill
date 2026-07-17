import Link from "next/link";

/**
 * Wraps a paid feature. If the user has no active plan, renders an upgrade
 * prompt instead of the feature. Server component — checks the session.
 */
export function PaywallGate({
  ok,
  reason,
  children,
}: {
  ok: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  if (ok) return <>{children}</>;
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center">
      <h3 className="text-lg font-semibold">Upgrade to use this</h3>
      <p className="mt-1 text-sm text-neutral-500">{reason ?? "This feature requires a paid plan."}</p>
      <Link
        href="/pricing"
        className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
      >
        See plans
      </Link>
    </div>
  );
}
