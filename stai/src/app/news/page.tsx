import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { articlesByKind } from "@/lib/content";
import { requirePage } from "@/lib/page-guard";
import BriefingExplorer from "@/components/briefing/BriefingExplorer";
import Ticker from "@/components/chrome/Ticker";
import { toExplorerItems } from "@/lib/explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "News — AI intelligence for European audit",
  description:
    "What changed this week in AI regulation, standards and tooling for audit, accountancy and finance across Europe — plotted by sector, range and urgency.",
  path: "/news",
});

export default async function NewsPage() {
  await requirePage("news");
  const items = toExplorerItems(await articlesByKind("news"));

  return (
    <>
      <Ticker />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Intelligence desk / 01
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">News</h1>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
            What moved: regulation, standards, practice and tooling, as it happens. Fresh intelligence sits
            close to the centre. For the standing analysis behind these items, see Insights.
          </p>
        </header>
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Nothing published in this section yet.
          </p>
        ) : (
          <BriefingExplorer items={items} />
        )}
      </div>
    </>
  );
}
