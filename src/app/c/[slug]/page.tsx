import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listMentors } from "@/lib/queries";
import { MentorCard } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.category.findUnique({ where: { slug } });
  return c ? { title: `${c.name} mentors`, description: c.tagline } : {};
}

/**
 * Niche landing page: the link you share in a specific community
 * (e.g. a subreddit or Discord) when launching one vertical at a time.
 */
export default async function CategoryPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) notFound();
  const mentors = await listMentors({ categorySlug: slug });

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <Link href="/mentors" className="text-sm text-muted hover:text-foreground">
        ← All mentors
      </Link>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{category.name}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{category.tagline}</p>
      {category.description && <p className="mt-4 max-w-2xl text-sm">{category.description}</p>}
      {mentors.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="font-medium">Mentors for this niche are joining now.</p>
          <p className="mt-2 text-sm text-muted">
            Have experience here?{" "}
            <Link href="/signup" className="text-accent underline">
              Become one of the first mentors
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => (
            <MentorCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
