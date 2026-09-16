import { getSetting } from "./settings";
import { sql } from "./sql";
import { checkoutAvailable } from "./config";
import { ENTITLEMENT_SQL } from "./entitlement";

/**
 * Billing READ paths and plan metadata.
 *
 * Stripe is the source of truth for subscription state. We never infer status
 * from an event payload alone — on every relevant webhook we re-read the
 * subscription from Stripe and write what it says. That makes the handler
 * naturally idempotent AND order-independent: a duplicate or out-of-order
 * delivery simply rewrites the same current truth.
 *
 * Entitlement is then derived from the stored lifecycle, never from a local
 * "is plus" flag that nothing expires.
 *
 * ── What is NOT here ──────────────────────────────────────────────────────
 * Everything that MUTATES subscription state — upsertSubscription,
 * confirmFirstPayment, syncFromStripe, requestCancellation, the founding-seat
 * claim and the Stripe client — moved verbatim to ./billing-frozen, which is
 * quarantined because it is the only module besides the Node database driver
 * that imports ./db, and ./db imports a native addon Workers cannot load.
 *
 * This file stays on the async seam, so the free site can read subscription
 * state on Workers without pulling any of that behind it. Nothing here writes.
 */

export { ENTITLEMENT_SQL };
export { ACCESS_GRANTING_STATUSES } from "./entitlement";

export type PlanId = "monthly" | "annual" | "founding";

export const PLANS: Record<PlanId, { label: string; price: string; interval: string; note: string }> = {
  monthly: { label: "STAI+ Monthly", price: "€19", interval: "month", note: "Cancel anytime" },
  annual: { label: "STAI+ Annual", price: "€149", interval: "year", note: "Two months free" },
  founding: { label: "Founding Member", price: "€12", interval: "month", note: "Locked forever — first 200 members only" },
};

export { checkoutAvailable };

export async function foundingAvailable(): Promise<boolean> {
  const total = parseInt((await getSetting("founding_total")) ?? "200", 10);
  const claimed = parseInt((await getSetting("founding_claimed")) ?? "0", 10);
  return claimed < total;
}

/** Does this user currently hold STAI+? The single authority for that question. */
export async function hasEntitlement(userId: number): Promise<boolean> {
  const row = await sql().first(
    `SELECT 1 AS ok FROM subscriptions WHERE user_id=? AND ${ENTITLEMENT_SQL} LIMIT 1`,
    [userId]
  );
  return !!row;
}

export type SubscriptionRecord = {
  userId: number;
  plan: PlanId;
  provider: "stripe" | "sandbox";
  status: string;
  stripeCustomer?: string | null;
  stripeSubscription?: string | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  /**
   * ONLY the development sandbox may set this at creation, where it stands in
   * for a payment that really did succeed. The Stripe path must leave it false
   * and let invoice.paid confirm — checkout.session.completed, an `active`
   * status and a `past_due` status are each insufficient proof of payment.
   */
  firstPaymentConfirmed?: boolean;
};


export type StoredSubscription = {
  id: number;
  plan: PlanId;
  provider: string;
  status: string;
  started_at: string;
  renews_at: string | null;
  stripe_subscription: string | null;
  stripe_customer: string | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
};

/** The subscription that currently grants access, if any. */
export async function activeSubscription(userId: number): Promise<StoredSubscription | null> {
  return sql().first<StoredSubscription>(
    `SELECT * FROM subscriptions WHERE user_id=? AND ${ENTITLEMENT_SQL} ORDER BY id DESC LIMIT 1`,
    [userId]
  );
}

/** The most recent subscription regardless of state — for account display. */
export async function latestSubscription(userId: number): Promise<StoredSubscription | null> {
  return sql().first<StoredSubscription>(
    "SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1",
    [userId]
  );
}
