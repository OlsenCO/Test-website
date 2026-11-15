import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAcceptBookings } from "@/lib/bookings";
import { mentorRating } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { Avatar, Notice, StarRow, Stars } from "@/components/ui";
import { BookingWidget } from "@/components/BookingWidget";

async function load(slug: string) {
  return db.mentorProfile.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true } },
      categories: true,
      sessionTypes: { where: { active: true }, orderBy: { priceCents: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const m = await load(slug);
  if (!m?.published) return {};
  return { title: m.user.name, description: m.headline };
}

export default async function MentorPage({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const [mentor, viewer] = await Promise.all([load(slug), getCurrentUser()]);
  if (!mentor) notFound();
  const isOwner = viewer?.mentor?.id === mentor.id;
  if (!mentor.published && !isOwner) notFound();

  const [{ rating, count }, reviews] = await Promise.all([
    mentorRating(mentor.id),
    db.review.findMany({ where: { mentorId: mentor.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const bookable = canAcceptBookings(mentor) && mentor.sessionTypes.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {isOwner && !bookable && (
        <div className="mb-6">
          <Notice tone="warn">
            Preview only. Mentees can&apos;t book you yet.{" "}
            <Link href="/dashboard" className="underline">
              Finish setup in your dashboard
            </Link>
            .
          </Notice>
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="flex items-start gap-5">
            <Avatar name={mentor.user.name} url={mentor.avatarUrl} size={88} />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{mentor.user.name}</h1>
              {mentor.company && <p className="text-muted">{mentor.company}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Stars rating={rating} count={count} />
                {mentor.linkedinUrl && (
                  <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
          {mentor.headline && <p className="mt-6 text-xl">{mentor.headline}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {mentor.categories.map((c) => (
              <Link key={c.id} href={`/c/${c.slug}`} className="chip hover:border-accent">
                {c.name}
              </Link>
            ))}
          </div>
          {mentor.bio && <div className="mt-6 whitespace-pre-line leading-relaxed text-foreground/90">{mentor.bio}</div>}

          <h2 className="mt-10 text-lg font-semibold">Sessions</h2>
          <div className="mt-3 space-y-3">
            {mentor.sessionTypes.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{s.title}</p>
                  <p className="whitespace-nowrap font-semibold">{formatMoney(s.priceCents, s.currency)}</p>
                </div>
                <p className="text-sm text-muted">{s.durationMinutes} min · video call</p>
                {s.description && <p className="mt-2 text-sm">{s.description}</p>}
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-lg font-semibold">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No reviews yet. Be the first to book.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-line pb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <StarRow rating={r.rating} />
                    <span className="font-medium">{r.authorName}</span>
                    <span className="text-muted">· {r.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {bookable ? (
            <BookingWidget
              mentorName={mentor.user.name}
              sessionTypes={mentor.sessionTypes.map((s) => ({
                id: s.id,
                title: s.title,
                durationMinutes: s.durationMinutes,
                price: formatMoney(s.priceCents, s.currency),
              }))}
            />
          ) : (
            <div className="card p-6 text-sm text-muted">This mentor isn&apos;t taking bookings right now.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
