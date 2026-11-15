import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/config";
import { safeEqual } from "@/lib/tokens";
import { formatMoney } from "@/lib/format";
import { simulatePayment } from "@/app/actions/booking";
import { Notice } from "@/components/ui";

export const metadata = { title: "Test checkout", robots: { index: false } };

/** Stand-in for Stripe Checkout so the full flow works with zero setup. */
export default async function DevCheckout({ params, searchParams }: PageProps<"/dev/checkout/[id]">) {
  if (isStripeConfigured()) notFound();
  const { id } = await params;
  const { token } = await searchParams;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { sessionType: true, mentor: { include: { user: { select: { name: true } } } } },
  });
  if (!booking || typeof token !== "string" || !safeEqual(booking.accessToken, token)) notFound();
  const mentorShare = booking.priceCents - booking.platformFeeCents;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Notice tone="warn">
        <strong>Test mode.</strong> Stripe isn&apos;t configured (no <code>STRIPE_SECRET_KEY</code>), so this page
        simulates Checkout. No card is charged.
      </Notice>
      <div className="card mt-6 p-6">
        <p className="text-sm text-muted">Pay</p>
        <p className="text-3xl font-semibold">{formatMoney(booking.priceCents, booking.currency)}</p>
        <p className="mt-2 text-sm">
          {booking.sessionType.title} with {booking.mentor.user.name}
        </p>
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-xs text-muted">
          <div className="flex justify-between">
            <dt>Mentor receives</dt>
            <dd>{formatMoney(mentorShare, booking.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Platform fee</dt>
            <dd>{formatMoney(booking.platformFeeCents, booking.currency)}</dd>
          </div>
        </dl>
        <form action={simulatePayment} className="mt-6">
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="token" value={token} />
          <button className="btn-primary w-full" disabled={booking.status !== "PENDING_PAYMENT"}>
            {booking.status === "PENDING_PAYMENT" ? "Simulate successful payment" : `Booking is ${booking.status.toLowerCase()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
