import "server-only";
import { db } from "./db";

export type MentorCardData = Awaited<ReturnType<typeof listMentors>>[number];

/** Public, bookable mentors with rating aggregates and lowest price. */
export async function listMentors(opts: { categorySlug?: string; q?: string; take?: number } = {}) {
  const mentors = await db.mentorProfile.findMany({
    where: {
      published: true,
      stripeChargesEnabled: true,
      sessionTypes: { some: { active: true } },
      ...(opts.categorySlug ? { categories: { some: { slug: opts.categorySlug } } } : {}),
      ...(opts.q
        ? {
            OR: [
              { headline: { contains: opts.q } },
              { bio: { contains: opts.q } },
              { company: { contains: opts.q } },
              { user: { name: { contains: opts.q } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { name: true } },
      categories: { select: { slug: true, name: true } },
      sessionTypes: { where: { active: true }, select: { priceCents: true, currency: true, durationMinutes: true } },
    },
    take: 200,
  });

  const ratings = await db.review.groupBy({
    by: ["mentorId"],
    where: { mentorId: { in: mentors.map((m) => m.id) } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const byId = new Map(ratings.map((r) => [r.mentorId, r]));

  return mentors
    .map((m) => {
      const r = byId.get(m.id);
      const cheapest = [...m.sessionTypes].sort((a, b) => a.priceCents - b.priceCents)[0]!;
      return {
        id: m.id,
        slug: m.slug,
        name: m.user.name,
        headline: m.headline,
        company: m.company,
        avatarUrl: m.avatarUrl,
        categories: m.categories,
        fromPriceCents: cheapest.priceCents,
        currency: cheapest.currency,
        rating: r?._avg.rating ?? null,
        reviewCount: r?._count._all ?? 0,
      };
    })
    .sort((a, b) => {
      // Bayesian-ish ranking: favours mentors with both high ratings and volume.
      const score = (x: typeof a) => ((x.rating ?? 0) * x.reviewCount + 4 * 3) / (x.reviewCount + 3);
      return score(b) - score(a);
    })
    .slice(0, opts.take ?? 200);
}

export async function mentorRating(mentorId: string) {
  const agg = await db.review.aggregate({
    where: { mentorId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return { rating: agg._avg.rating, count: agg._count._all };
}
