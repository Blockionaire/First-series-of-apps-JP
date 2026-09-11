import Stripe from "stripe";
import { db, getSetting, setSetting } from "./db";
import { checkoutAvailable } from "./config";

/**
 * Billing and entitlement.
 *
 * Stripe is the source of truth for subscription state. We never infer status
 * from an event payload alone — on every relevant webhook we re-read the
 * subscription from Stripe and write what it says. That makes the handler
 * naturally idempotent AND order-independent: a duplicate or out-of-order
 * delivery simply rewrites the same current truth.
 *
 * Entitlement is then derived from the stored lifecycle, never from a local
 * "is plus" flag that nothing expires.
 */

export type PlanId = "monthly" | "annual" | "founding";

export const PLANS: Record<PlanId, { label: string; price: string; interval: string; note: string }> = {
  monthly: { label: "STAI+ Monthly", price: "€19", interval: "month", note: "Cancel anytime" },
  annual: { label: "STAI+ Annual", price: "€149", interval: "year", note: "Two months free" },
  founding: { label: "Founding Member", price: "€12", interval: "month", note: "Locked forever — first 200 members only" },
};

/**
 * Statuses that grant access.
 *
 * `past_due` KEEPS access deliberately: Stripe is still retrying the card on
 * the schedule the account configures, and cutting a paying member off during
 * dunning is both hostile and usually wrong. Stripe moves the subscription to
 * `unpaid` or `canceled` when that grace period genuinely ends — those revoke.
 * `incomplete` never grants access, which is what makes delayed payment
 * methods (SEPA) safe: the subscription exists before the money arrives.
 */
export const ACCESS_GRANTING_STATUSES = ["active", "trialing", "past_due"] as const;

/** SQL fragment shared by every entitlement read, so there is exactly one rule. */
export const ENTITLEMENT_SQL = `
  status IN ('active','trialing','past_due')
  AND NOT (
    cancel_at_period_end = 1
    AND current_period_end IS NOT NULL
    AND current_period_end <= CAST(strftime('%s','now') AS INTEGER)
  )
`;

let _stripe: Stripe | null = null;
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Pin the API version so a Stripe-side default bump cannot silently change
  // payload shapes under us. Must match the installed SDK's expected version.
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return _stripe;
}

export { checkoutAvailable };

export function foundingAvailable(): boolean {
  const total = parseInt(getSetting("founding_total") ?? "200", 10);
  const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
  return claimed < total;
}

/** Does this user currently hold STAI+? The single authority for that question. */
export function hasEntitlement(userId: number): boolean {
  const row = db()
    .prepare(`SELECT 1 FROM subscriptions WHERE user_id=? AND ${ENTITLEMENT_SQL} LIMIT 1`)
    .get(userId);
  return !!row;
}

/** Keep users.plan in step for reporting. Entitlement decisions never read it. */
function refreshUserPlan(userId: number) {
  const entitled = hasEntitlement(userId);
  const founding = db()
    .prepare(`SELECT 1 FROM subscriptions WHERE user_id=? AND plan='founding' AND ${ENTITLEMENT_SQL} LIMIT 1`)
    .get(userId);
  db()
    .prepare("UPDATE users SET plan=?, founding=? WHERE id=?")
    .run(entitled ? "plus" : "free", entitled && founding ? 1 : 0, userId);
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
};

/**
 * Insert-or-update one subscription, keyed on the Stripe subscription id.
 *
 * Idempotent by construction: repeated deliveries of the same event rewrite
 * identical values. The founding seat is consumed only on the transition into
 * an access-granting state, and only once per subscription — tracked by the
 * row's own prior status, so a replayed webhook cannot double-count.
 */
