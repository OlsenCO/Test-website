import Link from "next/link";
import { requireMentor } from "@/lib/auth";
import { db } from "@/lib/db";
import { setupChecklist } from "@/lib/checklist";
import { mentorRating } from "@/lib/queries";
import { appUrl } from "@/lib/config";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Notice, Stars } from "@/components/ui";
import { mentorCancel, setPublished } from "@/app/actions/mentor";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const { user, mentor } = await requireMentor();
  const now = new Date();
  const [checklist, upcoming, past, earnings, rating] = await Promise.all([
    setupChecklist(mentor.id),
    db.booking.findMany({
      where: { mentorId: mentor.id, status: "CONFIRMED", endAt: { gt: now } },
      include: { sessionType: true },
      orderBy: { startAt: "asc" },
    }),
    db.booking.findMany({
      where: { mentorId: mentor.id, status: { in: ["CONFIRMED", "CANCELLED"] }, endAt: { lte: now } },
      include: { sessionType: true, review: true },
      orderBy: { startAt: "desc" },
      take: 10,
    }),
    db.booking.aggregate({
      where: { mentorId: mentor.id, status: "CONFIRMED", refunded: false },
      _sum: { priceCents: true, platformFeeCents: true },
      _count: { _all: true },
    }),
    mentorRating(mentor.id),
  ]);
  const earned = (earnings._sum.priceCents ?? 0) - (earnings._sum.platformFeeCents ?? 0);
  const profileUrl = `${appUrl()}/m/${mentor.slug}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {user.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted">Here&apos;s what&apos;s happening with your mentorship calls.</p>
      </div>

      {sp.publish === "blocked" && <Notice tone="warn">Finish the setup steps below before going live.</Notice>}

      {!checklist.published ? (
        <div className="card p-6">
          <h2 className="font-semibold">Get ready to take bookings</h2>
          <ul className="mt-4 space-y-2">
            {checklist.items.map((i) => (
              <li key={i.key} className="flex items-center gap-3 text-sm">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${i.done ? "bg-accent text-accent-ink" : "border border-line"}`}>
                  {i.done ? "✓" : ""}
                </span>
                <Link href={i.href} className={i.done ? "text-muted line-through" : "hover:text-accent"}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action={setPublished} className="mt-6">
            <input type="hidden" name="publish" value="1" />
            <button className="btn-primary" disabled={!checklist.ready}>
              Publish my profile
            </button>
          </form>
        </div>
      ) : (
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">You&apos;re live. Share your link in your community:</p>
            <p className="truncate font-mono text-sm text-accent">{profileUrl}</p>
          </div>
          <CopyButton text={profileUrl} />
          <form action={setPublished}>
            <input type="hidden" name="publish" value="0" />
            <button className="btn-secondary">Pause bookings</button>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="You've earned" value={formatMoney(earned)} />
        <Stat label="Paid sessions" value={String(earnings._count._all)} />
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Rating</p>
          <div className="mt-2">
            <Stars rating={rating.rating} count={rating.count} />
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Upcoming calls</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming calls yet.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {b.menteeName} <span className="font-normal text-muted">· {b.sessionType.title}</span>
                    </p>
                    <p className="text-sm text-muted">{formatDateTime(b.startAt, mentor.timezone)}</p>
                    <p className="text-sm text-muted">{b.menteeEmail}</p>
                  </div>
                  <div className="flex gap-2">
                    {b.meetingUrl && (
                      <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                        Join
                      </a>
                    )}
                    <form action={mentorCancel}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button className="btn-danger">Cancel &amp; refund</button>
                    </form>
                  </div>
                </div>
                {b.menteeNotes && <p className="mt-3 whitespace-pre-line rounded-lg bg-background p-3 text-sm">{b.menteeNotes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Recent</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {past.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {b.menteeName} · {b.sessionType.title}
                </span>
                <span className="text-muted">
                  {formatDateTime(b.startAt, mentor.timezone)}
                  {b.status === "CANCELLED" ? " · cancelled" : b.review ? ` · ${"★".repeat(b.review.rating)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
