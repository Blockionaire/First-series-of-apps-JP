import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { guard, WINDOW } from "@/lib/ratelimit";
import { grantAccess, revokeAccess } from "@/lib/access";

/**
 * Granting and withdrawing complimentary STAI+.
 *
 * ── What this route cannot do ───────────────────────────────────────────
 * It does not touch `subscriptions`, does not set `first_payment_confirmed`,
 * does not reach a payment provider and does not import billing. A grant is a
 * row in `access_grants` and nothing else, which is what keeps the payment
 * record honest: when payments are switched on, every subscription is still
 * expected to match something at the provider, and a comped account is simply
 * not a subscription.
 *
 * Admin only, and every grant records who made it. "Somebody has free access
 * and nobody knows why" is the failure this is shaped to prevent, which is
 * also why a reason is required rather than optional.
 */
export async function POST(req: NextRequest) {
  const blocked = await guard(req, "admin-access", 60, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");

  if (action === "grant") {
    const result = await grantAccess({
      email: String(b.email ?? ""),
      reason: String(b.reason ?? ""),
      expiresOn: String(b.expires_on ?? ""),
      actor: user.email,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "revoke") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A grant id is required" }, { status: 400 });
    }
    const done = await revokeAccess(id, user.email);
    if (!done) {
      return NextResponse.json(
        { error: "No such grant, or it was already withdrawn" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
