import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { currentUser, peekAnonId, getUsage } from "@/lib/auth";
import AskConsole from "@/components/ask/AskConsole";
import { requirePage } from "@/lib/page-guard";
import { limit as readLimit } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Ask STAI — the grounded audit AI assistant",
  description: "An AI assistant that answers audit and AI-governance questions from STAI’s own published research — every claim cited, every citation one click from its source.",
  path: "/ask",
});


export default async function AskPage() {
  // Switched off in site settings → this page does not exist.
  await requirePage("ask");

  const user = await currentUser();
  // The same two settings the API enforces. Read here rather than restated,
  // so the number the console shows can never promise more than the route
  // will actually serve.
  const [anonQuota, freeQuota] = await Promise.all([
    readLimit("limit.ask.anon"),
    readLimit("limit.ask.free"),
  ]);
  let plan: "anon" | "free" | "plus" = "anon";
  let used = 0;
  let limit = anonQuota;

  if (user) {
    plan = user.plan === "plus" ? "plus" : "free";
    if (plan === "plus") {
      limit = -1;
    } else {
      limit = freeQuota;
      used = await getUsage(`user:${user.id}`, "ask");
    }
  } else {
    const anon = await peekAnonId();
    used = anon ? await getUsage(`anon:${anon}`, "ask") : 0;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Intelligence desk / 03
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">Ask STAI</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
          Grounded in the desk&apos;s own reporting and research — nothing else. Every claim carries its citation;
          when the shelf is empty, it says so instead of improvising. Export any answer as a working-paper memo.
        </p>
      </header>
      <AskConsole authed={!!user} plan={plan} quotaUsed={used} quotaLimit={limit} />
    </div>
  );
}
