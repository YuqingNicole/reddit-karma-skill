import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  getUserByRedditUsername,
  getUserByStripeCustomerId,
  setStripeCustomer,
  setSubscription,
} from "@/lib/repo";
import type { Plan } from "@/lib/subscription";

// Stripe needs the raw body to verify the signature.
export const runtime = "nodejs";

function planFrom(value: unknown): Plan {
  return value === "starter" || value === "pro" ? value : "free";
}

/**
 * Stripe webhook — the source of truth for subscription state, written to the
 * DB (keyed by reddit username on first checkout, by stripe customer id after).
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "not configured" }, { status: 400 });
  }

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as any;
      const user = s.client_reference_id
        ? await getUserByRedditUsername(s.client_reference_id)
        : null;
      if (user) {
        if (s.customer) await setStripeCustomer(user.id, s.customer as string);
        await setSubscription(user.id, planFrom(s.metadata?.plan), "active");
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as any;
      const user = await getUserByStripeCustomerId(sub.customer as string);
      if (user) {
        const active = sub.status === "active" || sub.status === "trialing";
        const plan = planFrom(sub.metadata?.plan ?? user.plan);
        await setSubscription(user.id, active ? plan : "free", sub.status);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