export function upsertSubscription(rec: SubscriptionRecord): { entitled: boolean; seatTaken: boolean } {
  const d = db();

  const tx = d.transaction(() => {
    const existing = rec.stripeSubscription
      ? (d
          .prepare("SELECT id, status, plan FROM subscriptions WHERE stripe_subscription=?")
          .get(rec.stripeSubscription) as { id: number; status: string; plan: string } | undefined)
      : undefined;

    const grants = (ACCESS_GRANTING_STATUSES as readonly string[]).includes(rec.status);
    const previouslyGranted =
      !!existing && (ACCESS_GRANTING_STATUSES as readonly string[]).includes(existing.status);

    let effectivePlan: PlanId = rec.plan;
    let seatTaken = false;

    // Consume a founding seat only on the first transition into access, and
    // only while seats remain. Checked inside the transaction so two
    // simultaneous activations cannot both take the last seat.
    if (effectivePlan === "founding" && grants && !previouslyGranted) {
      const total = parseInt(getSetting("founding_total") ?? "200", 10);
      const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
      if (claimed >= total) {
        effectivePlan = "monthly"; // window closed mid-flight; support reconciles the rate
      } else {
        setSetting("founding_claimed", String(claimed + 1));
        seatTaken = true;
      }
    } else if (existing && effectivePlan === "founding") {
      effectivePlan = existing.plan as PlanId; // never re-grade an existing row
    }

    if (existing) {
      d.prepare(
        `UPDATE subscriptions SET status=@status, stripe_customer=@customer,
           current_period_end=@periodEnd, cancel_at_period_end=@cancelAtEnd,
           renews_at=@renewsAt, updated_at=datetime('now')
         WHERE id=@id`
      ).run({
        id: existing.id,
        status: rec.status,
        customer: rec.stripeCustomer ?? null,
        periodEnd: rec.currentPeriodEnd ?? null,
        cancelAtEnd: rec.cancelAtPeriodEnd ? 1 : 0,
        renewsAt: rec.currentPeriodEnd ? new Date(rec.currentPeriodEnd * 1000).toISOString() : null,
      });
    } else {
      d.prepare(
        `INSERT INTO subscriptions
           (user_id, plan, status, provider, stripe_customer, stripe_subscription,
            current_period_end, cancel_at_period_end, renews_at, updated_at)
         VALUES (@userId, @plan, @status, @provider, @customer, @subscription,
                 @periodEnd, @cancelAtEnd, @renewsAt, datetime('now'))`
      ).run({
        userId: rec.userId,
        plan: effectivePlan,
        status: rec.status,
        provider: rec.provider,
        customer: rec.stripeCustomer ?? null,
        subscription: rec.stripeSubscription ?? null,
        periodEnd: rec.currentPeriodEnd ?? null,
        cancelAtEnd: rec.cancelAtPeriodEnd ? 1 : 0,
        renewsAt: rec.currentPeriodEnd ? new Date(rec.currentPeriodEnd * 1000).toISOString() : null,
      });
    }

    refreshUserPlan(rec.userId);
    return { entitled: hasEntitlement(rec.userId), seatTaken };
  });

  return tx();
}

/**
 * Re-read a subscription from Stripe and store what it says.
 * Order-independent and idempotent — this is the only write path for Stripe.
 */
export async function syncFromStripe(subscriptionId: string): Promise<boolean> {
  const stripe = stripeClient();
  if (!stripe) return false;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = Number(sub.metadata?.userId);
  const plan = (sub.metadata?.plan ?? "monthly") as PlanId;
  if (!userId || !PLANS[plan]) return false;

  // The period end lives on the subscription item in current API versions.
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null;

  upsertSubscription({
    userId,
    plan,
    provider: "stripe",
    status: sub.status,
    stripeCustomer: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripeSubscription: sub.id,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  });
  return true;
}

/**
 * Request cancellation: Stripe stops renewing, the member keeps what they paid
 * for. Access is removed only when Stripe reports an access-revoking status,
 * or when the paid period has actually elapsed.
 */
export async function requestCancellation(userId: number): Promise<{ ok: boolean; endsAt: number | null }> {
  const sub = activeSubscription(userId);
  if (!sub) return { ok: false, endsAt: null };

  const stripe = stripeClient();
  if (sub.provider === "stripe" && sub.stripe_subscription && stripe) {
    await stripe.subscriptions.update(sub.stripe_subscription, { cancel_at_period_end: true });
    await syncFromStripe(sub.stripe_subscription);
    const after = activeSubscription(userId);
    return { ok: true, endsAt: after?.current_period_end ?? null };
  }

  // Sandbox (development only): mark pending locally; the shared entitlement
  // rule expires it when the period ends.
  db()
    .prepare("UPDATE subscriptions SET cancel_at_period_end=1, updated_at=datetime('now') WHERE id=?")
    .run(sub.id);
  refreshUserPlan(userId);
  return { ok: true, endsAt: sub.current_period_end ?? null };
}

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
export function activeSubscription(userId: number): StoredSubscription | undefined {
  return db()
    .prepare(`SELECT * FROM subscriptions WHERE user_id=? AND ${ENTITLEMENT_SQL} ORDER BY id DESC LIMIT 1`)
    .get(userId) as StoredSubscription | undefined;
}

/** The most recent subscription regardless of state — for account display. */
export function latestSubscription(userId: number): StoredSubscription | undefined {
  return db()
    .prepare("SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1")
    .get(userId) as StoredSubscription | undefined;
}
