import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import {
  candidates,
  discoverySummary,
  feedbackTally,
  parseGates,
  recentRuns,
  storyMembers,
} from "@/lib/newsroom/store";
import { limit } from "@/lib/site-config";
import DryRunCandidates, { type CandidateCard } from "@/components/admin/DryRunCandidates";
import RunDiscovery from "@/components/admin/RunDiscovery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Dry run — admin",
  description: "What the newsroom would have researched.",
  path: "/admin/editorial/dry-run",
  noIndex: true,
});

const VIEWS = [
  { id: "all", label: "Everything" },
  { id: "selected", label: "Would research" },
  { id: "qualified", label: "Passed the gates" },
  { id: "rejected", label: "Filtered out" },
];

type Props = { searchParams: Promise<{ view?: string }> };

/**
 * The dry run.
 *
 * Phase 2's entire deliverable. The engine finds things, clusters them and
 * ranks them; this page shows what it WOULD have researched and why, and
 * collects a human's verdict on each decision.
 *
 * Nothing on this page can cause research, a draft or a publication. The
 * only write it offers is a feedback row.
 */
export default async function DryRunPage({ searchParams }: Props) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/editorial/dry-run");

  const { view = "all" } = await searchParams;
  const summary = await discoverySummary();
  const rows = await candidates({ view, limit: 60 });
  const tally = await feedbackTally();
  const runs = await recentRuns(5);
  const cap = await limit("newsroom.research_cap_per_day");

  const cards: CandidateCard[] = await Promise.all(
    rows.map(async (c) => {
      const members = await storyMembers(c.id);
      return {
        id: c.id,
        title: c.canonical_title,
        jurisdictions: c.jurisdictions,
        score: c.relevance_score,
        reasons: c.relevance_reason,
        gates: parseGates(c.gate_results),
        rejectedReason: c.rejected_reason,
        wouldResearch: c.would_research === 1,
        rank: c.selection_rank,
        selectedOn: c.selected_on,
        firstSeen: c.first_seen_at,
        lastSeen: c.last_seen_at,
        updateCount: c.update_count,
        sourceCount: c.source_count,
        tier1: c.tier1_source_count,
        tier2: c.tier2_source_count,
        tier3: c.tier3_source_count,
        primary: c.primary_source_count,
        feedbackCount: c.feedback_count,
        sources: members.map((m) => ({
          name: m.source_name,
          tier: m.tier,
          url: m.canonical_url,
          relationship: m.relationship,
        })),
      };
    })
  );

  const labelled = tally.reduce((n, t) => n + t.n, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            <Link href="/admin/editorial" className="hover:text-cream-100">
              Editorial
            </Link>{" "}
            / Dry run
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">What it would have researched</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Discovery, clustering and the relevance gates, running for real. Nothing here is
            researched, drafted or published — the output is this list, and your verdict on it.
          </p>
        </div>
        <Link href="/admin/editorial/sources" className="btn btn-ghost btn-sm">
          Sources
        </Link>
      </header>

      <section className="mt-6">
        <RunDiscovery />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Items ingested", value: summary.items },
          { label: "Stories", value: summary.stories },
          { label: "Passed gates", value: summary.qualified },
          { label: "Would research", value: summary.selected },
          { label: "Filtered out", value: summary.rejected },
          { label: "Labelled by you", value: labelled },
        ].map((t) => (
          <div key={t.label} className="border p-4 rule">
            <p className="f-mono text-2xl font-bold tabular-nums text-cream-100">{t.value}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              {t.label}
            </p>
          </div>
        ))}
      </section>

      <p className="f-mono mt-3 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
        Daily research cap {cap}
        {summary.lastRunAt && ` · last run ${summary.lastRunAt.slice(0, 16).replace("T", " ")}`}
        {runs.length > 0 && ` · ${runs.filter((r) => r.status === "failed").length} of the last ${runs.length} runs failed`}
        {tally.length > 0 && ` · ${tally.map((t) => `${t.verdict.replace(/_/g, " ")} ${t.n}`).join(", ")}`}
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={v.id === "all" ? "/admin/editorial/dry-run" : `/admin/editorial/dry-run?view=${v.id}`}
            className={view === v.id ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <DryRunCandidates cards={cards} />
    </div>
  );
}
