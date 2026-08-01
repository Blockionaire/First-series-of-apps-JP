import { NextRequest, NextResponse } from "next/server";
import { stripeClient, activateSubscription, cancelSubscription, type PlanId } from "@/lib/billing";
import { db } from "@/lib/db";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const userId = Number(s.metadata?.userId);
    const plan = (s.metadata?.plan ?? "monthly") as PlanId;
    if (userId) {
      activateSubscription(userId, plan, "stripe", {
        customer: typeof s.customer === "string" ? s.customer : undefined,
        subscription: typeof s.subscription === "string" ? s.subscription : undefined,
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const row = db()
      .prepare("SELECT user_id FROM subscriptions WHERE stripe_subscription=? AND status='active'")
      .get(sub.id) as { user_id: number } | undefined;
    if (row) cancelSubscription(row.user_id);
  }

  return NextResponse.json({ received: true });
}
