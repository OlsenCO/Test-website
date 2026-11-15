import Link from "next/link";
import { db } from "@/lib/db";
import { listMentors } from "@/lib/queries";
import { MentorCard } from "@/components/ui";
import { platformFeeBps } from "@/lib/config";

export default async function Home() {
  const [categories, mentors] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    listMentors({ take: 6 }),
  ]);
  const keep = 100 - platformFeeBps() / 100;

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-20">
        <p className="chip mb-6 border-accent/30 bg-accent-soft text-accent">20 minutes. Real answers. No cold DMs.</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Book a quick call with someone who&apos;s already done it.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Resume reviews, breaking into tech, grad school strategy. Pick a mentor, pick a time, pay once.
          The calendar invite and video link show up in your inbox automatically.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/mentors" className="btn-primary px-6 py-3 text-base">
            Find a mentor
          </Link>
          <Link href="/signup" className="btn-secondary px-6 py-3 text-base">
            Get paid to mentor
          </Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Pick your niche</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link key={c.id} href={`/c/${c.slug}`} className="card p-5 transition hover:border-accent">
                <p className="font-semibold">{c.name}</p>
                <p className="mt-1 text-sm text-muted">{c.tagline}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {mentors.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Top-rated mentors</h2>
            <Link href="/mentors" className="text-sm text-accent">
              See all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map((m) => (
              <MentorCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["1. Pick a time", "See real availability synced with the mentor's calendar, in your timezone."],
            ["2. Pay upfront", "Secure checkout by Stripe. Full refund if you cancel 24h ahead."],
            ["3. Hop on the call", "Calendar invite and Google Meet link land in your inbox. Leave a review after."],
          ].map(([t, d]) => (
            <div key={t} className="card p-6">
              <p className="font-semibold">{t}</p>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          Mentors set their own price and keep {keep}% of every session.
        </p>
      </section>
    </div>
  );
}
