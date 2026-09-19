import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { currentUser, endSession } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { activeSubscription } from "@/lib/billing";
import { stripeClient } from "@/lib/stripe-client";
import { guard, WINDOW } from "@/lib/ratelimit";

/**
 * GDPR Art. 17 erasure. Everything tied to the account goes in one
 * transaction — bookmarks, saved answers, sessions and subscription records
 * cascade from the users row. Re-authentication is required because deletion
 * is irreversible and must not be triggerable by a borrowed session.
 *
 * Newsletter subscriptions are keyed by email, not user id, so they are
 * removed explicitly rather than left orphaned.
 */
export async function POST(req: NextRequest) {
  const blocked = await guard(req, "account-delete", 5, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { password } = await req.json().catch(() => ({}));
  const row = await sql().first<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=?",
    [user.id]
  );
  if (!row || typeof password !== "string" || !(await bcrypt.compare(password, row.password_hash))) {
    return NextResponse.json({ error: "Password didn't match" }, { status: 403 });
  }

  // Stop billing before the record disappears, or the customer keeps paying
  // for an account that no longer exists.
  const sub = await activeSubscription(user.id);
  const stripe = stripeClient();
  if (stripe && sub?.stripe_subscription) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription);
    } catch {
      // Proceed with erasure regardless; billing is reconciled from the
      // Stripe dashboard rather than blocking a data-subject right.
    }
  }

  // All-or-nothing: a partial erasure that leaves the users row but drops the
  // newsletter record (or the reverse) is the one outcome Art. 17 cannot
  // tolerate. batch() is atomic on both engines — no statement here reads a
  // value the next one depends on, so it needs no interactive transaction.
  await sql().batch([
    { sql: "DELETE FROM newsletter WHERE email=?", params: [user.email] },
    { sql: "DELETE FROM usage_counters WHERE actor=?", params: [`user:${user.id}`] },
    // bookmarks, saved_answers, sessions and subscriptions cascade
    { sql: "DELETE FROM users WHERE id=?", params: [user.id] },
  ]);

  await endSession();
  return NextResponse.json({ ok: true });
}
