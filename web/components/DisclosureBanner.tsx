import { DISCLOSURE } from "@/lib/compliance";

export function DisclosureBanner() {
  return (
    <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
      <strong className="text-brand">Automation, disclosed.</strong>{" "}
      {DISCLOSURE.bannerText}
    </div>
  );
}
