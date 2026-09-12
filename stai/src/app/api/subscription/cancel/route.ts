import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { requestCancellation } from "@/lib/billing";
import { guard, WINDOW } from "@/lib/ratelimit";

/**
 * Cancel = stop renewing, not "revoke now".
 *
 * The member has paid for the current period and keeps it. Access is removed
 * only when Stripe reports an access-revoking status (or, for the development
 * sandbox, when the paid period has actually elapsed) — never as a local side
 * effect of pressing the button.
 */
export async function POST(req: NextRequest) {
  const blocked = guard(req, "subscription-cancel", 10, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const { ok, endsAt } = await requestCancellation(user.id);
    if (!ok) return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    return NextResponse.json({
      ok: true,
      accessUntil: endsAt ? new Date(endsAt * 1000).toISOString() : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the billing provider — nothing was changed. Try again shortly." },
      { status: 502 }
    );
  }
}
