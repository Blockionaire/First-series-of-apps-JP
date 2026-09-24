import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { storyById, storyHistory, storyMembers } from "@/lib/newsroom/store";
import { externalHref, hostOf } from "@/lib/newsroom/links";
import { jurisdictionLabel } from "@/lib/newsroom/jurisdictions";
import { mayEnterResearch, mayReachReview, nextStates, isRiskClass } from "@/lib/newsroom/state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Story — admin",
  description: "Newsroom story.",
  path: "/admin/editorial",
  noIndex: true,
});

type Props = { params: Promise<{ id: string }> };

/**
 * One story's record.
 *
 * Phase 1 has no article to preview and no fact-check to show, so what this
 * page can honestly display is the audit trail: where the story is, how it got
 * there, who moved it and why, and which gates it currently passes.
 *
 * That last part is the useful bit before the pipeline exists. The two gates —
 * the Tier-1/2 rule and the primary-source rule for regulatory content — are
 * evaluated here from the same functions the workflows will call, so a story
 * that would be blocked says so, in the same words, months before anything
 * tries to move it.
 */
export default async function StoryPage({ params }: Props) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/editorial");

  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isInteger(storyId)) notFound();

  const story = await storyById(storyId);
  if (!story) notFound();

  const history = await storyHistory(storyId);
  const members = await storyMembers(storyId);

  const researchGate = mayEnterResearch({
    tier1: story.tier1_source_count,
    tier2: story.tier2_source_count,
  });
  const reviewGate = isRiskClass(story.risk_class)
    ? mayReachReview({
        riskClass: story.risk_class,
        primarySourceCount: story.primary_source_count,
      })
    : { ok: false as const, reason: `Unknown risk class: ${story.risk_class}` };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          <Link href="/admin/editorial" className="hover:text-cream-100">
            Editorial
          </Link>{" "}
          / Story {story.id}
        </p>
        <h1 className="f-display mt-2 text-3xl text-cream-100">{story.canonical_title}</h1>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "State", value: story.state },
          { label: "Risk", value: story.risk_class },
          { label: "Relevance", value: story.relevance_score === null ? "—" : String(story.relevance_score) },
          {
            label: "Jurisdiction",
            value: story.jurisdictions.map(jurisdictionLabel).join(", ") || "—",
          },
        ].map((t) => (
          <div key={t.label} className="border p-4 rule">
            <p className="f-mono text-lg text-cream-100">{t.value}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              {t.label}
            </p>
          </div>
        ))}
      </section>

      {story.relevance_reason && (
        <section className="mt-8">
          <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Why this was selected
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            {story.relevance_reason}
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Sources and gates
        </h2>
        <p className="f-mono mt-3 text-[0.8rem] text-cream-200">
          Tier 1: {story.tier1_source_count} · Tier 2: {story.tier2_source_count} · Tier 3:{" "}
          {story.tier3_source_count} · primary: {story.primary_source_count} · total:{" "}
          {story.source_count}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li style={{ color: researchGate.ok ? "var(--ink-muted)" : "var(--color-gold-300)" }}>
            <span className="f-mono text-[0.72rem] uppercase tracking-[0.1em]">Research gate</span>{" "}
            — {researchGate.ok ? "passes" : researchGate.reason}
          </li>
          <li style={{ color: reviewGate.ok ? "var(--ink-muted)" : "var(--color-gold-300)" }}>
            <span className="f-mono text-[0.72rem] uppercase tracking-[0.1em]">Review gate</span> —{" "}
            {reviewGate.ok ? "passes" : reviewGate.reason}
          </li>
        </ul>
        {story.escalated_by && (
          <p className="mt-4 text-[0.8rem] text-gold-300">
            Escalated by {story.escalated_by}: {story.escalated_reason}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Original articles ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            No retrieved items are attached to this story.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {members.map((m) => {
              const href = externalHref(m.canonical_url);
              const label = m.title.trim() || m.canonical_url;
              return (
                <li key={m.item_id} className="text-sm">
                  <span className="f-mono text-[0.7rem] text-gold-300">T{m.tier}</span>{" "}
                  <span className="text-cream-200">{m.source_name}</span>{" "}
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-4 text-cream-400 hover:text-cream-100"
                    >
                      {label}
                      <span aria-hidden="true"> ↗</span>
                      <span className="sr-only"> (opens the original in a new tab)</span>
                    </a>
                  ) : (
                    <span style={{ color: "var(--ink-muted)" }}>{label}</span>
                  )}
                  <span className="f-mono block text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                    {hostOf(m.canonical_url)} · {m.relationship} · published{" "}
                    {m.published_at ? m.published_at.slice(0, 16).replace("T", " ") : "— none in the feed"} ·
                    retrieved {m.retrieved_at.slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Where it can go next
        </h2>
        <p className="f-mono mt-3 text-[0.8rem] text-cream-400">
          {nextStates(story.state).join(" · ") || "nowhere — terminal state"}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          History
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            No transitions recorded.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {history.map((e) => (
              <li key={e.id} className="f-mono text-[0.75rem] text-cream-400">
                <span className="tabular-nums">{e.created_at.slice(0, 19).replace("T", " ")}</span>{" "}
                · {e.from_state ?? "—"} → <span className="text-cream-200">{e.to_state}</span> ·{" "}
                {e.actor}
                {e.actor_ref ? ` (${e.actor_ref})` : ""}
                {e.reason ? ` — ${e.reason}` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
