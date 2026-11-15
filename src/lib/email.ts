import "server-only";
import { APP_NAME } from "./config";

/**
 * Minimal transactional email. Uses Resend's HTTP API when RESEND_API_KEY is
 * set; otherwise logs to the server console so the flow is visible in dev.
 * (When Google Calendar is connected, Google also emails the invite itself.)
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  ics?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;
  if (!key) {
    console.info(`[email:dev] to=${opts.to} subject="${opts.subject}"\n${opts.text}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        attachments: opts.ics
          ? [{ filename: "invite.ics", content: Buffer.from(opts.ics).toString("base64") }]
          : undefined,
      }),
    });
    if (!res.ok) console.error("[email] send failed", res.status, await res.text());
  } catch (err) {
    console.error("[email] send failed", err);
  }
}
