/**
 * Payment confirmation: how first_payment_confirmed is earned, that it is
 * sticky and per-subscription, and that webhook order cannot break it.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  makeDb,
  entitled,
  nowSec,
  syncUpsert,
  confirmPayment,
  invoicePaidIsGenuine,
  BILLING_SRC,
} from "./helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEBHOOK_SRC = fs.readFileSync(path.join(ROOT, "src/app/api/stripe/webhook/route.ts"), "utf8");

let db, cleanup;
before(() => ({ db, cleanup } = makeDb()));
after(() => cleanup());

const flag = (subId) =>
  db.prepare("SELECT first_payment_confirmed AS f FROM subscriptions WHERE stripe_subscription=?").get(subId)?.f;

describe("[3] invoice.paid is what sets the flag", () => {
  test("a genuinely paid invoice confirms the subscription", () => {
    syncUpsert(db, { userId: 1, subId: "sub_A", status: "active" });
    assert.equal(flag("sub_A"), 0, "starts unconfirmed");
    assert.equal(entitled(db, 1), false, "no access before payment");

    assert.equal(invoicePaidIsGenuine({ status: "paid", amount_paid: 1900 }), true);
    assert.equal(confirmPayment(db, "sub_A"), true, "the 0→1 transition happened");

    assert.equal(flag("sub_A"), 1);
    assert.equal(entitled(db, 1), true, "access granted only after confirmed payment");
  });

  test("a zero-amount paid invoice is NOT evidence of payment", () => {
    assert.equal(invoicePaidIsGenuine({ status: "paid", amount_paid: 0 }), false);
  });

  test("an unpaid/open invoice is NOT evidence of payment", () => {
    assert.equal(invoicePaidIsGenuine({ status: "open", amount_paid: 0 }), false);
    assert.equal(invoicePaidIsGenuine({ status: "draft", amount_paid: 1900 }), false);
  });
});

describe("[10] duplicate invoice.paid is idempotent", () => {
  test("a replayed invoice.paid changes nothing", () => {
    syncUpsert(db, { userId: 2, subId: "sub_B", status: "active" });
    assert.equal(confirmPayment(db, "sub_B"), true, "first delivery transitions");
    assert.equal(confirmPayment(db, "sub_B"), false, "replay is a no-op");
    assert.equal(confirmPayment(db, "sub_B"), false, "and stays a no-op");
    assert.equal(flag("sub_B"), 1);
    assert.equal(entitled(db, 2), true);
    const rows = db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE stripe_subscription='sub_B'").get();
    assert.equal(rows.n, 1, "no duplicate subscription rows");
  });
});

describe("the flag is sticky across later failures", () => {
  test("a failed renewal moves status to past_due but never clears the flag", () => {
    syncUpsert(db, { userId: 3, subId: "sub_C", status: "active" });
    confirmPayment(db, "sub_C");
    syncUpsert(db, { userId: 3, subId: "sub_C", status: "past_due" }); // invoice.payment_failed
    assert.equal(flag("sub_C"), 1, "stickiness holds");
    assert.equal(entitled(db, 3), true, "member keeps access during dunning");
  });

  test("but an access-revoking status still removes access", () => {
    syncUpsert(db, { userId: 3, subId: "sub_C", status: "unpaid" });
    assert.equal(flag("sub_C"), 1);
    assert.equal(entitled(db, 3), false);
  });
});

describe("[11] confirmation belongs to the subscription, never the user", () => {
  test("a new subscription starts unconfirmed even though the user paid before", () => {
    // Subscription A: paid, then cancelled.
    syncUpsert(db, { userId: 4, subId: "sub_old", status: "active" });
    confirmPayment(db, "sub_old");
    assert.equal(entitled(db, 4), true);
    syncUpsert(db, { userId: 4, subId: "sub_old", status: "canceled" });
    assert.equal(entitled(db, 4), false, "cancelled subscription grants nothing");
    assert.equal(flag("sub_old"), 1, "history is preserved on the old row");

    // Subscription B: brand new Stripe subscription for the SAME user.
    syncUpsert(db, { userId: 4, subId: "sub_new", status: "active" });
    assert.equal(flag("sub_new"), 0, "must start at 0 regardless of user history");
    assert.equal(entitled(db, 4), false, "and must grant nothing until it is paid");

    confirmPayment(db, "sub_new");
    assert.equal(entitled(db, 4), true, "access returns only after the NEW payment confirms");
  });
});

describe("webhook order inversion cannot break the outcome", () => {
  test("subscription.updated BEFORE invoice.paid → correct final state", () => {
    syncUpsert(db, { userId: 5, subId: "sub_D", status: "active" }); // subscription event first
    assert.equal(entitled(db, 5), false, "active alone grants nothing");
    confirmPayment(db, "sub_D"); // invoice.paid second
    assert.equal(entitled(db, 5), true);
  });

  test("invoice.paid BEFORE any subscription update → correct final state", () => {
    // The webhook syncs first, so the row exists before confirmation runs.
    syncUpsert(db, { userId: 6, subId: "sub_E", status: "active" });
    confirmPayment(db, "sub_E");
    assert.equal(entitled(db, 6), true);
    // A later subscription.updated must not disturb the confirmation.
    syncUpsert(db, { userId: 6, subId: "sub_E", status: "active", periodEnd: nowSec() + 60 * 86400 });
    assert.equal(flag("sub_E"), 1);
    assert.equal(entitled(db, 6), true);
  });

  test("confirming an unknown subscription is a safe no-op", () => {
    assert.equal(confirmPayment(db, "sub_does_not_exist"), false);
  });
});

/**
 * Structural guards. The behavioural tests above run against faithful
 * stand-ins; these assert that the real source still embodies the same
 * invariants, so the two cannot drift apart on the points that matter.
 */
