/**
 * Stripe client + subscription helpers (server-side only).
 */
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

export type PlanId = "starter" | "pro";

export function priceIdFor(plan: PlanId): string {
  const map: Record<PlanId, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
  };
  const price = map[plan];
  if (!price) throw new Error(`Missing Stripe price id for plan "${plan}" (see .env.example).`);
  return price;
}

export async function createCheckoutSession(opts: {
  plan: PlanId;
  customerId?: string;
  redditUsername?: string;
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(opts.plan), quantity: 1 }],
    customer: opts.customerId,
    client_reference_id: opts.redditUsername,
    success_url: `${process.env.APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.APP_URL}/pricing?checkout=cancelled`,
    metadata: { plan: opts.plan, redditUsername: opts.redditUsername ?? "" },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}
