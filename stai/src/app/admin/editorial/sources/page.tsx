import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { sourcesWithHealth } from "@/lib/newsroom/store";
import { PROPOSED_SOURCES, proposedCountByTier } from "@/lib/newsroom/proposed-sources";
import { TIER_MEANING, type Tier } from "@/lib/newsroom/sources";
import { jurisdictionLabel } from "@/lib/newsroom/jurisdictions";
import SourceRegistry from "@/components/admin/SourceRegistry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Source registry — admin",
  description: "The newsroom allowlist.",
  path: "/admin/editorial/sources",
  noIndex: true,
});

/**
 * The allowlist, and the approval gate in front of it.
 *
 * Everything the engine may ever read is a row here, and no row does anything
 * until a person activates it. That is decision D5, and it is the difference
 * between a considered list of publications and whatever a seed file happened
 * to contain.
 *
 * Two switches per source, deliberately separate:
 *   · Active      — we want this source.
 *   · Retrievable — this site's robots.txt and terms permit automated fetching.
 * Both must be on before anything is fetched. Collapsing them into one would
 * make "we want it" imply "we may take it", which is not a decision software
 * gets to make on a publisher's behalf.
 */
export default async function SourcesPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/editorial/sources");

  const sources = await sourcesWithHealth();
  const proposedByTier = proposedCountByTier();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Editorial
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Source registry</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            The allowlist. The engine never reads a page that is not represented here, and no source
            is fetched until it is both <span className="text-cream-200">active</span> and marked{" "}
            <span className="text-cream-200">retrievable</span>.
          </p>
        </div>
        <Link href="/admin/editorial" className="btn btn-ghost btn-sm">
          Editorial
        </Link>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {([1, 2, 3] as const).map((t: Tier) => (
          <div key={t} className="border p-4 rule">
            <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
              Tier {t}
            </p>
            <p className="mt-2 text-[0.8rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {TIER_MEANING[t]}
            </p>
            <p className="f-mono mt-3 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
              {sources.filter((s) => s.authority_tier === t && s.active).length} active ·{" "}
              {sources.filter((s) => s.authority_tier === t).length} registered · {proposedByTier[t]}{" "}
              proposed
            </p>
          </div>
        ))}
      </section>

      <SourceRegistry
        sources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain,
          tier: s.authority_tier,
          type: s.source_type,
          jurisdictions: s.jurisdictions.map(jurisdictionLabel),
          ingestion: s.ingestion_method,
          feedUrl: s.feed_url,
          frequency: s.fetch_frequency,
          fetchAllowed: s.fetch_allowed,
          active: s.active,
          activatedBy: s.activated_by,
          licenseNotes: s.license_notes,
          retention: s.snapshot_retention,
          health: s.health.state,
          healthDetail: s.health.detail,
        }))}
        proposedCount={PROPOSED_SOURCES.length}
        alreadyLoaded={sources.length > 0}
      />

      {sources.length === 0 && (
        <section className="mt-10">
          <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
            What the proposal contains
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            {PROPOSED_SOURCES.length} publications, weighted towards Tier 1 on purpose. The engine&apos;s
            binding constraint is not finding news — an hour of any technology feed produces more
            than a desk can use — it is reaching the primary text, because a regulatory piece cannot
            pass review without one.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Feed URLs are the documented location for each publication and have{" "}
            <span className="text-cream-200">not been fetched</span> — verify each one as you
            activate it. Anything that does not resolve shows up immediately as{" "}
            <span className="f-mono text-[0.85em]">never_fetched</span>.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-[0.82rem]">
              <thead>
                <tr className="f-label border-b rule" style={{ color: "var(--ink-faint)" }}>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Jurisdiction</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {PROPOSED_SOURCES.map((p) => (
                  <tr key={p.domain} className="border-b rule align-top">
                    <td className="py-2 pr-4 text-cream-200">{p.name}</td>
                    <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">{p.authority_tier}</td>
                    <td className="py-2 pr-4 text-cream-400">
                      {p.jurisdictions.map(jurisdictionLabel).join(", ")}
                    </td>
                    <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">
                      {p.ingestion_method}
                    </td>
                    <td className="py-2 text-cream-400">{p.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
