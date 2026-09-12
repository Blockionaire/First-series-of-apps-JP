import { allArticles } from "@/lib/content";
import { abs, SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * RSS for The Briefing. This audience reads in feed readers and pipes
 * headlines into Teams/Slack channels — a real distribution surface, not
 * a legacy checkbox.
 */
export async function GET() {
  const articles = allArticles().slice(0, 30);
  const updated = articles[0]?.published_at ?? new Date().toISOString().slice(0, 10);

  const items = articles
    .map((a) => {
      const url = abs(`/briefing/${a.slug}`);
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(`${a.published_at}T09:00:00Z`).toUTCString()}</pubDate>
      <dc:creator>${esc(a.author)}</dc:creator>
      <category>${esc(a.category)}</category>
      <description>${esc(a.dek)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>STAI — The Briefing</title>
    <link>${abs("/briefing")}</link>
    <atom:link href="${abs("/feed.xml")}" rel="self" type="application/rss+xml" />
    <description>${esc(SITE.description)}</description>
    <language>en-gb</language>
    <lastBuildDate>${new Date(`${updated}T09:00:00Z`).toUTCString()}</lastBuildDate>
    <copyright>© ${new Date().getFullYear()} STAI</copyright>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
