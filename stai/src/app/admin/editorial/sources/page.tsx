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
          {/* The distinction that matters most on this page, said once and
              plainly: the Review column is a record of what a person decided,
              the switches are what the engine may do. They are next to each
              other precisely so they can be read as separate. */}
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            <span className="text-cream-200">Review</span> records how far you have got with a
            source and changes nothing the engine does — even{" "}
            <span className="f-mono text-[0.85em]">Retrieval approved</span> does not grant
            retrieval, because the switch that starts outbound requests should be the one labelled
            as doing that. The exception is{" "}
            <span className="f-mono text-[0.85em]">Do not use</span>, which switches the source off
            and withdraws retrieval. <span className="text-cream-200">Test source</span> makes one
            request without ingesting anything, so you can see what a URL serves before approving
            it.
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
          lastAttemptAt: s.last_attempt_at,
          lastOutcome: s.last_outcome,
          lastHttpStatus: s.last_http_status,
          lastError: s.last_error,
          lastItemsFound: s.last_items_found,
          lastItemsNew: s.last_items_new,
          consecutiveFailures: s.consecutive_failures,
          reviewStatus: s.review_status,
          reviewedBy: s.reviewed_by,
          reviewedAt: s.reviewed_at,
          reviewNote: s.review_note,
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
                    <td className="py-2 pr-4">
                      <span className="text-cream-200">{p.name}</span>
                      {/* The feed, openable before anything is registered.
                          These URLs are documented locations that have never
                          been fetched from this codebase, so checking one is
                          the difference between registering a working source
                          and registering a 404. */}
                      {p.feed_url ? (
                        <a
                          href={p.feed_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="f-mono mt-1 block text-[0.7rem] break-all text-cream-400 underline underline-offset-4 hover:text-cream-100"
                        >
                          {p.feed_url} ↗
                        </a>
                      ) : (
                        <span
                          className="f-mono mt-1 block text-[0.7rem]"
                          style={{ color: "var(--ink-faint)" }}
                        >
                          no feed — entered by hand
                        </span>
                      )}
                    </td>
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
