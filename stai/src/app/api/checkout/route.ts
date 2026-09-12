import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { stripeClient, foundingAvailable, PLANS, type PlanId } from "@/lib/billing";
import { requireAppUrl, isProduction, sandboxCheckoutAllowed } from "@/lib/config";
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

  if (!stripe) {
    // Production has NO fallback. Without a Stripe key, checkout is simply
    // unavailable — it must never degrade into an activation path that grants
    // membership without payment.
    if (isProduction() || !sandboxCheckoutAllowed()) {
      return NextResponse.json(
        { error: "unavailable", detail: "Checkout is temporarily unavailable. Nothing has been charged." },
        { status: 503 }
      );
    }
    return NextResponse.json({ url: `/checkout/sandbox?plan=${plan}` });
  }

  // Redirect targets come from configuration, never from the request Origin:
  // an attacker-supplied Origin would otherwise steer users off-site
  // immediately after payment.
  const origin = requireAppUrl();
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
            description:
              plan === "founding"
                ? "Founding member — price locked for the life of the subscription"
                : PLANS[plan].note,
          },
        },
      },
    ],
    // Metadata on the SUBSCRIPTION is what the webhook reads back, so it must
    // survive beyond the checkout session itself.
    metadata: { userId: String(user.id), plan },
    subscription_data: { metadata: { userId: String(user.id), plan } },
    success_url: `${origin}/account?welcome=1`,
    cancel_url: `${origin}/plus?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
