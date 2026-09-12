import { NextRequest, NextResponse } from "next/server";
import { stripeClient, syncFromStripe, confirmFirstPayment } from "@/lib/billing";
import type Stripe from "stripe";

/**
 * Stripe webhook.
 *
 * Every handled event resolves to the same action: re-read the subscription
 * from Stripe and store what it currently says. That single rule gives us
 * idempotency (a replay rewrites identical values), order-independence (a late
 * event cannot resurrect stale state), and correct handling of delayed payment
 * methods — a SEPA checkout completes with the subscription still `incomplete`,
 * which grants nothing until the money actually lands.
 */
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

  let subscriptionId: string | null = null;

  switch (event.type) {
    // Checkout finished. NOT proof of payment on its own: delayed methods
    // complete the session before funds settle, so we read the subscription's
    // real status rather than trusting the session.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const s = event.data.object as Stripe.Checkout.Session;
      subscriptionId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
      break;
    }

    // The lifecycle proper: trialing → active → past_due → unpaid/canceled,
    // plus cancel_at_period_end toggles and plan changes.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      subscriptionId = sub.id;
      break;
    }

    // THE payment-confirmation signal. Money has actually settled.
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } };
      subscriptionId =
        typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id ?? null;
      if (!subscriptionId) {
        return NextResponse.json({ received: true, note: "invoice has no subscription" });
      }

      // Verify the invoice really is paid for a positive amount. Every current
      // STAI plan costs money, so a zero-amount paid invoice (a 100% coupon,
      // or a trial we do not offer) is not evidence of a successful payment
      // and must not unlock premium.
      const genuinelyPaid = inv.status === "paid" && (inv.amount_paid ?? 0) > 0;
      if (!genuinelyPaid) {
        return NextResponse.json({
          received: true,
          confirmed: false,
          note: `invoice not a positive paid amount (status=${inv.status}, amount_paid=${inv.amount_paid ?? 0})`,
        });
      }

      try {
        // Sync FIRST so the subscription row is guaranteed to exist and to
        // carry Stripe's current status. This makes event order irrelevant:
        // whether invoice.paid arrives before or after the subscription
        // events, the row is present and current before we confirm against it.
        const synced = await syncFromStripe(subscriptionId);
        const confirmed = confirmFirstPayment(subscriptionId);
        return NextResponse.json({ received: true, synced, confirmed });
      } catch {
        return NextResponse.json({ error: "Sync failed" }, { status: 500 });
      }
    }

    // A failed payment moves Stripe to past_due, which deliberately KEEPS
    // access for an already-confirmed subscriber while Stripe retries. For a
    // never-confirmed subscription it changes nothing: the flag stays 0 and
    // entitlement is still withheld.
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } };
      subscriptionId =
        typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id ?? null;
      break;
    }

    default:
      return NextResponse.json({ received: true, ignored: event.type });
  }

  if (!subscriptionId) {
    // One-off payments and sessions without a subscription are not our concern.
    return NextResponse.json({ received: true, note: "no subscription on event" });
  }

  try {
    const synced = await syncFromStripe(subscriptionId);
    return NextResponse.json({ received: true, synced });
  } catch {
    // 500 makes Stripe retry, which is what we want for a transient failure.
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
