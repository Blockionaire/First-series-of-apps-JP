import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { stripeClient, foundingAvailable, PLANS, type PlanId } from "@/lib/billing";
import { guard, WINDOW } from "@/lib/ratelimit";

const PRICE_CENTS: Record<PlanId, { amount: number; interval: "month" | "year" }> = {
  monthly: { amount: 1900, interval: "month" },
  annual: { amount: 14900, interval: "year" },
  founding: { amount: 1200, interval: "month" },
};

export async function POST(req: NextRequest) {
  const blocked = guard(req, "checkout", 20, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "auth", next: "/signup?next=/plus" }, { status: 401 });
  if (user.plan === "plus") return NextResponse.json({ error: "Already a member" }, { status: 400 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanId };
  if (!plan || !PLANS[plan]) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  if (plan === "founding" && !foundingAvailable()) {
    return NextResponse.json({ error: "Founding seats are gone — the standard plans remain" }, { status: 409 });
  }

  const stripe = stripeClient();
  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  if (!stripe) {
    // Sandbox checkout: same activation path, demoable end to end without keys.
    return NextResponse.json({ url: `/checkout/sandbox?plan=${plan}` });
  }

  const price = PRICE_CENTS[plan];
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: price.amount,
          recurring: { interval: price.interval },
          product_data: {
            name: PLANS[plan].label,
            description: plan === "founding" ? "Founding member — price locked for the life of the subscription" : PLANS[plan].note,
          },
        },
      },
    ],
    metadata: { userId: String(user.id), plan },
    subscription_data: { metadata: { userId: String(user.id), plan } },
    success_url: `${origin}/account?welcome=1`,
    cancel_url: `${origin}/plus?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
