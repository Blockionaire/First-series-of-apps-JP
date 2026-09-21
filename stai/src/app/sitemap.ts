import type { MetadataRoute } from "next";
import { allArticles, allPrompts } from "@/lib/content";
import { AUTHORS } from "@/lib/authors";
import { CATEGORIES, categorySlug } from "@/lib/categories";
import { abs } from "@/lib/seo";
import { enabledMap, toggleForPath } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * The sitemap follows the switches.
 *
 * A switched-off page answers 404, so advertising it here would hand crawlers
 * a list of URLs that do not resolve — which is worse than omitting them: it
 * spends crawl budget and, repeated, is a quality signal against the domain.
 * Both the page list and the entries generated from content are filtered, so
 * turning off Prompts drops /prompts and every prompt under it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await allArticles();
  const newest = articles[0]?.published_at ?? new Date().toISOString().slice(0, 10);
  const enabled = await enabledMap();

  /** True when nothing guards this path, or the thing that guards it is on. */
  const live = (path: string) => {
    const t = toggleForPath(path);
    return !t || enabled[t.id];
  };

  const staticRoutes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "daily" },
    { path: "/news", priority: 0.9, freq: "daily" },
    { path: "/insights", priority: 0.9, freq: "weekly" },
    // The AI Act tracker is the platform's most linkable free asset.
    { path: "/ai-act", priority: 1, freq: "weekly" },
    { path: "/firms", priority: 0.9, freq: "monthly" },
    { path: "/prompts", priority: 0.9, freq: "weekly" },
    { path: "/ask", priority: 0.8, freq: "monthly" },
    { path: "/training", priority: 0.9, freq: "monthly" },
    { path: "/assessment", priority: 0.8, freq: "monthly" },
    { path: "/plus", priority: 0.8, freq: "monthly" },
    { path: "/podcast", priority: 0.7, freq: "weekly" },
    { path: "/research", priority: 0.7, freq: "weekly" },
    { path: "/about", priority: 0.5, freq: "yearly" },
    { path: "/contact", priority: 0.5, freq: "yearly" },
    { path: "/legal/company", priority: 0.3, freq: "yearly" },
    { path: "/legal/privacy", priority: 0.2, freq: "yearly" },
    { path: "/legal/terms", priority: 0.2, freq: "yearly" },
  ];

  // Articles keep one address whatever section they are filed under, so they
  // stay listed as long as either section is open. Both closed and the corpus
  // has no door, so it leaves the sitemap with them.
  const articlesReachable = enabled.news || enabled.insights;

  return [
    ...staticRoutes
      .filter((r) => live(r.path))
      .map((r) => ({
        url: abs(r.path),
        lastModified: r.path === "/" || r.path === "/news" ? newest : undefined,
        changeFrequency: r.freq,
        priority: r.priority,
      })),
    ...(articlesReachable
      ? CATEGORIES.map((c) => ({
          url: abs(`/briefing/category/${categorySlug(c)}`),
          lastModified: articles.find((a) => a.category === c)?.published_at,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }))
      : []),
    ...(articlesReachable
      ? articles.map((a) => ({
          url: abs(`/briefing/${a.slug}`),
          lastModified: a.published_at,
          changeFrequency: "monthly" as const,
          // Act-critical pieces are the ones worth crawling first.
          priority: a.featured === 1 ? 0.9 : a.urgency >= 3 ? 0.8 : 0.7,
        }))
      : []),
    ...(enabled.prompts
      ? (await allPrompts()).map((p) => ({
          url: abs(`/prompts/${p.slug}`),
          changeFrequency: "monthly" as const,
          priority: p.premium ? 0.5 : 0.7,
        }))
      : []),
    ...(articlesReachable
      ? AUTHORS.map((a) => ({
          url: abs(`/authors/${a.slug}`),
          changeFrequency: "monthly" as const,
          priority: 0.5,
        }))
      : []),
  ];
}
