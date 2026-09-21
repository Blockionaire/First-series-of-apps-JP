import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import {
  decisionCount,
  monthSpendCents,
  recentStories,
  sourceSummary,
  spendByStage,
  spendPeriod,
  stateCounts,
  stuckStories,
} from "@/lib/newsroom/store";
import {
  MONTHLY_CAP_CENTS,
  dailyCapCents,
  euros,
  researchCapToday,
  workingDaysLeftInMonth,
} from "@/lib/newsroom/budget";
import { FAILURE_STATES, type StoryState } from "@/lib/newsroom/state";
import { jurisdictionLabel } from "@/lib/newsroom/jurisdictions";
import { limit } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Editorial — admin",
  description: "STAI newsroom.",
  path: "/admin/editorial",
  noIndex: true,
});

/**
 * The Editorial Inbox.
 *
 * Phase 1 is a shell: the schema exists, the state machine exists, the source
 * registry exists, and this is the window onto all three. Nothing discovers,
 * researches or writes yet, so on a fresh database every counter reads zero —
 * which is the correct and informative result, not an empty state to
 * apologise for.
 *
 * The three things this page has to make impossible to miss, in order:
 *   1. stories stuck mid-flight — the silent failure (see stuckStories);
 *   2. active sources that have stopped producing — the other silent failure;
 *   3. where the month's budget stands, because the ceiling is €75 and the
 *      estimate is €65.
 */
