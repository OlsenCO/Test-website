import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, isStripeConfigured } from "@/lib/config";
import { createOnboardingLink } from "@/lib/stripe";
import { randomToken } from "@/lib/tokens";

/** Starts (or resumes) Stripe Connect Express onboarding for the mentor. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.mentor) return NextResponse.redirect(`${appUrl()}/login`);
  const mentor = user.mentor;

  if (!isStripeConfigured()) {
    // Dev mode: pretend onboarding succeeded so the booking flow is testable.
    await db.mentorProfile.update({
      where: { id: mentor.id },
      data: {
        stripeAccountId: mentor.stripeAccountId ?? `acct_test_${randomToken(8)}`,
        stripeChargesEnabled: true,
        stripeDetailsSubmitted: true,
      },
    });
    return NextResponse.redirect(`${appUrl()}/dashboard/integrations?stripe=connected`);
  }

  const { accountId, url } = await createOnboardingLink({
    accountId: mentor.stripeAccountId,
    email: user.email,
    mentorId: mentor.id,
  });
  if (accountId !== mentor.stripeAccountId) {
    await db.mentorProfile.update({ where: { id: mentor.id }, data: { stripeAccountId: accountId } });
  }
  return NextResponse.redirect(url);
}
