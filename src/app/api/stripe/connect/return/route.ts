import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, isStripeConfigured } from "@/lib/config";
import { getAccountStatus } from "@/lib/stripe";

/** Stripe sends the mentor back here after onboarding; sync account status. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.mentor) return NextResponse.redirect(`${appUrl()}/login`);
  const { mentor } = user;
  if (isStripeConfigured() && mentor.stripeAccountId) {
    const status = await getAccountStatus(mentor.stripeAccountId);
    await db.mentorProfile.update({
      where: { id: mentor.id },
      data: { stripeChargesEnabled: status.chargesEnabled, stripeDetailsSubmitted: status.detailsSubmitted },
    });
  }
  return NextResponse.redirect(`${appUrl()}/dashboard/integrations?stripe=returned`);
}
