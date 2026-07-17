import { NextRequest, NextResponse } from "next/server";
import { requirePaid } from "@/lib/subscription";
import { getSession } from "@/lib/session";
import { submitComment } from "@/lib/reddit";

/**
 * Send a reply the user typed, through the official API. Human writes + submits;
 * nothing automated posts here.
 */
export async function POST(req: NextRequest) {
  const gate = requirePaid();
  if (!gate.ok) {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing`, 303);
  }
  const session = getSession();
  const form = await req.formData();
  const thingId = String(form.get("thingId") ?? "");
  const text = String(form.get("text") ?? "").trim();

  if (!session.redditAccessToken || !thingId || !text) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?error=missing`, 303);
  }

  try {
    const { errors } = await submitComment(session.redditAccessToken, thingId, text);
    if (errors.length) {
      return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?error=reddit`, 303);
    }
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?error=failed`, 303);
  }

  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?replied=1`, 303);
}
