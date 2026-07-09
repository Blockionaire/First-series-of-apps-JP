import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PLANS, stripeClient, type PlanId } from "@/lib/billing";
import SandboxCheckout from "@/components/plus/SandboxCheckout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout" };

export default async function SandboxCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  // This page only exists in environments without Stripe keys.
  if (stripeClient()) redirect("/plus");
  const user = await currentUser();
  if (!user) redirect("/signup?next=/plus");
  if (user.plan === "plus") redirect("/account");

  const { plan: planParam } = await searchParams;
  const plan = (planParam ?? "monthly") as PlanId;
  const p = PLANS[plan] ?? PLANS.monthly;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Checkout — sandbox mode
      </p>
      <h1 className="f-display mt-2 text-3xl text-cream-100">Confirm your membership</h1>

      <div className="mt-8 border rule-strong">
        <div className="flex items-baseline justify-between border-b px-5 py-4 rule">
          <span className="text-cream-100">{p.label}</span>
          <span className="f-mono text-xl font-bold text-cream-100">
            {p.price}
            <span className="ml-1 text-xs font-normal" style={{ color: "var(--ink-faint)" }}>
              / {p.interval}
            </span>
          </span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {p.note}
          </p>
          <p className="f-mono mt-4 border px-3 py-2.5 text-[0.68rem] leading-relaxed tracking-[0.02em] rule" style={{ color: "var(--ink-faint)" }}>
            SANDBOX — no payment keys are configured in this environment, so this checkout simulates the Stripe
            flow end-to-end. With STRIPE_SECRET_KEY set, this page is replaced by real Stripe Checkout.
          </p>
          <div className="mt-5">
            <SandboxCheckout plan={plan} />
          </div>
        </div>
      </div>
    </div>
  );
}
