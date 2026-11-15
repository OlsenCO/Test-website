import "server-only";
import Stripe from "stripe";
import { appUrl, isStripeConfigured } from "./config";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/**
 * Creates (once) a Stripe Connect Express account for the mentor and returns
 * an onboarding link. Express keeps payouts/KYC on Stripe's side so we never
 * touch bank details.
 */
export async function createOnboardingLink(opts: {
  accountId: string | null;
  email: string;
  mentorId: string;
}): Promise<{ accountId: string; url: string }> {
  const s = stripe();
  let accountId = opts.accountId;
  if (!accountId) {
    const account = await s.accounts.create({
      type: "express",
      email: opts.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        product_description: "Paid 1:1 career mentorship calls",
        mcc: "8299", // Schools and educational services
      },
      metadata: { mentorId: opts.mentorId },
    });
    accountId = account.id;
  }
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/api/stripe/connect`,
    return_url: `${appUrl()}/api/stripe/connect/return`,
  });
  return { accountId, url: link.url };
}

export async function getAccountStatus(accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

export async function createExpressDashboardLink(accountId: string): Promise<string> {
  const link = await stripe().accounts.createLoginLink(accountId);
  return link.url;
}

/**
 * Destination charge: the mentee pays the platform, Stripe automatically
 * transfers (price - application fee) to the mentor's connected account.
 */
export async function createCheckoutSession(opts: {
  bookingId: string;
  accessToken: string;
  connectedAccountId: string;
  title: string;
  description: string;
  priceCents: number;
  feeCents: number;
  currency: string;
  menteeEmail: string;
  expiresAt: Date;
}) {
  return stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: opts.menteeEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: opts.currency,
          unit_amount: opts.priceCents,
          product_data: { name: opts.title, description: opts.description.slice(0, 500) || undefined },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: opts.feeCents,
      transfer_data: { destination: opts.connectedAccountId },
      metadata: { bookingId: opts.bookingId },
    },
    metadata: { bookingId: opts.bookingId },
    client_reference_id: opts.bookingId,
    expires_at: Math.floor(opts.expiresAt.getTime() / 1000),
    success_url: `${appUrl()}/booking/${opts.bookingId}?token=${opts.accessToken}&paid=1`,
    cancel_url: `${appUrl()}/booking/${opts.bookingId}?token=${opts.accessToken}&cancelled=1`,
  });
}

/** Full refund that also claws back the mentor transfer and our fee. */
export async function refundPayment(paymentIntentId: string) {
  return stripe().refunds.create({
    payment_intent: paymentIntentId,
    reverse_transfer: true,
    refund_application_fee: true,
  });
}
