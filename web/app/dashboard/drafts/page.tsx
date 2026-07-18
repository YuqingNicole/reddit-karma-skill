import { PaywallGate } from "@/components/PaywallGate";
import { requirePaid } from "@/lib/subscription";
import { DraftAssistant } from "./DraftAssistant";

export default async function DraftsPage() {
  const gate = await requirePaid();
  return (
    <PaywallGate ok={gate.ok} reason={"reason" in gate ? gate.reason : undefined}>
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">AI drafting assistant</h2>
          <p className="text-sm text-neutral-500">
            The assistant suggests a draft. You edit and approve — it never posts on
            its own, and won&apos;t write as a fake persona.
          </p>
        </div>
        <DraftAssistant />
      </div>
    </PaywallGate>
  );
}
