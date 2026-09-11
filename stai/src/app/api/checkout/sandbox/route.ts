import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { upsertSubscription, foundingAvailable, PLANS, type PlanId } from "@/lib/billing";
import { sandboxCheckoutAllowed, isProduction } from "@/lib/config";
import { sendMail } from "@/lib/mail";
import { guard, WINDOW } from "@/lib/ratelimit";

/**
 * Development-only checkout simulation.
 *
 * This route grants membership WITHOUT payment. It must therefore be
 * unreachable in production under every configuration — including the case
 * that motivated this guard: a production deployment with no Stripe key, where
 * the previous version happily activated STAI+ for anyone who asked.
 *
 * Fails closed: production returns 404 before any other logic runs, so the
 * endpoint is indistinguishable from one that does not exist.
 */
export async function POST(req: NextRequest) {
  if (isProduction() || !sandboxCheckoutAllowed()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blocked = guard(req, "checkout-sandbox", 20, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan === "plus") return NextResponse.json({ error: "Already a member" }, { status: 400 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanId };
  if (!plan || !PLANS[plan]) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  if (plan === "founding" && !foundingAvailable()) {
    return NextResponse.json({ error: "Founding seats are gone" }, { status: 409 });
  }

  const periodDays = plan === "annual" ? 365 : 30;
  upsertSubscription({
    userId: user.id,
    plan,
    provider: "sandbox",
    status: "active",
    stripeSubscription: `sandbox_${user.id}_${Date.now()}`,
    currentPeriodEnd: Math.floor(Date.now() / 1000) + periodDays * 86400,
    cancelAtPeriodEnd: false,
    // The sandbox simulates a payment that succeeded. This is the ONLY place
    // outside confirmFirstPayment() allowed to vouch for one, and it is
    // unreachable in production.
    firstPaymentConfirmed: true,
  });

  await sendMail(
    user.email,
    plan === "founding" ? "Welcome, founding member" : "Welcome to STAI+",
    `Hi ${user.name.split(" ")[0]},\n\nSTAI+ is live on your account (development sandbox).\n\n— STAI`
  );
  return NextResponse.json({ ok: true });
}
