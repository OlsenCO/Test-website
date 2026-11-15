import "server-only";
import { Prisma, type Booking, type MentorProfile, type SessionType } from "@prisma/client";
import { db } from "./db";
import {
  APP_NAME,
  CHECKOUT_HOLD_MINUTES,
  MENTEE_CANCEL_CUTOFF_HOURS,
  appUrl,
  isStripeConfigured,
  platformFeeCents,
} from "./config";
import { generateSlots, type Busy } from "./slots";
import { cancelMeetingEvent, createMeetingEvent, getBusy } from "./google";
import { createCheckoutSession, refundPayment } from "./stripe";
import { randomToken } from "./tokens";
import { buildIcs } from "./ics";
import { sendEmail } from "./email";
import { formatDateTime } from "./format";

type MentorWithUser = MentorProfile & { user: { name: string; email: string } };

export class BookingError extends Error {}

/** Bookings that currently block a time slot. */
function blockingBookingsWhere(mentorId: string, from: Date, to: Date): Prisma.BookingWhereInput {
  return {
    mentorId,
    startAt: { lt: to },
    endAt: { gt: from },
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } },
    ],
  };
}

async function busyFor(mentor: MentorProfile, from: Date, to: Date): Promise<Busy[]> {
  const [bookings, google] = await Promise.all([
    db.booking.findMany({
      where: blockingBookingsWhere(mentor.id, from, to),
      select: { startAt: true, endAt: true },
    }),
    getBusy(mentor, from, to),
  ]);
  return [...bookings.map((b) => ({ start: b.startAt, end: b.endAt })), ...google];
}

export async function availableSlots(mentor: MentorProfile, sessionType: SessionType): Promise<Date[]> {
  const rules = await db.availabilityRule.findMany({ where: { mentorId: mentor.id } });
  const now = new Date();
  const until = new Date(now.getTime() + (mentor.maxDaysAhead + 1) * 864e5);
  const busy = await busyFor(mentor, now, until);
  return generateSlots({
    rules,
    mentorTz: mentor.timezone,
    durationMinutes: sessionType.durationMinutes,
    bufferMinutes: mentor.bufferMinutes,
    minNoticeHours: mentor.minNoticeHours,
    maxDaysAhead: mentor.maxDaysAhead,
    busy,
    now,
  });
}

export function canAcceptBookings(mentor: MentorProfile): boolean {
  return mentor.published && Boolean(mentor.stripeAccountId) && mentor.stripeChargesEnabled;
}

/**
 * Validates the requested slot against live availability and places a
 * short hold on it while the mentee pays. Returns the URL to send them to.
 */
