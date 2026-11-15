import { DateTime, Interval } from "luxon";

export type Rule = { weekday: number; startMinute: number; endMinute: number };
export type Busy = { start: Date; end: Date };

export type SlotOptions = {
  rules: Rule[];
  mentorTz: string;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  busy: Busy[];
  now?: Date;
  /** Slot start times are aligned to this many minutes past the hour. */
  stepMinutes?: number;
};

/**
 * Generates bookable slot start times (UTC Date objects) from a mentor's
 * weekly availability, expressed in their own timezone. DST is handled by
 * Luxon: a 9:00–12:00 rule stays 9:00–12:00 local time year round.
 *
 * A slot is bookable when [start - buffer, end + buffer) overlaps no busy
 * interval, it starts after the minimum notice, and before maxDaysAhead.
 */
export function generateSlots(opts: SlotOptions): Date[] {
  const now = DateTime.fromJSDate(opts.now ?? new Date());
  const step = opts.stepMinutes ?? 30;
  const earliest = now.plus({ hours: opts.minNoticeHours });
  const latest = now.plus({ days: opts.maxDaysAhead });
  const busy = opts.busy.map((b) =>
    Interval.fromDateTimes(DateTime.fromJSDate(b.start), DateTime.fromJSDate(b.end)),
  );

  const out: Date[] = [];
  let day = now.setZone(opts.mentorTz).startOf("day");
  const lastDay = latest.setZone(opts.mentorTz).startOf("day");

  while (day <= lastDay) {
    for (const rule of opts.rules) {
      if (rule.weekday !== day.weekday) continue;
      const windowStart = day.plus({ minutes: rule.startMinute });
      const windowEnd = day.plus({ minutes: rule.endMinute });
      for (
        let start = windowStart;
        start.plus({ minutes: opts.durationMinutes }) <= windowEnd;
        start = start.plus({ minutes: step })
      ) {
        const end = start.plus({ minutes: opts.durationMinutes });
        if (start < earliest || start > latest) continue;
        const padded = Interval.fromDateTimes(
          start.minus({ minutes: opts.bufferMinutes }),
          end.plus({ minutes: opts.bufferMinutes }),
        );
        if (busy.some((b) => b.overlaps(padded))) continue;
        out.push(start.toUTC().toJSDate());
      }
    }
    day = day.plus({ days: 1 }).startOf("day");
  }

  // Dedupe (overlapping rules) and sort.
  return [...new Set(out.map((d) => d.getTime()))].sort((a, b) => a - b).map((t) => new Date(t));
}

/** Group slot start times by calendar day in the viewer's timezone. */
export function groupByDay(slots: Date[], tz: string): Record<string, string[]> {
  const days: Record<string, string[]> = {};
  for (const s of slots) {
    const key = DateTime.fromJSDate(s).setZone(tz).toISODate()!;
    (days[key] ??= []).push(s.toISOString());
  }
  return days;
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}
