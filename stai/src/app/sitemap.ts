import type { MetadataRoute } from "next";
import { allArticles, allPrompts } from "@/lib/content";
import { AUTHORS } from "@/lib/authors";
import { CATEGORIES, categorySlug } from "@/lib/categories";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = allArticles();
  const newest = articles[0]?.published_at ?? new Date().toISOString().slice(0, 10);

  const staticRoutes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "daily" },
    { path: "/briefing", priority: 0.9, freq: "daily" },
    { path: "/prompts", priority: 0.9, freq: "weekly" },
    { path: "/ask", priority: 0.8, freq: "monthly" },
    { path: "/training", priority: 0.9, freq: "monthly" },
    { path: "/assessment", priority: 0.8, freq: "monthly" },
    { path: "/plus", priority: 0.8, freq: "monthly" },
    { path: "/podcast", priority: 0.7, freq: "weekly" },
    { path: "/research", priority: 0.7, freq: "weekly" },
    { path: "/about", priority: 0.5, freq: "yearly" },
    { path: "/contact", priority: 0.5, freq: "yearly" },
    { path: "/legal/privacy", priority: 0.2, freq: "yearly" },
    { path: "/legal/terms", priority: 0.2, freq: "yearly" },
  ];

  return [
    ...staticRoutes.map((r) => ({
      url: abs(r.path),
      lastModified: r.path === "/" || r.path === "/briefing" ? newest : undefined,
      changeFrequency: r.freq,
      priority: r.priority,
    })),
    ...CATEGORIES.map((c) => ({
      url: abs(`/briefing/category/${categorySlug(c)}`),
      lastModified: articles.find((a) => a.category === c)?.published_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...articles.map((a) => ({
      url: abs(`/briefing/${a.slug}`),
      lastModified: a.published_at,
      changeFrequency: "monthly" as const,
      // Act-critical pieces are the ones worth crawling first.
      priority: a.featured === 1 ? 0.9 : a.urgency >= 3 ? 0.8 : 0.7,
    })),
    ...allPrompts().map((p) => ({
      url: abs(`/prompts/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: p.premium ? 0.5 : 0.7,
    })),
    ...AUTHORS.map((a) => ({
      url: abs(`/authors/${a.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