export async function startBooking(input: {
  sessionTypeId: string;
  startIso: string;
  menteeName: string;
  menteeEmail: string;
  menteeNotes: string;
}): Promise<{ redirectUrl: string; bookingId: string }> {
  const sessionType = await db.sessionType.findUnique({
    where: { id: input.sessionTypeId },
    include: { mentor: { include: { user: { select: { name: true, email: true } } } } },
  });
  if (!sessionType || !sessionType.active) throw new BookingError("This session is no longer offered.");
  const mentor = sessionType.mentor;
  if (!canAcceptBookings(mentor)) throw new BookingError("This mentor isn't accepting bookings right now.");

  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) throw new BookingError("Invalid time.");
  const end = new Date(start.getTime() + sessionType.durationMinutes * 60_000);

  // Re-derive availability server-side; never trust the client's slot list.
  const rules = await db.availabilityRule.findMany({ where: { mentorId: mentor.id } });
  const windowFrom = new Date(start.getTime() - 864e5);
  const windowTo = new Date(end.getTime() + 864e5);
  const busy = await getBusy(mentor, windowFrom, windowTo);
  const dbBusy = await db.booking.findMany({
    where: blockingBookingsWhere(mentor.id, windowFrom, windowTo),
    select: { startAt: true, endAt: true },
  });
  const valid = generateSlots({
    rules,
    mentorTz: mentor.timezone,
    durationMinutes: sessionType.durationMinutes,
    bufferMinutes: mentor.bufferMinutes,
    minNoticeHours: mentor.minNoticeHours,
    maxDaysAhead: mentor.maxDaysAhead,
    busy: [...busy, ...dbBusy.map((b) => ({ start: b.startAt, end: b.endAt }))],
  }).some((s) => s.getTime() === start.getTime());
  if (!valid) throw new BookingError("That time was just taken. Please pick another slot.");

  const holdExpiresAt = new Date(Date.now() + (CHECKOUT_HOLD_MINUTES + 1) * 60_000);
  const accessToken = randomToken(24);
  const feeCents = platformFeeCents(sessionType.priceCents);
  const bufferMs = mentor.bufferMinutes * 60_000;

  // Serializable transaction so two mentees can't grab the same slot.
  const booking = await db.$transaction(
    async (tx) => {
      const clash = await tx.booking.findFirst({
        where: blockingBookingsWhere(
          mentor.id,
          new Date(start.getTime() - bufferMs),
          new Date(end.getTime() + bufferMs),
        ),
      });
      if (clash) throw new BookingError("That time was just taken. Please pick another slot.");
      return tx.booking.create({
        data: {
          mentorId: mentor.id,
          sessionTypeId: sessionType.id,
          menteeName: input.menteeName,
          menteeEmail: input.menteeEmail,
          menteeNotes: input.menteeNotes,
          startAt: start,
          endAt: end,
          status: "PENDING_PAYMENT",
          holdExpiresAt,
          priceCents: sessionType.priceCents,
          platformFeeCents: feeCents,
          currency: sessionType.currency,
          accessToken,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (!isStripeConfigured()) {
    // Dev mode: simulated checkout page.
    return {
      bookingId: booking.id,
      redirectUrl: `/dev/checkout/${booking.id}?token=${accessToken}`,
    };
  }

  const checkout = await createCheckoutSession({
    bookingId: booking.id,
    accessToken,
    connectedAccountId: mentor.stripeAccountId!,
    title: `${sessionType.title} with ${mentor.user.name}`,
    description: `${sessionType.durationMinutes}-minute video call · ${formatDateTime(start, mentor.timezone)}`,
    priceCents: sessionType.priceCents,
    feeCents,
    currency: sessionType.currency,
    menteeEmail: input.menteeEmail,
    expiresAt: new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60_000),
  });
  await db.booking.update({
    where: { id: booking.id },
    data: { stripeCheckoutSessionId: checkout.id },
  });
  return { bookingId: booking.id, redirectUrl: checkout.url! };
}

/**
 * Marks a booking paid + confirmed, then creates the calendar invite and
 * video link. Idempotent: safe to call from both the webhook and the
 * success-page fallback.
 */
export async function confirmBooking(
  bookingId: string,
  payment: { paymentIntentId: string | null },
): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === "CONFIRMED") return;

  if (booking.status !== "PENDING_PAYMENT" && booking.status !== "EXPIRED") return;

  // If the hold lapsed and someone else took the slot, refund instead.
  const clash = await db.booking.findFirst({
    where: {
      id: { not: booking.id },
      mentorId: booking.mentorId,
      status: "CONFIRMED",
      startAt: { lt: booking.endAt },
      endAt: { gt: booking.startAt },
    },
  });
  if (clash) {
    if (payment.paymentIntentId && isStripeConfigured()) await refundPayment(payment.paymentIntentId);
    await db.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledBy: "system",
        refunded: Boolean(payment.paymentIntentId),
        stripePaymentIntentId: payment.paymentIntentId,
      },
    });
    return;
  }

  const { count } = await db.booking.updateMany({
    where: { id: booking.id, status: { in: ["PENDING_PAYMENT", "EXPIRED"] } },
    data: { status: "CONFIRMED", holdExpiresAt: null, stripePaymentIntentId: payment.paymentIntentId },
  });
  if (count !== 1) return; // another caller won the race

  await provisionMeeting(booking.id);
}

