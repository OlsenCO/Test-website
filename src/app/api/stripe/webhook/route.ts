import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { confirmBooking, markExpired } from "@/lib/bookings";

/**
 * Stripe webhook. Subscribe to:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.expired, account.updated (Connect)
 * For account.updated, enable "Listen to events on Connected accounts".
 */
export async function POST(req: NextRequest) {
  // Platform and Connect endpoints have separate signing secrets.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (secrets.length === 0) return new NextResponse("Webhook secret not configured", { status: 500 });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) return new NextResponse("Invalid signature", { status: 400 });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const cs = event.data.object;
      const bookingId = cs.metadata?.bookingId;
      if (bookingId && cs.payment_status === "paid") {
        const pi = typeof cs.payment_intent === "string" ? cs.payment_intent : (cs.payment_intent?.id ?? null);
        await confirmBooking(bookingId, { paymentIntentId: pi });
      }
      break;
    }
    case "checkout.session.expired":
      await markExpired(event.data.object.id);
      break;
    case "account.updated": {
      const acct = event.data.object;
      await db.mentorProfile.updateMany({
        where: { stripeAccountId: acct.id },
        data: { stripeChargesEnabled: acct.charges_enabled, stripeDetailsSubmitted: acct.details_submitted },
      });
      break;
    }
  }
  return NextResponse.json({ received: true });
}
