/** Central place for env-driven configuration and integration mode flags. */

export const APP_NAME = "Mentor Minutes";

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Platform fee in basis points (1500 = 15%). Clamped to 0–50%. */
export function platformFeeBps(): number {
  const raw = Number(process.env.PLATFORM_FEE_BPS ?? 1500);
  if (!Number.isFinite(raw)) return 1500;
  return Math.min(5000, Math.max(0, Math.round(raw)));
}

export function platformFeeCents(priceCents: number): number {
  return Math.round((priceCents * platformFeeBps()) / 10000);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Minutes a slot is held for a mentee while they pay. Stripe requires >= 30. */
export const CHECKOUT_HOLD_MINUTES = 30;

/** Mentees can cancel for a full refund up to this many hours before the call. */
export const MENTEE_CANCEL_CUTOFF_HOURS = 24;

/** Minimum price a mentor can charge (Stripe minimum is $0.50; we use $5). */
export const MIN_PRICE_CENTS = 500;
