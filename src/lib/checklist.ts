import "server-only";
import { db } from "./db";

export async function setupChecklist(mentorId: string) {
  const m = await db.mentorProfile.findUniqueOrThrow({
    where: { id: mentorId },
    include: {
      _count: { select: { categories: true, availability: true, sessionTypes: { where: { active: true } } } },
    },
  });
  const items = [
    { key: "profile", label: "Add a headline and bio", done: Boolean(m.headline && m.bio), href: "/dashboard/profile" },
    { key: "niche", label: "Pick your niche", done: m._count.categories > 0, href: "/dashboard/profile" },
    { key: "session", label: "Set up a session and price", done: m._count.sessionTypes > 0, href: "/dashboard/sessions" },
    { key: "availability", label: "Add your weekly availability", done: m._count.availability > 0, href: "/dashboard/availability" },
    { key: "stripe", label: "Connect Stripe to get paid", done: Boolean(m.stripeAccountId && m.stripeChargesEnabled), href: "/dashboard/integrations" },
  ];
  return { items, ready: items.every((i) => i.done), published: m.published };
}
