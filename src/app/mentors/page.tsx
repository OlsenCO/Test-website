import Link from "next/link";
import { db } from "@/lib/db";
import { listMentors } from "@/lib/queries";
import { MentorCard } from "@/components/ui";

export const metadata = { title: "Find a mentor" };

export default async function MentorsPage({ searchParams }: PageProps<"/mentors">) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  const [categories, mentors] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    listMentors({ categorySlug: category, q: q || undefined }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Find a mentor</h1>
      <form className="mt-6 flex gap-2" action="/mentors">
        {category && <input type="hidden" name="category" value={category} />}
        <input name="q" defaultValue={q} placeholder="Search by name, company, or topic" className="input max-w-md" />
        <button className="btn-secondary">Search</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={q ? `/mentors?q=${encodeURIComponent(q)}` : "/mentors"} className={`chip ${!category ? "border-accent bg-accent-soft text-accent" : ""}`}>
          All
        </Link>
        {categories.map((c) => {
          const params = new URLSearchParams({ category: c.slug, ...(q ? { q } : {}) });
          return (
            <Link
              key={c.id}
              href={`/mentors?${params}`}
              className={`chip ${category === c.slug ? "border-accent bg-accent-soft text-accent" : ""}`}
            >
              {c.name}
            </Link>
          );
        })}
      </div>
      {mentors.length === 0 ? (
        <p className="mt-12 text-center text-muted">No mentors match yet. Try another niche.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => (
            <MentorCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
