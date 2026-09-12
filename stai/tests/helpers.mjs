/**
 * Test helpers.
 *
 * The entitlement rule is EXTRACTED FROM THE REAL SOURCE rather than restated
 * here. A test that restates production SQL can pass while production is
 * broken; this one runs the exact string the application runs, so editing the
 * rule immediately shows up in these results.
 */
import fs from "fs";
import path from "path";
import os from "os";
import Database from "better-sqlite3";

const ROOT = path.resolve(import.meta.dirname, "..");
export const BILLING_SRC = fs.readFileSync(path.join(ROOT, "src/lib/billing.ts"), "utf8");

/** The production ENTITLEMENT_SQL, lifted verbatim from src/lib/billing.ts. */
export function entitlementSql() {
  const m = BILLING_SRC.match(/export const ENTITLEMENT_SQL = `([\s\S]*?)`;/);
  if (!m) throw new Error("ENTITLEMENT_SQL not found in src/lib/billing.ts — has it been renamed?");
  return m[1];
}

/** Mirrors the real subscriptions table for the columns entitlement depends on. */
export function makeDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-test-"));
  const db = new Database(path.join(dir, "t.db"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan TEXT NOT NULL DEFAULT 'free',
      founding INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'stripe',
      stripe_subscription TEXT,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      first_payment_confirmed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
    CREATE UNIQUE INDEX idx_sub_stripe ON subscriptions(stripe_subscription)
      WHERE stripe_subscription IS NOT NULL;
    INSERT INTO settings (key,value) VALUES ('founding_total','200'),('founding_claimed','0');
  `);
  return { db, dir, cleanup: () => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

export const nowSec = () => Math.floor(Date.now() / 1000);

export function entitled(db, userId) {
  return !!db.prepare(`SELECT 1 FROM subscriptions WHERE user_id=? AND ${entitlementSql()}`).get(userId);
}

/**
 * Faithful stand-ins for the two production write paths. The invariant each
 * one embodies is additionally asserted structurally against the real source
 * in payment-confirmation.test.mjs, so these cannot silently diverge on the
 * points that matter.
 */
export function syncUpsert(db, { userId, subId, status, plan = "monthly", periodEnd = nowSec() + 30 * 86400, cancelAtEnd = false }) {
  const existing = db.prepare("SELECT id FROM subscriptions WHERE stripe_subscription=?").get(subId);
  if (existing) {
    // NOTE: first_payment_confirmed is deliberately absent — the flag is sticky.
    db.prepare(
      `UPDATE subscriptions SET status=?, current_period_end=?, cancel_at_period_end=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(status, periodEnd, cancelAtEnd ? 1 : 0, existing.id);
  } else {
    db.prepare(
      `INSERT INTO subscriptions (user_id, plan, status, stripe_subscription, current_period_end, cancel_at_period_end, first_payment_confirmed)
       VALUES (?,?,?,?,?,?,0)`
    ).run(userId, plan, status, subId, periodEnd, cancelAtEnd ? 1 : 0);
  }
}

/** Mirrors confirmFirstPayment(): sticky, idempotent, at most one 0→1 transition. */
export function confirmPayment(db, subId) {
  const info = db
    .prepare(
      "UPDATE subscriptions SET first_payment_confirmed=1, updated_at=datetime('now') WHERE stripe_subscription=? AND first_payment_confirmed=0"
    )
    .run(subId);
  return info.changes === 1;
}

/** Mirrors the webhook's invoice.paid gate: paid status AND a positive amount. */
export function invoicePaidIsGenuine(invoice) {
  return invoice.status === "paid" && (invoice.amount_paid ?? 0) > 0;
}