async function provisionMeeting(bookingId: string) {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      sessionType: true,
      mentor: { include: { user: { select: { name: true, email: true } } } },
    },
  });
  const { mentor, sessionType } = booking;
  const manageUrl = `${appUrl()}/booking/${booking.id}?token=${booking.accessToken}`;
  const summary = `${sessionType.title}: ${booking.menteeName} × ${mentor.user.name}`;
  const description = [
    `${sessionType.durationMinutes}-minute mentorship call booked via ${APP_NAME}.`,
    booking.menteeNotes ? `\nWhat ${booking.menteeName} wants to cover:\n${booking.menteeNotes}` : "",
    `\nManage booking: ${manageUrl}`,
  ].join("\n");

  const event = await createMeetingEvent({
    mentor,
    bookingId: booking.id.replace(/[^a-z0-9]/gi, ""),
    summary,
    description,
    start: booking.startAt,
    end: booking.endAt,
    menteeEmail: booking.menteeEmail,
    menteeName: booking.menteeName,
  });

  // Fallback: a no-account Jitsi room when Google isn't connected.
  const meetingUrl = event?.meetUrl ?? `https://meet.jit.si/MentorMinutes-${randomToken(9)}`;
  await db.booking.update({
    where: { id: booking.id },
    data: { meetingUrl, calendarEventId: event?.eventId ?? null },
  });

  const ics = buildIcs({
    uid: booking.id,
    start: booking.startAt,
    end: booking.endAt,
    summary,
    description,
    url: meetingUrl,
    organizerEmail: mentor.user.email,
    attendeeEmails: [booking.menteeEmail],
  });
  const when = formatDateTime(booking.startAt, mentor.timezone);
  await Promise.all([
    sendEmail({
      to: booking.menteeEmail,
      subject: `Confirmed: ${sessionType.title} with ${mentor.user.name}`,
      text: `You're booked for ${when}.\n\nJoin: ${meetingUrl}\nManage or cancel: ${manageUrl}\n`,
      ics: event ? undefined : ics,
    }),
    sendEmail({
      to: mentor.user.email,
      subject: `New booking: ${booking.menteeName} · ${when}`,
      text: `${booking.menteeName} (${booking.menteeEmail}) booked "${sessionType.title}".\n\n${
        booking.menteeNotes || "(no notes)"
      }\n\nJoin: ${meetingUrl}\nDashboard: ${appUrl()}/dashboard\n`,
      ics: event ? undefined : ics,
    }),
  ]);
}

export async function markExpired(checkoutSessionId: string) {
  await db.booking.updateMany({
    where: { stripeCheckoutSessionId: checkoutSessionId, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
}

export function menteeCanCancel(booking: Booking): boolean {
  return (
    booking.status === "CONFIRMED" &&
    booking.startAt.getTime() - Date.now() >= MENTEE_CANCEL_CUTOFF_HOURS * 3600_000
  );
}

/** Cancels, refunds in full (incl. reversing the mentor transfer + fee), and removes the invite. */
export async function cancelBooking(bookingId: string, by: "mentee" | "mentor"): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { mentor: { include: { user: { select: { name: true, email: true } } } }, sessionType: true },
  });
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status === "PENDING_PAYMENT") {
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", cancelledBy: by } });
    return;
  }
  if (booking.status !== "CONFIRMED") throw new BookingError("This booking can't be cancelled.");
  if (by === "mentee" && !menteeCanCancel(booking)) {
    throw new BookingError(`Cancellations must be made ${MENTEE_CANCEL_CUTOFF_HOURS}h before the call.`);
  }
  if (booking.endAt < new Date()) throw new BookingError("This call has already happened.");

  const { count } = await db.booking.updateMany({
    where: { id: booking.id, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledBy: by },
  });
  if (count !== 1) return;

  let refunded = false;
  if (booking.stripePaymentIntentId && isStripeConfigured()) {
    await refundPayment(booking.stripePaymentIntentId);
    refunded = true;
  } else if (!isStripeConfigured()) {
    refunded = true; // simulated
  }
  await db.booking.update({ where: { id: booking.id }, data: { refunded } });

  if (booking.calendarEventId) await cancelMeetingEvent(booking.mentor, booking.calendarEventId);

  const when = formatDateTime(booking.startAt, booking.mentor.timezone);
  const who = by === "mentee" ? booking.menteeName : booking.mentor.user.name;
  const text = `${who} cancelled "${booking.sessionType.title}" on ${when}.${
    refunded ? " A full refund has been issued." : ""
  }\n`;
  await Promise.all([
    sendEmail({ to: booking.menteeEmail, subject: `Cancelled: ${booking.sessionType.title}`, text }),
    sendEmail({ to: booking.mentor.user.email, subject: `Cancelled: ${booking.menteeName} · ${when}`, text }),
  ]);
}

export type { MentorWithUser };
