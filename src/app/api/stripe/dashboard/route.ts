import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { appUrl, isStripeConfigured } from "@/lib/config";
import { createExpressDashboardLink } from "@/lib/stripe";

/** Sends the mentor to their Stripe Express dashboard (payouts, tax forms). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.mentor?.stripeAccountId || !isStripeConfigured()) {
    return NextResponse.redirect(`${appUrl()}/dashboard/integrations`);
  }
  return NextResponse.redirect(await createExpressDashboardLink(user.mentor.stripeAccountId));
}
