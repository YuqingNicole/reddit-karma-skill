/**
 * Paywall gating. Plan now comes from the DB user record (via the session),
 * not from the cookie.
 */
import { getCurrentUser } from "./session";

export type Plan = "free" | "starter" | "pro";

export const PLANS = {
  starter: {
    name: "Starter",
    price: "$12/mo",
    priceEnv: "STRIPE_PRICE_STARTER",
    features: ["1 Reddit account", "Post scheduling", "Inbox management", "50 AI drafts / mo"],
  },
  pro: {
    name: "Pro",
    price: "$29/mo",
    priceEnv: "STRIPE_PRICE_PRO",
    features: ["3 Reddit accounts", "Everything in Starter", "Unlimited AI drafts", "Priority queue"],
  },
} as const;

export async function currentPlan(): Promise<Plan> {
  return (await getCurrentUser())?.plan ?? "free";
}

export async function hasActivePlan(): Promise<boolean> {
  return (await currentPlan()) !== "free";
}

/** Feature gate used by server components / route handlers. */
export async function requirePaid(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "Connect your Reddit account first." };
  }
  if (user.plan === "free") {
    return { ok: false, reason: "This feature requires an active subscription." };
  }
  return { ok: true };
}
