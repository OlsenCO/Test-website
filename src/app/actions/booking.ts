"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { BookingError, cancelBooking, confirmBooking, menteeCanCancel, startBooking } from "@/lib/bookings";
import { isStripeConfigured } from "@/lib/config";
import { safeEqual } from "@/lib/tokens";

const bookSchema = z.object({
  sessionTypeId: z.string().min(1),
  startIso: z.string().datetime(),
  menteeName: z.string().trim().min(2, "Please enter your name").max(80),
  menteeEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  menteeNotes: z.string().trim().max(2000).default(""),
});

export type BookResult = { error: string } | { redirectUrl: string };

export async function bookSlot(input: z.input<typeof bookSchema>): Promise<BookResult> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  try {
    const { redirectUrl } = await startBooking(parsed.data);
    return { redirectUrl };
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error("[booking] start failed", err);
    return { error: "Something went wrong starting checkout. Please try again." };
  }
}

async function bookingForToken(bookingId: string, token: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !safeEqual(booking.accessToken, token)) return null;
  return booking;
}

/** Dev-only stand-in for Stripe Checkout when STRIPE_SECRET_KEY is unset. */
export async function simulatePayment(form: FormData): Promise<void> {
  if (isStripeConfigured()) throw new Error("Simulated payments are disabled when Stripe is configured.");
  const bookingId = String(form.get("bookingId"));
  const token = String(form.get("token"));
  const booking = await bookingForToken(bookingId, token);
  if (!booking) throw new Error("Not found");
  await confirmBooking(booking.id, { paymentIntentId: null });
  redirect(`/booking/${booking.id}?token=${token}&paid=1`);
}

export async function menteeCancel(form: FormData): Promise<void> {
  const bookingId = String(form.get("bookingId"));
  const token = String(form.get("token"));
  const booking = await bookingForToken(bookingId, token);
  if (!booking) throw new Error("Not found");
  if (booking.status === "CONFIRMED" && !menteeCanCancel(booking)) {
    redirect(`/booking/${booking.id}?token=${token}`);
  }
  await cancelBooking(booking.id, "mentee");
  revalidatePath(`/booking/${booking.id}`);
  redirect(`/booking/${booking.id}?token=${token}`);
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).default(""),
});

export async function submitReview(form: FormData): Promise<void> {
  const bookingId = String(form.get("bookingId"));
  const token = String(form.get("token"));
  const booking = await bookingForToken(bookingId, token);
  if (!booking) throw new Error("Not found");
  const parsed = reviewSchema.safeParse({ rating: form.get("rating"), comment: form.get("comment") ?? "" });
  // Only paid, completed calls can be reviewed, once.
  if (parsed.success && booking.status === "CONFIRMED" && booking.endAt <= new Date()) {
    await db.review.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        mentorId: booking.mentorId,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        authorName: booking.menteeName.split(/\s+/)[0] ?? "Mentee",
      },
      update: {},
    });
  }
  redirect(`/booking/${booking.id}?token=${token}&reviewed=1`);
}
