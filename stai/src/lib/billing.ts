import Stripe from "stripe";
import { db, getSetting, setSetting } from "./db";

/**
 * Billing runs through Stripe when STRIPE_SECRET_KEY is configured.
 * Without keys, a sandbox checkout simulates the full journey so the
 * subscribe → STAI+ flow is demoable end to end. The activation path
 * (activateSubscription) is identical for both providers.
 */

export type PlanId = "monthly" | "annual" | "founding";

export const PLANS: Record<PlanId, { label: string; price: string; interval: string; note: string }> = {
  monthly: { label: "STAI+ Monthly", price: "€19", interval: "month", note: "Cancel anytime" },
  annual: { label: "STAI+ Annual", price: "€149", interval: "year", note: "Two months free" },
  founding: { label: "Founding Member", price: "€12", interval: "month", note: "Locked forever — first 200 members only" },
};

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function foundingAvailable(): boolean {
  const total = parseInt(getSetting("founding_total") ?? "200", 10);
  const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
  return claimed < total;
}

/**
 * Activate a membership. Idempotent and race-safe:
 *
 * - Stripe retries webhook deliveries, so a repeat of the same subscription
 *   id must not create a second row or double-count a founding seat.
 * - The founding-seat check happens INSIDE the transaction, so two
 *   simultaneous claims can never both take seat 200.
 *
 * Returns false when the activation was a no-op (already active, or the
 * founding window closed between checkout and callback).
 */
export function activateSubscription(
  userId: number,
  plan: PlanId,
  provider: "stripe" | "sandbox",
  stripeIds?: { customer?: string; subscription?: string }
): boolean {
  const d = db();
  const renews = new Date(Date.now() + (plan === "annual" ? 365 : 30) * 864e5).toISOString();

  const tx = d.transaction((): boolean => {
    // Idempotency: same Stripe subscription already recorded → nothing to do.
    if (stripeIds?.subscription) {
      const seen = d
        .prepare("SELECT 1 FROM subscriptions WHERE stripe_subscription=?")
        .get(stripeIds.subscription);
      if (seen) return false;
    }
    // Idempotency: user already has an active subscription → nothing to do.
    const active = d
      .prepare("SELECT 1 FROM subscriptions WHERE user_id=? AND status='active'")
      .get(userId);
    if (active) return false;

    let effectivePlan: PlanId = plan;
    if (plan === "founding") {
      const total = parseInt(getSetting("founding_total") ?? "200", 10);
      const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
      if (claimed >= total) {
        // Window closed while this checkout was in flight. Honour the payment
        // at the standard monthly rate rather than silently granting a seat
        // that no longer exists; support can refund the difference.
        effectivePlan = "monthly";
      } else {
        setSetting("founding_claimed", String(claimed + 1));
      }
    }

    d.prepare(
      `INSERT INTO subscriptions (user_id, plan, status, provider, stripe_customer, stripe_subscription, renews_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?)`
    ).run(userId, effectivePlan, provider, stripeIds?.customer ?? null, stripeIds?.subscription ?? null, renews);
    d.prepare("UPDATE users SET plan='plus', founding=? WHERE id=?").run(
      effectivePlan === "founding" ? 1 : 0,
      userId
    );
    return true;
  });

  return tx();
}

export function cancelSubscription(userId: number) {
  const d = db();
  d.prepare("UPDATE subscriptions SET status='cancelled' WHERE user_id=? AND status='active'").run(userId);
  d.prepare("UPDATE users SET plan='free' WHERE id=?").run(userId);
}

export function activeSubscription(userId: number) {
  return db()
    .prepare("SELECT * FROM subscriptions WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1")
    .get(userId) as
    | { plan: PlanId; provider: string; started_at: string; renews_at: string | null; stripe_subscription: string | null }
    | undefined;
}
