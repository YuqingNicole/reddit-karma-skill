import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Stripe needs the raw body to verify the signature.
export const runtime = "nodejs";

/**
 * Stripe webhook. On checkout.session.completed / subscription updates, set the
 * customer's plan in YOUR DATABASE (keyed by client_reference_id = reddit
 * username, or the Stripe customer id).
 *
 * Scaffold note: the cookie session can't be written from a webhook (no user
 * request context), so plan state MUST live in a DB in production. The TODOs
 * below mark where to write it.
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
  } catch (err) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as any;
      const plan = s.metadata?.plan; // "starter" | "pro"
      const redditUsername = s.client_reference_id;
      const stripeCustomerId = s.customer;
      // TODO: upsert user { redditUsername } -> { plan, stripeCustomerId, active: true }
      void plan;
      void redditUsername;
      void stripeCustomerId;
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as any;
      const active = sub.status === "active" || sub.status === "trialing";
      // TODO: update user by stripe customer id -> { active, plan: active ? plan : "free" }
      void active;
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
