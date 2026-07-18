import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PLANS } from "@/lib/subscription";
import { getCurrentUser } from "@/lib/session";

export default function PricingPage() {
  const authed = Boolean(getCurrentUser());
  const plans = [
    { id: "starter" as const, ...PLANS.starter },
    { id: "pro" as const, ...PLANS.pro, highlight: true },
  ];
  return (
    <main>
      <Nav authed={authed} />
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold">Simple, honest pricing</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Read-only views are free. Scheduling, inbox replies, and AI drafting need a plan.
        </p>
      </section>

      <section className="mx-auto grid max-w-3xl gap-6 px-6 pb-24 sm:grid-cols-2">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border p-8 ${
              "highlight" in p && p.highlight
                ? "border-brand ring-1 ring-brand"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="mt-2 text-3xl font-bold">{p.price}</p>
            <ul className="mt-5 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              {p.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            {/* Checkout is a POST so the server can create the Stripe session. */}
            <form action="/api/stripe/checkout" method="POST" className="mt-6">
              <input type="hidden" name="plan" value={p.id} />
              <button
                type="submit"
                className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-brand-fg"
              >
                {authed ? `Choose ${p.name}` : "Connect Reddit to subscribe"}
              </button>
            </form>
          </div>
        ))}
      </section>
      <Footer />
    </main>
  );
}
