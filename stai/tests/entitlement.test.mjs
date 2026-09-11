/**
 * Entitlement rules — the single authority for "does this user have STAI+".
 *
 * Exercised directly against SQLite using the same SQL fragment the app uses,
 * so a change to the rule that breaks these assumptions fails here first.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

// Mirror of ENTITLEMENT_SQL in src/lib/billing.ts.
const ENTITLEMENT_SQL = `
  status IN ('active','trialing','past_due')
  AND NOT (
    cancel_at_period_end = 1
    AND current_period_end IS NOT NULL
    AND current_period_end <= CAST(strftime('%s','now') AS INTEGER)
  )
`;

let dir, db;
const now = () => Math.floor(Date.now() / 1000);

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-ent-"));
  db = new Database(path.join(dir, "t.db"));
  db.exec(`
    CREATE TABLE subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0
    );
  `);
});

after(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function entitled(userId) {
  return !!db.prepare(`SELECT 1 FROM subscriptions WHERE user_id=? AND ${ENTITLEMENT_SQL}`).get(userId);
}
function insert(userId, status, opts = {}) {
  db.prepare(
    "INSERT INTO subscriptions (user_id, plan, status, current_period_end, cancel_at_period_end) VALUES (?,?,?,?,?)"
  ).run(userId, opts.plan ?? "monthly", status, opts.periodEnd ?? now() + 86400, opts.cancelAtEnd ? 1 : 0);
}

describe("entitlement by Stripe status", () => {
  test("active grants access", () => {
    insert(1, "active");
    assert.equal(entitled(1), true);
  });

  test("trialing grants access", () => {
    insert(2, "trialing");
    assert.equal(entitled(2), true);
  });

  test("past_due KEEPS access during Stripe's retry window", () => {
    insert(3, "past_due");
    assert.equal(entitled(3), true, "past_due must not revoke access mid-dunning");
  });

  test("past_due keeps access even after the period end has passed", () => {
    // Stripe leaves current_period_end at the old value while retrying.
    insert(4, "past_due", { periodEnd: now() - 86400 });
    assert.equal(entitled(4), true);
  });

  test("unpaid revokes access", () => {
    insert(5, "unpaid");
    assert.equal(entitled(5), false);
  });

  test("canceled revokes access", () => {
    insert(6, "canceled");
    assert.equal(entitled(6), false);
  });

  test("incomplete grants nothing — delayed payment has not settled", () => {
    insert(7, "incomplete");
    assert.equal(entitled(7), false, "SEPA/delayed methods must not grant access before payment");
  });

  test("incomplete_expired grants nothing", () => {
    insert(8, "incomplete_expired");
    assert.equal(entitled(8), false);
  });

  test("paused grants nothing", () => {
    insert(9, "paused");
    assert.equal(entitled(9), false);
  });

  test("no subscription at all grants nothing", () => {
    assert.equal(entitled(999), false);
  });
});

describe("cancellation keeps paid access until the period ends", () => {
  test("cancel_at_period_end with a FUTURE period end still grants access", () => {
    insert(10, "active", { cancelAtEnd: true, periodEnd: now() + 7 * 86400 });
    assert.equal(entitled(10), true, "a member who cancelled keeps what they paid for");
  });

  test("cancel_at_period_end with a PAST period end revokes access", () => {
    insert(11, "active", { cancelAtEnd: true, periodEnd: now() - 60 });
    assert.equal(entitled(11), false);
  });

  test("legacy 'cancelled' spelling grants nothing", () => {
    insert(12, "cancelled");
    assert.equal(entitled(12), false);
  });
});
