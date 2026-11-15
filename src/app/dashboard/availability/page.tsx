import { requireMentor } from "@/lib/auth";
import { db } from "@/lib/db";
import { minutesToHHMM } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { saveAvailability } from "@/app/actions/mentor";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const { mentor } = await requireMentor();
  const rules = await db.availabilityRule.findMany({
    where: { mentorId: mentor.id },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
  const initial: Record<number, { start: string; end: string }[]> = {};
  for (const r of rules) {
    (initial[r.weekday] ??= []).push({ start: minutesToHHMM(r.startMinute), end: minutesToHHMM(r.endMinute) });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
      <p className="mb-6 text-sm text-muted">
        Weekly hours in <strong>{mentor.timezone.replace(/_/g, " ")}</strong>. If you connect Google Calendar, busy
        events are blocked out automatically.
      </p>
      <ActionForm action={saveAvailability} className="card space-y-6 p-6">
        <AvailabilityEditor initial={initial} />
        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="bufferMinutes">Buffer between calls (min)</label>
            <input id="bufferMinutes" name="bufferMinutes" type="number" min={0} max={60} defaultValue={mentor.bufferMinutes} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="minNoticeHours">Minimum notice (hours)</label>
            <input id="minNoticeHours" name="minNoticeHours" type="number" min={0} max={168} defaultValue={mentor.minNoticeHours} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="maxDaysAhead">Book up to (days ahead)</label>
            <input id="maxDaysAhead" name="maxDaysAhead" type="number" min={1} max={60} defaultValue={mentor.maxDaysAhead} className="input" />
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
