# Mentor Minutes

A booking platform for paid 20-minute career advice calls. Mentors set a price and weekly hours. Mentees pick a slot and pay through Stripe Checkout, then get a calendar invite with a Google Meet link. The platform keeps a configurable 15–20% fee.

**Stack:** Next.js 16 (App Router, server actions), Prisma (SQLite in dev, Postgres in prod), Stripe Connect Express (destination charges), Google Calendar API, Tailwind CSS 4, Luxon.

## Quick start (no API keys needed)

```bash
npm install
cp .env.example .env
npm run setup        # creates the SQLite DB and seeds niches, demo mentors and reviews
npm run dev
```

Open http://localhost:3000. Demo mentor login: `maya@example.com` / `password123`.

If Stripe and Google keys are missing, the app runs in **test mode**:

- "Connect Stripe" creates a simulated connected account.
- Checkout goes to `/dev/checkout/...`, a page with a "Simulate successful payment" button. This page returns 404 once Stripe is configured.
- Each booking gets a Jitsi video link and a downloadable `.ics` invite.
- Emails are printed to the server console.

## What's built

| Phase | Feature | Where |
|---|---|---|
| 1 | Mentor accounts, profile, niches, photo, LinkedIn | `src/app/dashboard/profile` |
| 1 | Session types with price and length (20-min resume review by default) | `src/app/dashboard/sessions` |
| 1 | Weekly availability in the mentor's timezone, plus buffer, minimum notice and booking horizon | `src/app/dashboard/availability`, `src/lib/slots.ts` |
| 1 | Stripe Connect Express onboarding, destination charges with `application_fee_amount` | `src/lib/stripe.ts`, `src/app/api/stripe/*` |
| 2 | Booking widget showing slots in the mentee's own timezone; no account needed to book | `src/components/BookingWidget.tsx` |
| 2 | 30-minute slot hold during checkout; serializable transaction to prevent double-booking | `src/lib/bookings.ts` |
| 2 | Google Calendar free/busy conflict check; event with a Meet link and mentee invite | `src/lib/google.ts` |
| 2 | Webhook confirmation, plus a fallback check on the success page if the webhook is late | `src/app/api/stripe/webhook`, `src/app/booking/[id]` |
| 2 | Mentee self-serve page: join link, .ics, cancel with full refund up to 24h before | `src/app/booking/[id]` |
| 2 | Mentor cancel with refund (reverses the transfer and the platform fee) | dashboard overview |
| 3 | Reviews: only from paid, completed bookings, one per booking | `src/app/booking/[id]`, `src/app/actions/booking.ts` |
| 3 | Niche categories with shareable landing pages (`/c/break-into-tech`) | `src/app/c/[slug]` |
| 3 | Directory with search, niche filter and rating-weighted ranking | `src/app/mentors`, `src/lib/queries.ts` |

### Money flow

The mentee pays the platform through Checkout. The PaymentIntent uses `transfer_data.destination = mentor's account` and `application_fee_amount = price × PLATFORM_FEE_BPS`. Stripe pays the rest out to the mentor. Refunds use `reverse_transfer` and `refund_application_fee`, so both sides are made whole.

## Going live

1. **Database:** in `prisma/schema.prisma`, set `provider = "postgresql"` and point `DATABASE_URL` at Postgres (Neon, Supabase or RDS). Then run `npx prisma db push`.
2. **Stripe:**
   - Turn on Connect in the dashboard and choose Express accounts.
   - Set `STRIPE_SECRET_KEY`.
   - Add a webhook endpoint at `${APP_URL}/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`.
   - Add a second endpoint "listening to events on Connected accounts" for `account.updated`.
   - Set `STRIPE_WEBHOOK_SECRET` (platform endpoint) and `STRIPE_CONNECT_WEBHOOK_SECRET` (Connect endpoint). The route accepts either signature.
   - Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook --forward-connect-to localhost:3000/api/stripe/webhook`.
3. **Google:**
   - Create a Web OAuth client and enable the Google Calendar API.
   - Add the redirect URI `${APP_URL}/api/google/callback`.
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
   - The `calendar.events` scope is sensitive, so before public launch Google requires OAuth app verification. Until then, add mentors as test users.
4. **Email:** set `RESEND_API_KEY` and `EMAIL_FROM`. This is optional when Google is connected, because Google sends the invites itself.

## Distribution playbook

Launch one niche at a time. Seed 5–10 mentors in one category, then post the niche page (for example `/c/break-into-tech`) in that community, such as r/cscareerquestions or a bootcamp alumni Slack. The dashboard gives each mentor a copyable profile link so they can share it with their own audience.

## Scripts

```bash
npm run dev        # dev server
npm test           # slot engine unit tests (timezones, DST, buffers, notice)
npm run typecheck
npm run lint
npm run build
```

## Not built yet

- Automatic reminder emails 24h and 1h before a call. This needs a cron job; Vercel Cron could call a small route.
- Mentee accounts and booking history. Mentees currently use a private link per booking.
- Rescheduling. For now it's cancel and rebook.
- Zoom as an alternative video provider.
- Admin moderation of mentors and reviews.
