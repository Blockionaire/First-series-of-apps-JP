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

export function activateSubscription(
  userId: number,
  plan: PlanId,
  provider: "stripe" | "sandbox",
  stripeIds?: { customer?: string; subscription?: string }
) {
  const d = db();
  const renews = new Date(Date.now() + (plan === "annual" ? 365 : 30) * 864e5).toISOString();
  const tx = d.transaction(() => {
    d.prepare(
      `INSERT INTO subscriptions (user_id, plan, status, provider, stripe_customer, stripe_subscription, renews_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?)`
    ).run(userId, plan, provider, stripeIds?.customer ?? null, stripeIds?.subscription ?? null, renews);
    d.prepare("UPDATE users SET plan='plus', founding=? WHERE id=?").run(plan === "founding" ? 1 : 0, userId);
    if (plan === "founding") {
      const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
      setSetting("founding_claimed", String(claimed + 1));
    }
  });
  tx();
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
