import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, PlanId } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/session";

/**
 * Create a Stripe Checkout session for the chosen plan and redirect to Stripe's
 * hosted checkout. Requires a connected Reddit account so the resulting
 * subscription can be tied to the DB user.
 */
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) {
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
      customerId: user.stripe_customer_id ?? undefined,
      redditUsername: user.reddit_username,
    });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing?error=checkout_failed`, 303);
  }
}
