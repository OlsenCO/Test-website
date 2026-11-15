"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { BookingError, cancelBooking } from "@/lib/bookings";
import { MIN_PRICE_CENTS } from "@/lib/config";
import { hhmmToMinutes, slugify } from "@/lib/format";
import { isValidTimezone } from "@/lib/slots";
import { setupChecklist } from "@/lib/checklist";

export type ActionState = { error?: string; ok?: string } | undefined;

function done(path: string, ok = "Saved"): ActionState {
  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
  return { ok };
}

const urlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\//.test(v), "Links must start with https://");

const profileSchema = z.object({
  slug: z.string().trim().min(3, "Profile URL must be at least 3 characters").max(48),
  headline: z.string().trim().max(140),
  bio: z.string().trim().max(3000),
  company: z.string().trim().max(100),
  avatarUrl: urlOrEmpty,
  linkedinUrl: urlOrEmpty,
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  categoryIds: z.array(z.string()).max(3, "Pick up to 3 niches"),
});

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const { mentor } = await requireMentor();
  const parsed = profileSchema.safeParse({
    ...Object.fromEntries(form),
    categoryIds: form.getAll("categoryIds").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const data = parsed.data;
  const slug = slugify(data.slug);
  if (slug.length < 3) return { error: "Profile URL must contain letters or numbers" };
  const taken = await db.mentorProfile.findFirst({ where: { slug, id: { not: mentor.id } } });
  if (taken) return { error: "That profile URL is taken" };

  await db.mentorProfile.update({
    where: { id: mentor.id },
    data: {
      slug,
      headline: data.headline,
      bio: data.bio,
      company: data.company,
      avatarUrl: data.avatarUrl,
      linkedinUrl: data.linkedinUrl,
      timezone: data.timezone,
      categories: { set: data.categoryIds.map((id) => ({ id })) },
    },
  });
  return done("/dashboard/profile");
}

const sessionSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Give the session a title").max(80),
  description: z.string().trim().max(600),
  durationMinutes: z.coerce.number().int().refine((n) => [15, 20, 30, 45, 60].includes(n), "Pick a supported length"),
  price: z.coerce.number().min(MIN_PRICE_CENTS / 100, `Minimum price is $${MIN_PRICE_CENTS / 100}`).max(1000),
});

export async function saveSessionType(_: ActionState, form: FormData): Promise<ActionState> {
  const { mentor } = await requireMentor();
  const parsed = sessionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { id, title, description, durationMinutes, price } = parsed.data;
  const data = { title, description, durationMinutes, priceCents: Math.round(price * 100) };
  if (id) {
    await db.sessionType.updateMany({ where: { id, mentorId: mentor.id }, data });
  } else {
    const count = await db.sessionType.count({ where: { mentorId: mentor.id, active: true } });
    if (count >= 5) return { error: "You can offer up to 5 session types" };
    await db.sessionType.create({ data: { ...data, mentorId: mentor.id } });
  }
  return done("/dashboard/sessions", id ? "Saved" : "Session added");
}

export async function archiveSessionType(form: FormData): Promise<void> {
  const { mentor } = await requireMentor();
  await db.sessionType.updateMany({
    where: { id: String(form.get("id")), mentorId: mentor.id },
    data: { active: false },
  });
  revalidatePath("/dashboard", "layout");
}

export async function saveAvailability(_: ActionState, form: FormData): Promise<ActionState> {
  const { mentor } = await requireMentor();
  const rules: { weekday: number; startMinute: number; endMinute: number }[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const starts = form.getAll(`start_${weekday}`).map(String);
    const ends = form.getAll(`end_${weekday}`).map(String);
    for (let i = 0; i < starts.length; i++) {
      if (!starts[i] && !ends[i]) continue;
      const s = hhmmToMinutes(starts[i] ?? "");
      const e = hhmmToMinutes(ends[i] ?? "");
      if (s == null || e == null) return { error: "Use HH:MM times" };
      if (e <= s) return { error: "Each window must end after it starts" };
      if (e - s < 15) return { error: "Windows must be at least 15 minutes" };
      rules.push({ weekday, startMinute: s, endMinute: e });
    }
  }

  const rulesSchema = z.object({
    bufferMinutes: z.coerce.number().int().min(0).max(60),
    minNoticeHours: z.coerce.number().int().min(0).max(168),
    maxDaysAhead: z.coerce.number().int().min(1).max(60),
  });
  const parsed = rulesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check your scheduling rules" };

  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { mentorId: mentor.id } }),
    db.availabilityRule.createMany({ data: rules.map((r) => ({ ...r, mentorId: mentor.id })) }),
    db.mentorProfile.update({ where: { id: mentor.id }, data: parsed.data }),
  ]);
  return done("/dashboard/availability");
}

export async function setPublished(form: FormData): Promise<void> {
  const { mentor } = await requireMentor();
  const publish = form.get("publish") === "1";
  if (publish) {
    const { ready } = await setupChecklist(mentor.id);
    if (!ready) redirect("/dashboard?publish=blocked");
  }
  await db.mentorProfile.update({ where: { id: mentor.id }, data: { published: publish } });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function mentorCancel(form: FormData): Promise<void> {
  const { mentor } = await requireMentor();
  const booking = await db.booking.findFirst({ where: { id: String(form.get("bookingId")), mentorId: mentor.id } });
  if (!booking) return;
  try {
    await cancelBooking(booking.id, "mentor");
  } catch (err) {
    if (!(err instanceof BookingError)) throw err;
  }
  revalidatePath("/dashboard", "layout");
}

export async function disconnectGoogle(): Promise<void> {
  const { mentor } = await requireMentor();
  await db.mentorProfile.update({
    where: { id: mentor.id },
    data: { googleRefreshToken: null, googleEmail: null },
  });
  revalidatePath("/dashboard/integrations");
}
