import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { activateSubscription, foundingAvailable, PLANS, type PlanId } from "@/lib/billing";
import { stripeClient } from "@/lib/billing";
import { sendMail } from "@/lib/mail";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "checkout-sandbox", 20, WINDOW.hour);
  if (blocked) return blocked;

  // Sandbox completion only exists when Stripe is NOT configured — it can
  // never bypass real billing in a keyed environment.
  if (stripeClient()) return NextResponse.json({ error: "Sandbox disabled" }, { status: 403 });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan === "plus") return NextResponse.json({ error: "Already a member" }, { status: 400 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanId };
  if (!plan || !PLANS[plan]) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  if (plan === "founding" && !foundingAvailable()) {
    return NextResponse.json({ error: "Founding seats are gone" }, { status: 409 });
  }

  activateSubscription(user.id, plan, "sandbox");
  await sendMail(
    user.email,
    plan === "founding" ? "Welcome, founding member" : "Welcome to STAI+",
    `Hi ${user.name.split(" ")[0]},\n\nSTAI+ is live on your account: the full prompt library, adapt-with-AI, unlimited Ask STAI, and every briefing.\n${
      plan === "founding" ? "\nYour founding rate of €12/month is locked for the life of your subscription.\n" : ""
    }\n— STAI`
  );
  return NextResponse.json({ ok: true });
}
