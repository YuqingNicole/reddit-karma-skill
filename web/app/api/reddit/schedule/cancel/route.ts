import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { cancelJob } from "@/lib/repo";

/** Cancel a still-pending scheduled post the user owns. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${process.env.APP_URL}/api/auth/reddit`, 303);
  }
  const form = await req.formData();
  const jobId = String(form.get("jobId") ?? "");
  if (jobId) await cancelJob(jobId, user.id);
  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/schedule?canceled=1`, 303);
}
