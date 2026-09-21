import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { articlesByKind } from "@/lib/content";
import { requirePage } from "@/lib/page-guard";
import BriefingExplorer from "@/components/briefing/BriefingExplorer";
import { toExplorerItems } from "@/lib/explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Insights — standing analysis for European audit",
  description:
    "Deeper analysis of the questions that outlast the news cycle: how AI changes audit evidence, methodology, quality management and the file itself.",
  path: "/insights",
});

export default async function InsightsPage() {
  await requirePage("insights");
  const items = toExplorerItems(await articlesByKind("insight"));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Intelligence desk / 02
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">Insights</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
          The analysis that outlasts the news cycle: what AI does to audit evidence, to methodology, to quality
          management and to the file itself. Written to be useful six months from now.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="max-w-2xl">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            No pieces are filed under Insights yet. An article becomes one in the content editor — the section
            is a field on the piece, so moving it here does not change its address or break a link to it.
          </p>
        </div>
      ) : (
        <BriefingExplorer items={items} />
      )}
    </div>
  );
}
