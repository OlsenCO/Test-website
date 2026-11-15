import "server-only";
import { auth, calendar } from "@googleapis/calendar";
import { appUrl, isGoogleConfigured } from "./config";
import { db } from "./db";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

function oauthClient() {
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl()}/api/google/callback`,
  );
}

export function googleAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  let email: string | null = null;
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    email = ticket.getPayload()?.email ?? null;
  }
  return { refreshToken: tokens.refresh_token ?? null, email };
}

function calendarFor(refreshToken: string) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return calendar({ version: "v3", auth: client });
}

type MentorCal = { googleRefreshToken: string | null; googleCalendarId: string };

/** Busy intervals from the mentor's Google Calendar (empty if not connected). */
export async function getBusy(
  mentor: MentorCal,
  from: Date,
  to: Date,
): Promise<{ start: Date; end: Date }[]> {
  if (!isGoogleConfigured() || !mentor.googleRefreshToken) return [];
  try {
    const res = await calendarFor(mentor.googleRefreshToken).freebusy.query({
      requestBody: {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: mentor.googleCalendarId }],
      },
    });
    const busy = res.data.calendars?.[mentor.googleCalendarId]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  } catch (err) {
    // Never block booking because Google hiccuped; we still prevent
    // double-booking against our own bookings table.
    console.error("[google] freebusy failed", err);
    return [];
  }
}

/**
 * Creates the event on the mentor's calendar with a Google Meet link and
 * invites the mentee. Google emails the invite to both parties.
 */
export async function createMeetingEvent(opts: {
  mentor: MentorCal & { id: string };
  bookingId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  menteeEmail: string;
  menteeName: string;
}): Promise<{ eventId: string; meetUrl: string | null } | null> {
  if (!isGoogleConfigured() || !opts.mentor.googleRefreshToken) return null;
  try {
    const res = await calendarFor(opts.mentor.googleRefreshToken).events.insert({
      calendarId: opts.mentor.googleCalendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: opts.summary,
        description: opts.description,
        start: { dateTime: opts.start.toISOString() },
        end: { dateTime: opts.end.toISOString() },
        attendees: [{ email: opts.menteeEmail, displayName: opts.menteeName }],
        conferenceData: {
          createRequest: {
            requestId: opts.bookingId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: { useDefault: true },
      },
    });
    const meetUrl =
      res.data.hangoutLink ??
      res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      null;
    return { eventId: res.data.id!, meetUrl };
  } catch (err) {
    console.error("[google] events.insert failed", err);
    if (isInvalidGrant(err)) await disconnect(opts.mentor.id);
    return null;
  }
}

export async function cancelMeetingEvent(mentor: MentorCal, eventId: string): Promise<void> {
  if (!isGoogleConfigured() || !mentor.googleRefreshToken) return;
  try {
    await calendarFor(mentor.googleRefreshToken).events.delete({
      calendarId: mentor.googleCalendarId,
      eventId,
      sendUpdates: "all",
    });
  } catch (err) {
    console.error("[google] events.delete failed", err);
  }
}

function isInvalidGrant(err: unknown): boolean {
  return String((err as { message?: string })?.message ?? "").includes("invalid_grant");
}

async function disconnect(mentorId: string) {
  await db.mentorProfile.update({
    where: { id: mentorId },
    data: { googleRefreshToken: null },
  });
}
