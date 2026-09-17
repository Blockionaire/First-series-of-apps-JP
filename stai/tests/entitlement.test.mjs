/**
 * Entitlement rules — the single authority for "does this user have STAI+".
 *
 * Runs the REAL ENTITLEMENT_SQL extracted from src/lib/billing.ts, so these
 * results describe production behaviour rather than a restatement of it.
 *
 * The governing invariant:
 *   No account receives its FIRST premium entitlement until Stripe has
 *   positively confirmed a successful payment for that subscription.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeDb, entitled, nowSec, entitlementSql } from "./helpers.mjs";

let db, cleanup;
let nextUser = 1;

before(() => {
  ({ db, cleanup } = makeDb());
});
after(() => cleanup());

/** Creates a user with one subscription in the given state; returns the user id. */
function sub(status, opts = {}) {
  const userId = nextUser++;
  db.prepare(
    `INSERT INTO subscriptions
       (user_id, plan, status, stripe_subscription, current_period_end, cancel_at_period_end, first_payment_confirmed)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    userId,
    opts.plan ?? "monthly",
    status,
    `sub_${userId}`,
    opts.periodEnd ?? nowSec() + 86400,
    opts.cancelAtEnd ? 1 : 0,
    opts.confirmed ? 1 : 0
  );
  return userId;
}

describe("the rule under test is the production rule", () => {
  test("ENTITLEMENT_SQL requires a confirmed first payment", () => {
    assert.match(entitlementSql(), /first_payment_confirmed\s*=\s*1/);
  });

  test("ENTITLEMENT_SQL no longer grants on 'trialing'", () => {
    assert.ok(!/trialing/.test(entitlementSql()), "we offer no trials; the state must not appear");
  });
});

describe("unconfirmed payment never grants premium", () => {
  test("[1] active + first_payment_confirmed=0 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("active", { confirmed: false })), false);
  });

  test("[2] past_due + first_payment_confirmed=0 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("past_due", { confirmed: false })), false);
  });

  test("[8] async initial payment still processing, subscription already active → NO ACCESS", () => {
    // SEPA: Stripe reports the subscription as active while the PaymentIntent
    // is still `processing`. No invoice.paid has arrived, so the flag is 0.
    assert.equal(entitled(db, sub("active", { confirmed: false })), false);
  });

  test("[9] async initial payment FAILED but Stripe left the subscription active → NO ACCESS", () => {
    // The dangerous case: status alone would have granted premium for money
    // that never arrived.
    assert.equal(entitled(db, sub("active", { confirmed: false })), false);
  });

  test("[12] checkout.session.completed without successful payment → NO ACCESS", () => {
    // checkout.session.completed never sets the flag; the row exists at
    // whatever status Stripe reports, unconfirmed.
    assert.equal(entitled(db, sub("incomplete", { confirmed: false })), false);
    assert.equal(entitled(db, sub("active", { confirmed: false })), false);
  });
});

describe("confirmed payment grants premium for live statuses only", () => {
  test("[4] active + confirmed=1 → ACCESS", () => {
    assert.equal(entitled(db, sub("active", { confirmed: true })), true);
  });

  test("[5] past_due + confirmed=1 → ACCESS (Stripe's retry window)", () => {
    assert.equal(entitled(db, sub("past_due", { confirmed: true })), true);
  });

  test("[5b] past_due + confirmed=1 keeps access past the old period end", () => {
    assert.equal(entitled(db, sub("past_due", { confirmed: true, periodEnd: nowSec() - 86400 })), true);
  });

  test("[6] unpaid + confirmed=1 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("unpaid", { confirmed: true })), false);
  });

  test("[7] canceled + confirmed=1 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("canceled", { confirmed: true })), false);
  });

  test("incomplete + confirmed=1 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("incomplete", { confirmed: true })), false);
  });

  test("incomplete_expired + confirmed=1 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("incomplete_expired", { confirmed: true })), false);
  });

  test("paused + confirmed=1 → NO ACCESS", () => {
    assert.equal(entitled(db, sub("paused", { confirmed: true })), false);
  });

  test("trialing + confirmed=1 → NO ACCESS (trials are not offered)", () => {
    assert.equal(entitled(db, sub("trialing", { confirmed: true })), false);
  });

  test("legacy 'cancelled' spelling → NO ACCESS", () => {
    assert.equal(entitled(db, sub("cancelled", { confirmed: true })), false);
  });

  test("no subscription at all → NO ACCESS", () => {
    assert.equal(entitled(db, 99999), false);
  });
});

describe("cancellation keeps paid access until the period ends", () => {
  test("cancel_at_period_end with a FUTURE period end still grants access", () => {
    assert.equal(
      entitled(db, sub("active", { confirmed: true, cancelAtEnd: true, periodEnd: nowSec() + 7 * 86400 })),
      true
    );
  });

  test("cancel_at_period_end with a PAST period end revokes access", () => {
    assert.equal(
      entitled(db, sub("active", { confirmed: true, cancelAtEnd: true, periodEnd: nowSec() - 60 })),
      false
    );
  });

  test("a cancelled-but-unconfirmed subscription never granted anything", () => {
    assert.equal(
      entitled(db, sub("active", { confirmed: false, cancelAtEnd: true, periodEnd: nowSec() + 7 * 86400 })),
      false
    );
  });
});
