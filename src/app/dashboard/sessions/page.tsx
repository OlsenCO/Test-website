import { requireMentor } from "@/lib/auth";
import { db } from "@/lib/db";
import { MIN_PRICE_CENTS, platformFeeBps } from "@/lib/config";
import { ActionForm } from "@/components/ActionForm";
import { archiveSessionType, saveSessionType } from "@/app/actions/mentor";

export const metadata = { title: "Sessions & pricing" };

const DURATIONS = [15, 20, 30, 45, 60];

function SessionFields({ s }: { s?: { id: string; title: string; description: string; durationMinutes: number; priceCents: number } }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_120px_120px]">
        <div>
          <label className="label">Title</label>
          <input name="title" defaultValue={s?.title} required className="input" placeholder="20-min resume review" />
        </div>
        <div>
          <label className="label">Length</label>
          <select name="durationMinutes" defaultValue={s?.durationMinutes ?? 20} className="input">
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Price (USD)</label>
          <input name="price" type="number" min={MIN_PRICE_CENTS / 100} max={1000} step="1" defaultValue={s ? s.priceCents / 100 : 40} required className="input" />
        </div>
      </div>
      <div>
        <label className="label">What the mentee gets</label>
        <textarea name="description" rows={2} defaultValue={s?.description} maxLength={600} className="input" placeholder="Send your resume beforehand; leave with line-by-line edits." />
      </div>
    </>
  );
}

export default async function SessionsPage() {
  const { mentor } = await requireMentor();
  const sessions = await db.sessionType.findMany({
    where: { mentorId: mentor.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  const feePct = platformFeeBps() / 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions &amp; pricing</h1>
        <p className="text-sm text-muted">
          You keep {100 - feePct}% of the price. The {feePct}% platform fee covers payments processing, scheduling and
          getting you discovered.
        </p>
      </div>
      {sessions.map((s) => (
        <div key={s.id} className="card p-6">
          <ActionForm action={saveSessionType}>
            <SessionFields s={s} />
          </ActionForm>
          <form action={archiveSessionType} className="mt-3 text-right">
            <input type="hidden" name="id" value={s.id} />
            <button className="text-xs text-muted hover:text-red-600">Remove session</button>
          </form>
        </div>
      ))}
      {sessions.length < 5 && (
        <div className="card border-dashed p-6">
          <h2 className="mb-4 font-semibold">{sessions.length ? "Add another session" : "Create your first session"}</h2>
          <ActionForm action={saveSessionType} submitLabel="Add session">
            <SessionFields />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