export default async function EditorialPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/editorial");

  const counts = await stateCounts();
  const stories = await recentStories(40);
  const stuck = await stuckStories();
  const sources = await sourceSummary();
  const period = spendPeriod();
  const spent = await monthSpendCents(period);
  const byStage = await spendByStage(period);
  const decisions = await decisionCount();

  const configuredCap = await limit("newsroom.research_cap_per_day");
  const targetMin = await limit("newsroom.publish_target_min");
  const targetMax = await limit("newsroom.publish_target_max");

  const workingDaysLeft = workingDaysLeftInMonth();
  const cap = researchCapToday({
    configuredCap,
    monthSpentCents: spent,
    workingDaysLeft,
  });

  // The columns worth a headline number. Deliberately not all nineteen states:
  // a row of nineteen zeroes communicates less than six that mean something.
  const HEADLINE: { state: StoryState; label: string }[] = [
    { state: "DISCOVERED", label: "Discovered" },
    { state: "REJECTED", label: "Rejected" },
    { state: "RESEARCHING", label: "Researching" },
    { state: "DRAFTING", label: "Drafted" },
    { state: "NEEDS_REVIEW", label: "Needs review" },
    { state: "PUBLISHED", label: "Published" },
  ];
  const failed = FAILURE_STATES.reduce((n, s) => n + counts[s], 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Back office
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Editorial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            The Intelligence Engine newsroom. Discovery, clustering and the relevance gates are
            live; research, drafting and publication are not. What the engine would have researched
            is on the <Link href="/admin/editorial/dry-run" className="underline underline-offset-4">dry run</Link>.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            Desk
          </Link>
          <Link href="/admin/editorial/sources" className="btn btn-ghost btn-sm">
            Source registry
          </Link>
          <Link href="/admin/editorial/dry-run" className="btn btn-primary btn-sm">
            Dry run
          </Link>
        </div>
      </header>

      {/* ── The two silent failures, first, and only when they exist ── */}
      {stuck.length > 0 && (
        <section
          className="mt-8 border p-5"
          style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.05)" }}
        >
          <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
            {stuck.length} {stuck.length === 1 ? "story is" : "stories are"} stuck
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            These have been mid-flight longer than a workflow should take, which usually means a run
            died between steps. Nothing errors when that happens — the story simply stops.
          </p>
          <ul className="mt-3 space-y-1">
            {stuck.slice(0, 8).map((s) => (
              <li key={s.id} className="f-mono text-[0.75rem] text-cream-200">
                #{s.id} · {s.state} since {s.state_entered_at.slice(0, 16).replace("T", " ")} ·{" "}
                {s.canonical_title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sources.needingAttention.length > 0 && (
        <section
          className="mt-6 border p-5"
          style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.05)" }}
        >
          <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
            {sources.needingAttention.length} active{" "}
            {sources.needingAttention.length === 1 ? "source needs" : "sources need"} attention
          </p>
          <ul className="mt-3 space-y-1">
            {sources.needingAttention.map((s) => (
              <li key={s.id} className="f-mono text-[0.75rem] text-cream-200">
                {s.name} — {s.health.state}: {s.health.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Pipeline counters ── */}
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        {HEADLINE.map((h) => (
          <div key={h.state} className="border p-4 rule">
            <p className="f-mono text-3xl font-bold tabular-nums text-cream-100">{counts[h.state]}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              {h.label}
            </p>
          </div>
        ))}
        <div className="border p-4 rule">
          <p className="f-mono text-3xl font-bold tabular-nums text-cream-100">{failed}</p>
          <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
            Failed
          </p>
        </div>
      </section>

      {/* ── Budget ── */}
      <section className="mt-10">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Budget · {period}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border p-4 rule">
            <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">{euros(spent)}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              Spent this month
            </p>
          </div>
          <div className="border p-4 rule">
            <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">
              {euros(MONTHLY_CAP_CENTS)}
            </p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              Hard monthly cap
            </p>
          </div>
          <div className="border p-4 rule">
            <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">
              {euros(dailyCapCents())}
            </p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              Derived daily share
            </p>
          </div>
          <div className="border p-4 rule">
            <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">{cap.cap}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              Stories researchable today
            </p>
          </div>
        </div>
        <p className="mt-3 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          {cap.reason}. Configured cap {configuredCap}/day, {workingDaysLeft} working{" "}
          {workingDaysLeft === 1 ? "day" : "days"} left this month. Publish target {targetMin}–
          {targetMax} per weekday during validation.
        </p>
        {byStage.length > 0 && (
          <p className="f-mono mt-2 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
            {byStage.map((s) => `${s.stage} ${euros(s.cents)}`).join(" · ")}
          </p>
        )}
      </section>

      {/* ── Source registry at a glance ── */}
      <section className="mt-10">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Sources
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border p-4 rule">
            <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">
              {sources.active}/{sources.total}
            </p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              Active / registered
            </p>
          </div>
          {([1, 2, 3] as const).map((t) => (
            <div key={t} className="border p-4 rule">
              <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">
                {sources.byTier[t].active}/{sources.byTier[t].total}
              </p>
              <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
                Tier {t} active
              </p>
            </div>
          ))}
        </div>
        {sources.total === 0 && (
          <p className="mt-3 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
            The registry is empty. Load the proposed list from the{" "}
            <Link href="/admin/editorial/sources" className="underline underline-offset-4">
              source registry
            </Link>{" "}
            — it lands dormant, and you activate each source yourself.
          </p>
        )}
      </section>

      {/* ── Stories ── */}
      <section className="mt-10">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Recent stories
        </h2>
        {stories.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--ink-muted)" }}>
            No stories yet. Discovery ships in phase 2.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[0.82rem]">
              <thead>
                <tr className="f-label border-b rule" style={{ color: "var(--ink-faint)" }}>
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Story</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Risk</th>
                  <th className="py-2 pr-4">Jurisdiction</th>
                  <th className="py-2 pr-4">Sources</th>
                  <th className="py-2">Relevance</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id} className="border-b rule">
                    <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">{s.id}</td>
                    <td className="py-2 pr-4 text-cream-200">
                      <Link href={`/admin/editorial/${s.id}`} className="underline-offset-4 hover:underline">
                        {s.canonical_title}
                      </Link>
                    </td>
                    <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">{s.state}</td>
                    <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">{s.risk_class}</td>
                    <td className="py-2 pr-4 text-cream-400">
                      {s.jurisdictions.map(jurisdictionLabel).join(", ") || "—"}
                    </td>
                    <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">
                      {s.primary_source_count}P / {s.source_count}
                    </td>
                    <td className="f-mono py-2 tabular-nums text-cream-400">
                      {s.relevance_score ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="f-mono mt-10 text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
        {decisions} editorial {decisions === 1 ? "decision" : "decisions"} recorded — the eval set
        for prompt changes starts at about 50.
      </p>
    </div>
  );
}
