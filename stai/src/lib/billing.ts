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
 * Statuses that can grant access — but only alongside a confirmed payment.
 *
 * `past_due` KEEPS access deliberately: Stripe is still retrying the card on
 * the schedule the account configures, and cutting a paying member off during
 * dunning is hostile and usually wrong. Stripe moves the subscription to
 * `unpaid` or `canceled` when that grace period genuinely ends — those revoke.
 *
 * `trialing` is absent: we offer no trials, so implementing hypothetical trial
 * behaviour would be untested code guarding real money.
 */
export const ACCESS_GRANTING_STATUSES = ["active", "past_due"] as const;

/**
 * The one entitlement rule.
 *
 * `first_payment_confirmed` is the load-bearing clause. Subscription status
 * alone cannot express "money actually arrived": with asynchronous payment
 * methods (SEPA Direct Debit, and the iDEAL/Bancontact mandates that become
 * SEPA), Stripe can report a subscription as `active` while the initial
 * PaymentIntent is still `processing`, and can leave it `active` after that
 * payment later fails. A first invoice that fails outright lands in `past_due`.
 * In all three cases status-only entitlement would hand out premium for money
 * that never arrived.
 *
 * So: positive confirmation first, status second.
 */
export const ENTITLEMENT_SQL = `
  first_payment_confirmed = 1
  AND status IN ('active','past_due')
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
  /**
   * ONLY the development sandbox may set this at creation, where it stands in
   * for a payment that really did succeed. The Stripe path must leave it false
   * and let invoice.paid confirm — checkout.session.completed, an `active`
   * status and a `past_due` status are each insufficient proof of payment.
   */
  firstPaymentConfirmed?: boolean;
};

/**
 * Claim a founding seat for a subscription that has just become genuinely
 * entitled. Caller must already be inside a transaction.
 *
 * Tied to the payment-confirmation transition rather than to status, so an
 * unpaid SEPA subscription sitting at `active` cannot burn one of the 200.
 * Returns the plan the row should carry.
 */
function claimFoundingSeat(plan: PlanId): { plan: PlanId; seatTaken: boolean } {
  if (plan !== "founding") return { plan, seatTaken: false };
  const total = parseInt(getSetting("founding_total") ?? "200", 10);
  const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
  if (claimed >= total) {
    // Window closed mid-flight; support reconciles the rate.
    return { plan: "monthly", seatTaken: false };
  }
  setSetting("founding_claimed", String(claimed + 1));
  return { plan: "founding", seatTaken: true };
}

/**
 * Insert-or-update one subscription, keyed on the Stripe subscription id.
 *
 * Idempotent by construction: a repeated delivery rewrites identical values.
 * The UPDATE branch deliberately omits first_payment_confirmed — the flag is
 * sticky, and only confirmFirstPayment() may raise it.
 */
export function upsertSubscription(rec: SubscriptionRecord): { entitled: boolean; seatTaken: boolean } {
  const d = db();

  const tx = d.transaction(() => {
    const existing = rec.stripeSubscription
      ? (d
          .prepare("SELECT id, status, plan FROM subscriptions WHERE stripe_subscription=?")
          .get(rec.stripeSubscription) as { id: number; status: string; plan: string } | undefined)
      : undefined;

    let effectivePlan: PlanId = rec.plan;
    let seatTaken = false;

    if (existing) {
      // Never re-grade or re-price an existing row from a later event.
      effectivePlan = existing.plan as PlanId;
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
      // A brand-new subscription always begins unconfirmed unless the sandbox
      // explicitly vouches for it. Nothing about the user's history carries
      // over: confirmation is a property of this subscription alone.
      const confirmed = rec.firstPaymentConfirmed ? 1 : 0;
      if (confirmed === 1) {
        const claim = claimFoundingSeat(effectivePlan);
        effectivePlan = claim.plan;
        seatTaken = claim.seatTaken;
      }
      d.prepare(
        `INSERT INTO subscriptions
           (user_id, plan, status, provider, stripe_customer, stripe_subscription,
            current_period_end, cancel_at_period_end, renews_at, updated_at,
            first_payment_confirmed)
         VALUES (@userId, @plan, @status, @provider, @customer, @subscription,
                 @periodEnd, @cancelAtEnd, @renewsAt, datetime('now'), @confirmed)`
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
        confirmed,
      });
    }

    refreshUserPlan(rec.userId);
    return { entitled: hasEntitlement(rec.userId), seatTaken };
  });

  return tx();
}

/**
 * Positively confirm that THIS subscription has received a successful payment.
 *
 * The only path that may raise first_payment_confirmed on a Stripe
 * subscription. Driven exclusively by invoice.paid — never by
 * checkout.session.completed, never by an `active` status, never by
 * `past_due`, none of which prove money arrived.
 *
 * Sticky and idempotent: the WHERE clause makes the 0→1 transition happen at
 * most once, so a duplicate invoice.paid changes nothing and cannot claim a
 * second founding seat. A later renewal failure never clears it.
 *
 * Returns true only on the transition itself.
 */
export function confirmFirstPayment(stripeSubscriptionId: string): boolean {
  const d = db();

  const tx = d.transaction((): boolean => {
    const row = d
      .prepare(
        "SELECT id, user_id, plan, first_payment_confirmed FROM subscriptions WHERE stripe_subscription=?"
      )
      .get(stripeSubscriptionId) as
      | { id: number; user_id: number; plan: PlanId; first_payment_confirmed: number }
      | undefined;
    // No mapping to a STAI subscription — nothing to confirm. Fails closed.
    if (!row) return false;
    if (row.first_payment_confirmed === 1) return false; // already confirmed; idempotent

    const claim = claimFoundingSeat(row.plan);
    const info = d
      .prepare(
        "UPDATE subscriptions SET plan=?, first_payment_confirmed=1, updated_at=datetime('now') WHERE id=? AND first_payment_confirmed=0"
      )
      .run(claim.plan, row.id);
    if (info.changes === 0) return false;

    refreshUserPlan(row.user_id);
    return true;
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
