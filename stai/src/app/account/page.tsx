import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { activeSubscription, PLANS } from "@/lib/billing";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { PlusBadge } from "@/components/Logo";
import LogoutButton from "@/components/account/LogoutButton";
import CancelSubscription from "@/components/account/CancelSubscription";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Your desk",
  description: "Your saved briefings, prompts, answers and STAI+ membership.",
  path: "/account",
  noIndex: true,
});

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const { welcome } = await searchParams;

  const sub = activeSubscription(user.id);
  const savedArticles = db()
    .prepare(
      `SELECT a.slug, a.title, a.category, a.published_at FROM bookmarks b
       JOIN articles a ON a.id = b.ref_id WHERE b.user_id=? AND b.kind='article' ORDER BY b.created_at DESC`
    )
    .all(user.id) as { slug: string; title: string; category: string; published_at: string }[];
  const savedPrompts = db()
    .prepare(
      `SELECT p.slug, p.title, p.category, p.premium FROM bookmarks b
       JOIN prompts p ON p.id = b.ref_id WHERE b.user_id=? AND b.kind='prompt' ORDER BY b.created_at DESC`
    )
    .all(user.id) as { slug: string; title: string; category: string; premium: number }[];
  const savedAnswers = db()
    .prepare("SELECT id, question, answer, created_at FROM saved_answers WHERE user_id=? ORDER BY id DESC LIMIT 20")
    .all(user.id) as { id: number; question: string; answer: string; created_at: string }[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {welcome === "1" && (
        <div
          className="mb-8 border p-5"
          style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.06)" }}
          role="status"
        >
          <p className="f-mono text-[0.68rem] font-bold tracking-[0.16em] uppercase text-gold-300">
            {user.founding ? "Welcome, founding member" : "Welcome to STAI+"}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            The full desk is open: every briefing, the complete prompt library with adapt-with-AI, unlimited Ask
            STAI.{user.founding ? " Your €12 rate is locked for as long as you stay." : ""}
          </p>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Your desk
          </p>
          <h1 className="f-display mt-2 flex items-center gap-3 text-4xl text-cream-100">
            {user.name || user.email}
            {user.plan === "plus" && <PlusBadge label={user.founding ? "STAI+ FOUNDING" : "STAI+"} />}
          </h1>
          <p className="f-mono mt-2 text-[0.7rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
            {user.email}
            {user.firm ? ` · ${user.firm}` : ""}
          </p>
        </div>
        <LogoutButton />
      </header>

      {/* membership */}
      <section className="mt-10 border p-6 rule-strong">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="f-label" style={{ color: "var(--ink-faint)" }}>
              Membership
            </p>
            {user.plan === "plus" && sub ? (
              <>
                <p className="mt-1 text-lg text-cream-100">
                  {PLANS[sub.plan]?.label ?? "STAI+"} · {PLANS[sub.plan]?.price}/{PLANS[sub.plan]?.interval}
                </p>
                <p className="f-mono mt-1 text-[0.68rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                  Since {fmtDate(sub.started_at.slice(0, 10))}
                  {sub.renews_at ? ` · renews ${fmtDate(sub.renews_at.slice(0, 10))}` : ""} · via {sub.provider}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg text-cream-100">Free account</p>
                <p className="mt-1 max-w-md text-sm" style={{ color: "var(--ink-muted)" }}>
                  Five Ask STAI questions a month, the open prompt slice, most briefings.
                </p>
              </>
            )}
          </div>
          {user.plan === "plus" ? (
            <CancelSubscription founding={user.founding} />
          ) : (
            <Link href="/plus" className="btn btn-plus premium-focus">
              Upgrade to STAI+
            </Link>
          )}
        </div>
      </section>

      {/* saved desk */}
      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Saved briefings ({savedArticles.length})
          </h2>
          {savedArticles.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              Nothing saved yet — the □ Save-to-desk button on any briefing puts it here.
            </p>
          ) : (
            <ul className="mt-2">
              {savedArticles.map((a) => (
                <li key={a.slug} className="border-b py-3 rule">
                  <Link href={`/briefing/${a.slug}`} className="text-[0.95rem] font-medium text-cream-200 hover:text-cream-100">
                    {a.title}
                  </Link>
                  <p className="f-mono text-[0.62rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {a.category} · {fmtDate(a.published_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="f-label mt-8 border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Saved prompts ({savedPrompts.length})
          </h2>
          {savedPrompts.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              Prompts you save land here, ready for the next engagement.
            </p>
          ) : (
            <ul className="mt-2">
              {savedPrompts.map((p) => (
                <li key={p.slug} className="flex items-baseline justify-between gap-3 border-b py-3 rule">
                  <Link href={`/prompts/${p.slug}`} className="text-[0.95rem] font-medium text-cream-200 hover:text-cream-100">
                    {p.title}
                  </Link>
                  {p.premium ? <PlusBadge /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Saved answers ({savedAnswers.length})
          </h2>
          {savedAnswers.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              {user.plan === "plus"
                ? "Answers you save from Ask STAI are kept here with their citations."
                : "Saving Ask STAI answers is a STAI+ feature."}
            </p>
          ) : (
            <ul className="mt-2 space-y-4">
              {savedAnswers.map((s) => (
                <li key={s.id} className="border p-4 rule">
                  <p className="f-mono text-[0.72rem] text-cream-100">Q — {s.question}</p>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {s.answer.replace(/\*\*/g, "")}
                  </p>
                  <p className="f-mono mt-2 text-[0.6rem] tracking-[0.08em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {fmtDate(s.created_at.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