describe("production source still embodies the invariants", () => {
  test("confirmFirstPayment guards the transition with first_payment_confirmed=0", () => {
    const fn = BILLING_SRC.match(/export function confirmFirstPayment[\s\S]*?\n}/)?.[0] ?? "";
    assert.match(fn, /first_payment_confirmed=1/, "it sets the flag");
    assert.match(fn, /AND first_payment_confirmed=0/, "and only from 0 — sticky and idempotent");
  });

  test("the UPDATE branch of upsertSubscription never writes the flag", () => {
    const upd = BILLING_SRC.match(/UPDATE subscriptions SET status=@status[\s\S]*?WHERE id=@id`/)?.[0] ?? "";
    assert.ok(upd.length > 0, "the update statement should be findable");
    assert.ok(
      !/first_payment_confirmed/.test(upd),
      "a status sync must never be able to raise or clear the payment flag"
    );
  });

  test("only the sandbox may vouch for a payment at insert time", () => {
    const sandbox = fs.readFileSync(path.join(ROOT, "src/app/api/checkout/sandbox/route.ts"), "utf8");
    assert.match(sandbox, /firstPaymentConfirmed: true/);
    const checkout = fs.readFileSync(path.join(ROOT, "src/app/api/checkout/route.ts"), "utf8");
    assert.ok(!/firstPaymentConfirmed/.test(checkout), "the Stripe path must never set it directly");
  });

  test("invoice.paid requires paid status AND a positive amount", () => {
    assert.match(WEBHOOK_SRC, /inv\.status === "paid"/);
    assert.match(WEBHOOK_SRC, /\(inv\.amount_paid \?\? 0\) > 0/);
  });

  test("checkout.session.completed does not confirm payment", () => {
    const block =
      WEBHOOK_SRC.match(/case "checkout\.session\.completed":[\s\S]*?break;\s*}/)?.[0] ?? "";
    assert.ok(block.length > 0, "the checkout.session.completed case should be findable");
    assert.ok(
      !/confirmFirstPayment/.test(block),
      "completing checkout is not proof of payment and must not confirm"
    );
  });

  test("the webhook syncs before confirming, so event order is irrelevant", () => {
    const paid = WEBHOOK_SRC.match(/case "invoice\.paid":[\s\S]*?^    }/m)?.[0] ?? "";
    const syncAt = paid.indexOf("syncFromStripe");
    const confirmAt = paid.indexOf("confirmFirstPayment");
    assert.ok(syncAt > -1 && confirmAt > -1, "both calls should be present");
    assert.ok(syncAt < confirmAt, "sync must precede confirm so the row is guaranteed to exist");
  });
});
