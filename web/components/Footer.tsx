export const SUPPORT = {
  email: "support@autoreddit.ai",
  wechat: "c1426217526",
} as const;

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-5xl px-6 py-10 text-xs text-neutral-500">
        <p className="font-medium text-neutral-600 dark:text-neutral-400">Need help?</p>
        <p className="mt-1">
          Email{" "}
          <a href={`mailto:${SUPPORT.email}`} className="text-brand hover:underline">
            {SUPPORT.email}
          </a>{" "}
          · WeChat <span className="font-mono">{SUPPORT.wechat}</span>
        </p>
        <p className="mt-4">© autoreddit.ai · Not affiliated with Reddit, Inc.</p>
      </div>
    </footer>
  );
}
