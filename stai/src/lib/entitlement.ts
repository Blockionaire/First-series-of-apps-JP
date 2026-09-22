/**
 * The entitlement rule, and nothing else.
 *
 * Extracted from billing.ts verbatim — same bytes, same semantics — purely to
 * break a build dependency. auth.ts needs ENTITLEMENT_SQL on every request,
 * and importing it from billing.ts dragged billing's frozen payment-mutation
 * code (and through it better-sqlite3) into every page of the free site.
 *
 * This module imports NOTHING. That is the point: it can be read from the
 * Workers runtime, from Node, and from the test suite without pulling a
 * database engine, a Stripe client or any payment code behind it.
 *
 * Do not add logic here. Entitlement decisions are made by the SQL below and
 * by lib/billing.ts; payment mutation lives in lib/billing-frozen.ts and is
 * deferred to the paid launch.
 */


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

/**
 * A live complimentary grant.
 *
 * The second way to be entitled, and deliberately a SEPARATE rule over a
 * separate table rather than a forged subscription. `subscriptions` is the
 * record of money; putting a payment that never happened into it would show a
 * price nobody was charged on /account and would break reconciliation the day
 * real payments are switched on.
 *
 * Granting free access is not a payment event and must never look like one.
 * This module still imports nothing, so the rule stays readable from Workers,
 * from Node and from the tests without dragging billing code behind it.
 */
export const GRANT_SQL = `
  revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
`;

/**
 * How someone came by their access.
 *
 * `plan` stays "free" | "plus" so that every existing gate on the platform —
 * articles, prompts, the Ask STAI quota — keeps working untouched. This says
 * WHY, which the account page needs in order to avoid telling a comped member
 * they are paying, or an admin that their subscription renews next month.
 */
export type AccessKind = "paid" | "granted" | "admin" | "none";
