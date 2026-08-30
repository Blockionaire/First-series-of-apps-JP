import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { allArticles } from "@/lib/content";
import BriefingExplorer from "@/components/briefing/BriefingExplorer";
import Ticker from "@/components/chrome/Ticker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "The Briefing — AI intelligence for European audit",
  description: "Analysis, guides and news on how AI is reshaping audit, accountancy and finance across Europe. Browse the full desk on the Radar, categorised and searchable.",
  path: "/briefing",
});

export default function BriefingPage() {
  const items = allArticles().map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    publishedAt: a.published_at,
    urgency: a.urgency,
    premium: a.premium,
    author: a.author,
    readingMin: a.reading_min,
    dek: a.dek,
  }));

  return (
    <>
      <Ticker />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Intelligence desk / 01
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">The Briefing</h1>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
            Everything on scope: regulation, standards, practice and tooling — plotted by sector, range and
            urgency. Fresh intelligence sits close to the centre.
          </p>
        </header>
        <BriefingExplorer items={items} />
      </div>
    </>
  );
}
