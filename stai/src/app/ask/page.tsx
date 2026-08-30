import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { currentUser, peekAnonId, getUsage } from "@/lib/auth";
import AskConsole from "@/components/ask/AskConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Ask STAI — the grounded audit AI assistant",
  description: "An AI assistant that answers audit and AI-governance questions from STAI’s own published research — every claim cited, every citation one click from its source.",
  path: "/ask",
});

const FREE_QUOTA = 5;
const ANON_QUOTA = 2;

export default async function AskPage() {
  const user = await currentUser();
  let plan: "anon" | "free" | "plus" = "anon";
  let used = 0;
  let limit = ANON_QUOTA;

  if (user) {
    plan = user.plan === "plus" ? "plus" : "free";
    if (plan === "plus") {
      limit = -1;
    } else {
      limit = FREE_QUOTA;
      used = getUsage(`user:${user.id}`, "ask");
    }
  } else {
    const anon = await peekAnonId();
    used = anon ? getUsage(`anon:${anon}`, "ask") : 0;
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
