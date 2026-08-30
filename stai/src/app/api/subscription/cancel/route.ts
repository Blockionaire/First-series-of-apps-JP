import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cancelSubscription, activeSubscription, stripeClient } from "@/lib/billing";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const sub = activeSubscription(user.id) as
    | { plan: string; provider: string; stripe_subscription?: string }
    | undefined;
  const stripe = stripeClient();
  if (sub?.provider === "stripe" && sub.stripe_subscription && stripe) {
    try {
      await stripe.subscriptions.update(sub.stripe_subscription, { cancel_at_period_end: true });
    } catch {
      // fall through to local cancellation either way
    }
  }
  cancelSubscription(user.id);
  return NextResponse.json({ ok: true });
}
