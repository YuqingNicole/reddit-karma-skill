import { NextRequest, NextResponse } from "next/server";
import { requirePaid } from "@/lib/subscription";
import { getCurrentUser } from "@/lib/session";
import { getFreshAccessToken } from "@/lib/reddit-auth";
import { submitComment } from "@/lib/reddit";

/**
 * Send a reply the user typed, through the official API. Human writes + submits;
 * nothing automated posts here.
 */
export async function POST(req: NextRequest) {
  const gate = await requirePaid();
  if (!gate.ok) {
    return NextResponse.redirect(`${process.env.APP_URL}/pricing`, 303);
  }
  const user = await getCurrentUser();
  const form = await req.formData();
  const thingId = String(form.get("thingId") ?? "");
  const text = String(form.get("text") ?? "").trim();

  if (!user || !thingId || !text) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?error=missing`, 303);
  }

  const token = await getFreshAccessToken(user);
  if (!token) {
    return NextResponse.redirect(`${process.env.APP_URL}/api/auth/reddit`, 303);
  }

  try {
    const { errors } = await submitComment(token, thingId, text);
    if (errors.length) {
      return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?error=reddit`, 303);
    }
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?error=failed`, 303);
  }

  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/inbox?replied=1`, 303);
}
