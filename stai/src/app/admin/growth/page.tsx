import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary, topPaths, topContent, type Window } from "@/lib/analytics";
import { EARLY_ACCESS_INTERESTS, interestLabel } from "@/lib/earlyaccess";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Growth — admin",
  description: "STAI usage and early-access demand.",
  path: "/admin/growth",
  noIndex: true,
});

const WINDOWS: { id: Window; label: string }[] = [
  { id: "1", label: "Today" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
];

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/growth");

  const { w } = await searchParams;
  const win: Window = w === "1" || w === "30" ? w : "7";
  const s = summary(win);
  const paths = topPaths(win);
  const articles = topContent(win, "article_view");
  const prompts = topContent(win, "prompt_view");

  const signups = db()
    .prepare(
      "SELECT id, email, name, firm, role, interests, note, created_at FROM early_access ORDER BY id DESC LIMIT 100"
    )
    .all() as {
    id: number;
    email: string;
    name: string;
    firm: string;
    role: string;
    interests: string;
    note: string;
    created_at: string;
  }[];
  const totalEarly = (db().prepare("SELECT COUNT(*) AS n FROM early_access").get() as { n: number }).n;
  const totalBrief = (db().prepare("SELECT COUNT(*) AS n FROM newsletter").get() as { n: number }).n;
  const totalAccounts = (db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;

  // Which promised capability people actually want — the reason the form exists.
  const allInterests = signups.flatMap((r) => {
    try {
      return JSON.parse(r.interests) as string[];
    } catch {
      return [];
    }
  });
  const demand = EARLY_ACCESS_INTERESTS.map((i) => ({
    label: i.label,
    n: allInterests.filter((x) => x === i.id).length,
  })).sort((a, b) => b.n - a.n);
  const peak = Math.max(...demand.map((d) => d.n), 1);

  const tiles = [
    { label: "Page views", n: s.pageViews },
    { label: "Visitors", n: s.visitors },
    { label: "Article views", n: s.articleViews },
    { label: "Prompt views", n: s.promptViews },
    { label: "Ask STAI questions", n: s.askQuestions },
    { label: "Account signups", n: s.signups },
    { label: "STAI+ early access", n: s.earlyAccess },
    { label: "Brief waitlist", n: s.briefWaitlist },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Back office
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Growth</h1>
        </div>
        <nav className="flex gap-2" aria-label="Time window">
          {WINDOWS.map((x) => (
            <Link
              key={x.id}
              href={`/admin/growth?w=${x.id}`}
              className={`f-mono border px-3 py-1.5 text-[0.68rem] tracking-[0.12em] uppercase transition-colors ${
                win === x.id ? "border-cream-400 text-cream-100" : "rule text-cream-400 hover:text-cream-100"
              }`}
            >
              {x.label}
            </Link>
          ))}
          <Link href="/admin" className="btn btn-ghost ml-2">
            The desk
          </Link>
        </nav>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="border p-4 rule">
            <p className="f-mono text-3xl font-bold tabular-nums text-cream-100">{t.n}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              {t.label}
            </p>
          </div>
        ))}
      </section>
      <p className="f-mono mt-3 text-[0.68rem]" style={{ color: "var(--ink-muted)" }}>
        All time — accounts <span className="text-cream-100">{totalAccounts}</span> · STAI+ early access{" "}
        <span className="text-cream-100">{totalEarly}</span> · Brief waitlist{" "}
        <span className="text-cream-100">{totalBrief}</span>
      </p>

      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Most-wanted STAI+ capability (all time)
          </h2>
          {totalEarly === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              No early-access registrations yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {demand.map((x) => (
                <li key={x.label} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 text-sm text-cream-200">{x.label}</span>
                  <span className="h-[10px] flex-1 border rule">
                    <span className="block h-full bg-gold-500" style={{ width: `${(x.n / peak) * 100}%` }} />
                  </span>
                  <span className="f-mono w-8 shrink-0 text-right text-[0.75rem] tabular-nums text-cream-100">
                    {x.n}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Top pages
          </h2>
          {paths.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              No page views recorded in this window.
            </p>
          ) : (
            <ul className="mt-3">
              {paths.map((p) => (
                <li key={p.path} className="flex items-baseline justify-between gap-4 border-b py-2 rule">
                  <span className="f-mono truncate text-[0.75rem] text-cream-200">{p.path}</span>
                  <span className="f-mono text-[0.75rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                    {p.n}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        {[
          { head: "Most-read briefings", rows: articles },
          { head: "Most-opened prompts", rows: prompts },
        ].map((block) => (
          <div key={block.head}>
            <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
              {block.head}
            </h2>
            {block.rows.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
                Nothing recorded in this window.
              </p>
            ) : (
              <ul className="mt-3">
                {block.rows.map((r) => (
                  <li key={r.label} className="flex items-baseline justify-between gap-4 border-b py-2 rule">
                    <span className="truncate text-sm text-cream-200">{r.label}</span>
                    <span className="f-mono text-[0.75rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                      {r.n}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2 rule-strong">
          <h2 className="f-label" style={{ color: "var(--ink-faint)" }}>
            STAI+ early access ({totalEarly})
          </h2>
          <a href="/api/admin/early-access.csv" className="f-label text-cream-400 hover:text-cream-100">
            Download CSV →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="f-label text-left" style={{ color: "var(--ink-faint)" }}>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Firm / role</th>
                <th className="py-2">Wants</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((r) => {
                let wants: string[] = [];
                try {
                  wants = JSON.parse(r.interests);
                } catch {}
                return (
                  <tr key={r.id} className="border-t rule align-top">
                    <td className="f-mono py-2.5 pr-4 text-[0.7rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                      {r.created_at.slice(0, 16)}
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200">
                      {r.email}
                      {r.name && (
                        <span className="f-mono block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                          {r.name}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--ink-muted)" }}>
                      {r.firm || "—"}
                      {r.role && (
                        <span className="f-mono block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                          {r.role}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
                      {wants.map(interestLabel).join(", ") || "—"}
                      {r.note && (
                        <span className="mt-1 block text-[0.78rem] text-cream-400">&ldquo;{r.note}&rdquo;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {signups.length === 0 && (
                <tr className="border-t rule">
                  <td colSpan={4} className="py-4" style={{ color: "var(--ink-muted)" }}>
                    None yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
