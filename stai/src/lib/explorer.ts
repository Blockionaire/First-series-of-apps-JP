import type { ArticleSummary } from "./content";

/**
 * The subset of an article the Radar explorer renders.
 *
 * Extracted because /news and /insights are the same view over two sections,
 * and because `body_md` must not travel: the explorer is a client component,
 * so everything handed to it is serialised into the page. Passing whole
 * articles would ship every word of every published piece to the browser
 * twice — once in the RSC payload, once in the HTML — for a list that shows
 * only titles and deks.
 */
export type ExplorerItem = {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  urgency: number;
  premium: boolean;
  author: string;
  readingMin: number;
  dek: string;
};

export function toExplorerItems(articles: ArticleSummary[]): ExplorerItem[] {
  return articles.map((a) => ({
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
}
