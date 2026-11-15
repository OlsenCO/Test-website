import { requireMentor } from "@/lib/auth";
import { isGoogleConfigured, isStripeConfigured, platformFeeBps } from "@/lib/config";
import { Notice } from "@/components/ui";
import { disconnectGoogle } from "@/app/actions/mentor";

export const metadata = { title: "Payments & calendar" };

export default async function IntegrationsPage({ searchParams }: PageProps<"/dashboard/integrations">) {
  const sp = await searchParams;
  const { mentor } = await requireMentor();
  const stripeLive = isStripeConfigured();
  const googleLive = isGoogleConfigured();
  const stripeReady = Boolean(mentor.stripeAccountId && mentor.stripeChargesEnabled);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Payments &amp; calendar</h1>

      {sp.google === "connected" && <Notice tone="success">Google Calendar connected.</Notice>}
      {sp.google === "error" && <Notice tone="warn">Couldn&apos;t connect Google Calendar. Please try again.</Notice>}
      {sp.stripe === "returned" && !stripeReady && (
        <Notice tone="warn">Stripe still needs a few details before you can accept payments.</Notice>
      )}

      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-lg">
            <h2 className="font-semibold">Stripe payouts</h2>
            <p className="mt-1 text-sm text-muted">
              Mentees pay upfront. Stripe sends your {100 - platformFeeBps() / 100}% share to your bank automatically.
              Identity checks and tax forms are handled by Stripe.
            </p>
            {!stripeLive && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Test mode: no STRIPE_SECRET_KEY set, so connecting creates a simulated account.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`chip ${stripeReady ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>
              {stripeReady ? "Payouts enabled" : mentor.stripeAccountId ? "Setup incomplete" : "Not connected"}
            </span>
            {stripeReady ? (
              stripeLive && (
                <a href="/api/stripe/dashboard" className="btn-secondary">
                  Open Stripe dashboard
                </a>
              )
            ) : (
              <a href="/api/stripe/connect" className="btn-primary">
                {mentor.stripeAccountId ? "Finish Stripe setup" : "Connect Stripe"}
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-lg">
            <h2 className="font-semibold">Google Calendar &amp; Meet</h2>
            <p className="mt-1 text-sm text-muted">
              We check your calendar for conflicts and create the event with a Google Meet link, inviting the mentee
              automatically. Without it, we generate a Jitsi video link and an .ics invite instead.
            </p>
            {!googleLive && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Not available: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren&apos;t set on the server.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {mentor.googleRefreshToken ? (
              <>
                <span className="chip border-emerald-300 text-emerald-700 dark:text-emerald-400">
                  {mentor.googleEmail ?? "Connected"}
                </span>
                <form action={disconnectGoogle}>
                  <button className="text-xs text-muted hover:text-red-600">Disconnect</button>
                </form>
              </>
            ) : (
              <a href="/api/google/connect" className={`btn-primary ${googleLive ? "" : "pointer-events-none opacity-50"}`}>
                Connect Google Calendar
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
