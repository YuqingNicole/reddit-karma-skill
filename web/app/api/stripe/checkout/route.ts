import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, PlanId } from "@/lib/stripe";
import { getSession } from "@/lib/session";

/**
 * Create a Stripe Checkout session for the chosen plan and redirect the user
 * to Stripe's hosted checkout. Requires a connected Reddit account so we can
 * tie the subscription to it.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session.redditUsername) {
    return NextResponse.redirect(`${process.env.APP_URL}/api/auth/reddit`, 303);
  }

  const form = await req.formData();
  const plan = String(form.get("plan")) as PlanId;
  if (plan !== "starter" && plan !== "pro") {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing?error=bad_plan`, 303);
  }

  try {
    const checkoutUrl = await createCheckoutSession({
      plan,
      customerId: session.stripeCustomerId,
      redditUsername: session.redditUsername,
    });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing?error=checkout_failed`, 303);
  }
}
