import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { currentUser, endSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { activeSubscription, stripeClient } from "@/lib/billing";
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
  const blocked = guard(req, "account-delete", 5, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { password } = await req.json().catch(() => ({}));
  const row = db().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id) as
    | { password_hash: string }
    | undefined;
  if (!row || typeof password !== "string" || !(await bcrypt.compare(password, row.password_hash))) {
    return NextResponse.json({ error: "Password didn't match" }, { status: 403 });
  }

  // Stop billing before the record disappears, or the customer keeps paying
  // for an account that no longer exists.
  const sub = activeSubscription(user.id) as { stripe_subscription?: string | null } | undefined;
  const stripe = stripeClient();
  if (stripe && sub?.stripe_subscription) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription);
    } catch {
      // Proceed with erasure regardless; billing is reconciled from the
      // Stripe dashboard rather than blocking a data-subject right.
    }
  }

  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM newsletter WHERE email=?").run(user.email);
    d.prepare("DELETE FROM usage_counters WHERE actor=?").run(`user:${user.id}`);
    // bookmarks, saved_answers, sessions and subscriptions cascade
    d.prepare("DELETE FROM users WHERE id=?").run(user.id);
  })();

  await endSession();
  return NextResponse.json({ ok: true });
}
