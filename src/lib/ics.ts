function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** RFC 5545 calendar invite, used as a fallback when Google isn't connected. */
export function buildIcs(opts: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  url?: string | null;
  organizerEmail?: string;
  attendeeEmails?: string[];
  method?: "PUBLISH" | "CANCEL";
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mentor Minutes//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}@mentorminutes`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(opts.start)}`,
    `DTEND:${stamp(opts.end)}`,
    `SUMMARY:${escape(opts.summary)}`,
    `DESCRIPTION:${escape(opts.description)}`,
  ];
  if (opts.url) lines.push(`URL:${opts.url}`, `LOCATION:${escape(opts.url)}`);
  if (opts.organizerEmail) lines.push(`ORGANIZER:mailto:${opts.organizerEmail}`);
  for (const a of opts.attendeeEmails ?? []) lines.push(`ATTENDEE;RSVP=TRUE:mailto:${a}`);
  if (opts.method === "CANCEL") lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
