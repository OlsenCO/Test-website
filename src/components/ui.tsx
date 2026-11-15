import Link from "next/link";
import { formatMoney, initials } from "@/lib/format";
import type { MentorCardData } from "@/lib/queries";

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (!count || rating == null) return <span className="text-xs text-muted">New mentor</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function StarRow({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function MentorCard({ m }: { m: MentorCardData }) {
  return (
    <Link href={`/m/${m.slug}`} className="card group flex flex-col gap-3 p-5 transition hover:border-accent">
      <div className="flex items-center gap-3">
        <Avatar name={m.name} url={m.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate font-semibold group-hover:text-accent">{m.name}</p>
          <p className="truncate text-sm text-muted">{m.company}</p>
        </div>
      </div>
      <p className="line-clamp-2 text-sm">{m.headline}</p>
      <div className="flex flex-wrap gap-1">
        {m.categories.map((c) => (
          <span key={c.slug} className="chip text-muted">
            {c.name}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-2">
        <Stars rating={m.rating} count={m.reviewCount} />
        <span className="text-sm">
          from <span className="font-semibold">{formatMoney(m.fromPriceCents, m.currency)}</span>
        </span>
      </div>
    </Link>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warn"; children: React.ReactNode }) {
  const styles = {
    info: "border-line bg-surface",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
