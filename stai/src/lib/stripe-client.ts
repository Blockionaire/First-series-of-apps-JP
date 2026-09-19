import Stripe from "stripe";

/**
 * The Stripe client, alone in a leaf module.
 *
 * Split out of billing.ts for a reachability reason. /api/account/delete is a
 * live free-launch route — GDPR Art. 17 erasure — and it needs to stop billing
 * before deleting an account. It therefore imports stripeClient. If that came
 * from the frozen payment-mutation module, erasure would statically depend on
 * better-sqlite3 and the Workers build would fail on a route that has nothing
 * to do with payments.
 *
 * This file imports Stripe and nothing else: no database, no seam, no billing.
 *
 * With STRIPE_SECRET_KEY unset — which is the free-launch configuration, and
 * what config.ts enforces — this returns null and every caller takes its
 * "no billing to cancel" branch.
 */

let _stripe: Stripe | null = null;

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Pin the API version so a Stripe-side default bump cannot silently change
  // payload shapes under us. Must match the installed SDK's expected version.
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return _stripe;
}
