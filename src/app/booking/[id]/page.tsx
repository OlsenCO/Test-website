import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/tokens";
import { confirmBooking, menteeCanCancel } from "@/lib/bookings";
import { MENTEE_CANCEL_CUTOFF_HOURS, isStripeConfigured } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Avatar, Notice } from "@/components/ui";
import { menteeCancel, submitReview } from "@/app/actions/booking";
import { LocalTime } from "@/components/LocalTime";

export const metadata = { title: "Your booking", robots: { index: false } };

/** If the webhook hasn't arrived yet, confirm directly from Checkout. */
async function reconcileWithStripe(bookingId: string, checkoutSessionId: string | null) {
  if (!isStripeConfigured() || !checkoutSessionId) return;
  try {
    const cs = await stripe().checkout.sessions.retrieve(checkoutSessionId);
    if (cs.payment_status === "paid") {
      const pi = typeof cs.payment_intent === "string" ? cs.payment_intent : (cs.payment_intent?.id ?? null);
      await confirmBooking(bookingId, { paymentIntentId: pi });
    }
  } catch (err) {
    console.error("[booking] reconcile failed", err);
  }
}

export default async function BookingPage({ params, searchParams }: PageProps<"/booking/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  const found = await db.booking.findUnique({ where: { id } });
  if (!found || !token || !safeEqual(found.accessToken, token)) notFound();

  if (found.status === "PENDING_PAYMENT" && sp.paid) {
    await reconcileWithStripe(found.id, found.stripeCheckoutSessionId);
  }
  const booking = await db.booking.findUniqueOrThrow({
    where: { id },
    include: {
      sessionType: true,
      review: true,
      mentor: { include: { user: { select: { name: true } } } },
    },
  });
  const { mentor, sessionType } = booking;
  const past = booking.endAt <= new Date();
  const confirmed = booking.status === "CONFIRMED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {confirmed && sp.paid && !past && (
        <div className="mb-6">
          <Notice tone="success">
            You&apos;re booked! A calendar invite with the video link is on its way to {booking.menteeEmail}.
          </Notice>
        </div>
      )}
      {sp.reviewed && (
        <div className="mb-6">
          <Notice tone="success">Thanks for the review. It helps other mentees find great mentors.</Notice>
        </div>
      )}
      {booking.status === "PENDING_PAYMENT" && sp.cancelled && (
        <div className="mb-6">
          <Notice tone="warn">Payment wasn&apos;t completed. Your slot is held for a few more minutes.</Notice>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center gap-4">
          <Avatar name={mentor.user.name} url={mentor.avatarUrl} size={56} />
          <div>
            <p className="text-sm text-muted">{sessionType.title} with</p>
            <Link href={`/m/${mentor.slug}`} className="text-lg font-semibold hover:text-accent">
              {mentor.user.name}
            </Link>
          </div>
          <StatusBadge status={booking.status} past={past} />
        </div>

        <dl className="mt-6 grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="text-muted">When</dt>
          <dd>
            <LocalTime iso={booking.startAt.toISOString()} fallback={formatDateTime(booking.startAt, mentor.timezone)} />
            <span className="text-muted"> · {sessionType.durationMinutes} min</span>
          </dd>
          <dt className="text-muted">Paid</dt>
          <dd>
            {formatMoney(booking.priceCents, booking.currency)}
            {booking.refunded && <span className="text-muted"> (refunded)</span>}
          </dd>
          {confirmed && booking.meetingUrl && (
            <>
              <dt className="text-muted">Video link</dt>
              <dd>
                <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
                  {booking.meetingUrl}
                </a>
              </dd>
            </>
          )}
        </dl>

        {confirmed && !past && (
          <div className="mt-6 flex flex-wrap gap-3">
            {booking.meetingUrl && (
              <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Join call
              </a>
            )}
            <a href={`/api/booking/${booking.id}/ics?token=${token}`} className="btn-secondary">
              Add to calendar (.ics)
            </a>
          </div>
        )}

        {booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt && booking.holdExpiresAt > new Date() && (
          <form action={menteeCancel} className="mt-6">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="token" value={token} />
            <p className="mb-3 text-sm text-muted">Waiting for payment confirmation…</p>
            <button className="btn-secondary">Release this slot</button>
          </form>
        )}
      </div>

      {confirmed && !past && (
        <div className="mt-6 text-sm">
          {menteeCanCancel(booking) ? (
            <form action={menteeCancel} className="flex items-center justify-between gap-4">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="token" value={token} />
              <p className="text-muted">Can&apos;t make it? Cancel for a full refund.</p>
              <button className="btn-danger">Cancel booking</button>
            </form>
          ) : (
            <p className="text-muted">
              It&apos;s within {MENTEE_CANCEL_CUTOFF_HOURS}h of the call, so it can no longer be cancelled for a refund.
            </p>
          )}
        </div>
      )}

      {confirmed && past && !booking.review && (
        <form action={submitReview} className="card mt-6 space-y-4 p-6">
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="token" value={token} />
          <h2 className="font-semibold">How was your call with {mentor.user.name.split(" ")[0]}?</h2>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Rating</legend>
            {[5, 4, 3, 2, 1].map((n) => (
              <label
                key={n}
                className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 dark:has-[:checked]:bg-amber-950"
              >
                <input type="radio" name="rating" value={n} required className="sr-only" defaultChecked={n === 5} />
                <span className="text-amber-500">{"★".repeat(n)}</span>
              </label>
            ))}
          </fieldset>
          <textarea name="comment" rows={3} maxLength={1500} className="input" placeholder="What was most useful? (shown publicly with your first name)" />
          <button className="btn-primary">Submit review</button>
        </form>
      )}
      {booking.review && (
        <p className="mt-6 text-sm text-muted">You rated this call {booking.review.rating}/5. Thanks!</p>
      )}
    </div>
  );
}

function StatusBadge({ status, past }: { status: string; past: boolean }) {
  const map: Record<string, [string, string]> = {
    CONFIRMED: past ? ["Completed", "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"] : ["Confirmed", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"],
    PENDING_PAYMENT: ["Awaiting payment", "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"],
    CANCELLED: ["Cancelled", "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"],
    EXPIRED: ["Expired", "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"],
  };
  const [label, cls] = map[status] ?? [status, ""];
  return <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}
