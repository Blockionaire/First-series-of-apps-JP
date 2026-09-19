import { db } from "./db";
import { sql } from "./sql";
import { ENTITLEMENT_SQL } from "./entitlement";
import { stripeClient } from "./stripe-client";
import { PLANS, activeSubscription, type PlanId, type SubscriptionRecord } from "./billing";

export { stripeClient };

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  FROZEN — payment mutation. Deferred to the paid launch.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Everything that CHANGES subscription state lives here, and nothing else
 * does. This file is quarantined for one concrete reason: it is the only
 * module outside the Node database driver that imports ./db, and ./db imports
 * better-sqlite3 — a native addon Cloudflare Workers cannot load at all.
 *
 * Why it still imports ./db: upsertSubscription() and confirmFirstPayment()
 * each READ a value and then decide what to write based on it, inside a
 * transaction. D1 has no interactive transaction that can express that; it
 * would have to become a compare-and-swap. That is a behavioural change to
 * money-handling code, so it is deferred to the paid launch rather than done
 * in passing during a free-launch migration. See PAID_LAUNCH_BACKLOG.md.
 *
 * NOTHING IN THIS FILE HAS BEEN CHANGED. The functions below were moved out
 * of billing.ts verbatim. Their behaviour, their SQL and their invariants are
 * exactly what the payment-confirmation and entitlement tests already assert.
 *
 * Reachability: only the payment routes import this module, and every one of
 * them refuses before doing any work while STRIPE_SECRET_KEY is unset — which
 * it is, and must remain, for the free launch. Read paths that the live site
 * genuinely needs (activeSubscription, hasEntitlement, PLANS) stayed in
 * billing.ts and go through the async seam.
 */

function getSettingSync(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key=?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function setSettingSync(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    )
    .run(key, value);
}

function hasEntitlementSync(userId: number): boolean {
  return !!db()
    .prepare(`SELECT 1 FROM subscriptions WHERE user_id=? AND ${ENTITLEMENT_SQL} LIMIT 1`)
    .get(userId);
}

/** Keep users.plan in step for reporting. Entitlement decisions never read it. */
function refreshUserPlan(userId: number) {
  const entitled = hasEntitlementSync(userId);
  const founding = db()
    .prepare(`SELECT 1 FROM subscriptions WHERE user_id=? AND plan='founding' AND ${ENTITLEMENT_SQL} LIMIT 1`)
    .get(userId);
  db()
    .prepare("UPDATE users SET plan=?, founding=? WHERE id=?")
    .run(entitled ? "plus" : "free", entitled && founding ? 1 : 0, userId);
}

/* SubscriptionRecord is declared in ./billing and imported above. */

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
  const total = parseInt(getSettingSync("founding_total") ?? "200", 10);
  const claimed = parseInt(getSettingSync("founding_claimed") ?? "0", 10);
  if (claimed >= total) {
    // Window closed mid-flight; support reconciles the rate.
    return { plan: "monthly", seatTaken: false };
  }
  setSettingSync("founding_claimed", String(claimed + 1));
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
    return { entitled: hasEntitlementSync(rec.userId), seatTaken };
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
  const sub = await activeSubscription(userId);
  if (!sub) return { ok: false, endsAt: null };

  const stripe = stripeClient();
  if (sub.provider === "stripe" && sub.stripe_subscription && stripe) {
    await stripe.subscriptions.update(sub.stripe_subscription, { cancel_at_period_end: true });
    await syncFromStripe(sub.stripe_subscription);
    const after = await activeSubscription(userId);
    return { ok: true, endsAt: after?.current_period_end ?? null };
  }

  // Sandbox (development only): mark pending locally; the shared entitlement
  // rule expires it when the period ends.
  await sql().run(
    "UPDATE subscriptions SET cancel_at_period_end=1, updated_at=datetime('now') WHERE id=?",
    [sub.id]
  );
  refreshUserPlan(userId);
  return { ok: true, endsAt: sub.current_period_end ?? null };
}

