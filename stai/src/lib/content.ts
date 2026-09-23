import { cache } from "react";
import { getSetting } from "./settings";
import { sql } from "./sql";

export type Article = {
  id: number;
  slug: string;
  title: string;
  dek: string;
  category: string;
  tags: string[];
  author: string;
  author_role: string;
  published_at: string;
  reading_min: number;
  featured: number;
  urgency: number;
  premium: boolean;
  body_md: string;
  /**
   * Which section the piece is filed under: "news" or "insight".
   *
   * A second axis to `category`, not a replacement for it. A piece can be
   * Regulation and be either a timely item or a standing analysis, and the
   * categories already carry the category pages. The article's URL does not
   * contain the kind, so moving one between sections never breaks a link.
   */
  kind: string;
  /**
   * When the row was last written, at millisecond resolution.
   *
   * Already stamped by every article write path (see lib/now.ts) and already
   * load-bearing for the Ask STAI corpus fingerprint. It is declared here so
   * the SEO layer can read it too: `dateModified` and the sitemap's `lastmod`
   * both derive from it via lib/article-dates.ts. Nullable because rows
   * predating the column exist.
   */
  updated_at: string | null;
};

/**
 * An article without its body — what every list, card and feed needs.
 *
 * The body is the whole Markdown of the piece and the only large column in the
 * row. Lists used to `SELECT *` and then show a title, a dek and a date, so
 * every home page view read every published body to render six cards
 * (CODE_AUDIT.md, P1). Only the article page and the search index read bodies,
 * and they ask for them explicitly.
 */
export type ArticleSummary = Omit<Article, "body_md">;

export type Prompt = {
  id: number;
  slug: string;
  title: string;
  category: string;
  description: string;
  body: string;
  variables: string[];
  model_note: string;
  premium: boolean;
  uses: number;
  status: string;
  updated_at: string | null;
};

export type Podcast = {
  id: number;
  slug: string;
  episode_no: number;
  title: string;
  guest: string;
  description: string;
  duration_min: number;
  published_at: string;
  /**
   * Where the episode actually plays.
   *
   * Episodes are published on an external host — that host provides the RSS
   * feed Apple and Spotify consume — and this is the link back to it. Empty
   * means the show notes are up but the audio is not linked yet, which the
   * hub states rather than offering a player that goes nowhere.
   */
  audio_url: string;
  status: string;
  updated_at: string | null;
};

export type ResearchPaper = {
  id: number;
  slug: string;
  title: string;
  source: string;
  authors: string;
  year: number;
  topic: string;
  summary: string;
  takeaway: string;
};

export type Signal = {
  id: number;
  label: string;
  detail: string;
  kind: string;
  published_at: string;
};

/** A row as SQLite returns it: JSON columns are text, booleans are 0/1. */
type ArticleRow = Omit<Article, "tags" | "premium"> & { tags: string; premium: number };
type ArticleSummaryRow = Omit<ArticleRow, "body_md">;

/** Every column an ArticleSummary carries, and nothing else. */
const SUMMARY_COLUMNS =
  "id, slug, title, dek, category, tags, author, author_role, published_at, " +
  "reading_min, featured, urgency, premium, kind, updated_at";
type PromptRow = Omit<Prompt, "variables" | "premium"> & { variables: string; premium: number };

/**
 * Parse a JSON text column without letting one bad row take down a page.
 *
 * `tags` and `variables` are TEXT holding JSON. A malformed or non-array value
 * — a hand-edited row, a partial import, an older schema — used to throw
 * straight out of JSON.parse, and because these mappers run inside
 * allArticles(), a single corrupt row returned a 500 for the entire briefing
 * index rather than one degraded article.
 */
export function jsonArray(raw: string, where: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    console.warn(`[content] ${where} is valid JSON but not an array; treating as empty`);
  } catch {
    console.warn(`[content] ${where} is not valid JSON; treating as empty`);
  }
  return [];
}

function rowToArticle(r: ArticleRow): Article;
function rowToArticle(r: ArticleSummaryRow): ArticleSummary;
function rowToArticle(r: ArticleSummaryRow): ArticleSummary {
  return { ...r, tags: jsonArray(r.tags, `articles.tags for "${r.slug}"`), premium: !!r.premium };
}

function rowToPrompt(r: PromptRow): Prompt {
  return {
    ...r,
    variables: jsonArray(r.variables, `prompts.variables for "${r.slug}"`),
    premium: !!r.premium,
  };
}

/** Published articles, newest first, without bodies. `limit` for callers that show a few. */
export async function allArticles(limit?: number): Promise<ArticleSummary[]> {
  const rows = await sql().all<ArticleSummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM articles WHERE status='published'
     ORDER BY published_at DESC, id DESC${limit === undefined ? "" : " LIMIT ?"}`,
    limit === undefined ? [] : [limit]
  );
  return rows.map(rowToArticle);
}

/**
 * Published articles WITH their bodies, for the one reader that needs every
 * body at once: the Ask STAI search index, which rebuilds only when the corpus
 * fingerprint changes.
 */
export async function allArticlesWithBodies(): Promise<Article[]> {
  const rows = await sql().all<ArticleRow>(
    "SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC, id DESC"
  );
  return rows.map((r) => rowToArticle(r));
}

/** The two sections. `news` is the default every existing piece carries. */
export const ARTICLE_KINDS = ["news", "insight"] as const;
export type ArticleKind = (typeof ARTICLE_KINDS)[number];
export const isArticleKind = (v: string): v is ArticleKind =>
  (ARTICLE_KINDS as readonly string[]).includes(v);

/** One section's published pieces, newest first. */
export async function articlesByKind(kind: ArticleKind): Promise<ArticleSummary[]> {
  const rows = await sql().all<ArticleSummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM articles WHERE status='published' AND kind=? ORDER BY published_at DESC, id DESC`,
    [kind]
  );
  return rows.map(rowToArticle);
}

/**
 * One published article, with its body.
 *
 * Memoised per request: the page's `generateMetadata` and the page itself both
 * ask for the same slug, and without this each asked the database separately.
 */
export const articleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const r = await sql().first<ArticleRow>(
    "SELECT * FROM articles WHERE slug=? AND status='published'",
    [slug]
  );
  return r ? rowToArticle(r) : null;
});

export async function featuredArticles(): Promise<ArticleSummary[]> {
  const rows = await sql().all<ArticleSummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM articles WHERE featured > 0 AND status='published' ORDER BY featured ASC`
  );
  return rows.map(rowToArticle);
}

export async function relatedArticles(article: ArticleSummary, limit = 3): Promise<ArticleSummary[]> {
  const rows = await sql().all<ArticleSummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM articles WHERE id != ? AND status='published' ORDER BY (category = ?) DESC, published_at DESC LIMIT ?`,
    [article.id, article.category, limit]
  );
  return rows.map(rowToArticle);
}

/**
 * Every public prompt surface goes through these two functions — /prompts, a
 * single prompt page, the home-page teasers, /plus, the sitemap and the
 * adapt-with-AI endpoint. Filtering `status` here rather than at each call
 * site is what makes "a draft is never visible" a property of the data layer
 * instead of a convention six pages have to remember. Admin reads query the
 * table directly and deliberately see drafts.
 */
export async function allPrompts(): Promise<Prompt[]> {
  const rows = await sql().all<PromptRow>(
    "SELECT * FROM prompts WHERE status='published' ORDER BY premium ASC, uses DESC"
  );
  return rows.map(rowToPrompt);
}

/** One published prompt. Memoised per request for the same reason as articleBySlug. */
export const promptBySlug = cache(async (slug: string): Promise<Prompt | null> => {
  const r = await sql().first<PromptRow>(
    "SELECT * FROM prompts WHERE slug=? AND status='published'",
    [slug]
  );
  return r ? rowToPrompt(r) : null;
});

export async function bumpPromptUses(id: number): Promise<void> {
  await sql().run("UPDATE prompts SET uses = uses + 1 WHERE id=?", [id]);
}

/** Published episodes, newest first. Drafts are admin-only, like articles. */
export async function allPodcasts(): Promise<Podcast[]> {
  return sql().all<Podcast>(
    "SELECT * FROM podcasts WHERE status='published' ORDER BY episode_no DESC"
  );
}

export async function allResearch(): Promise<ResearchPaper[]> {
  return sql().all<ResearchPaper>("SELECT * FROM research ORDER BY year DESC, id DESC");
}

export async function allSignals(): Promise<Signal[]> {
  return sql().all<Signal>("SELECT * FROM signals ORDER BY published_at DESC");
}

/**
 * Founding-seat state.
 *
 * `showProgress` gates the claimed-count display, not the count itself. At
 * launch a truthful "0 claimed" with an empty bar reads as "nobody wants
 * this" — so below the threshold we show the seat number on offer ("claim
 * seat 1 of 200"), which is equally true and reads as early access. We never
 * inflate the number; we choose which true thing to lead with.
 */
export const FOUNDING_PROGRESS_THRESHOLD = 10;

export async function foundingStatus(): Promise<{
  total: number;
  claimed: number;
  remaining: number;
  showProgress: boolean;
}> {
  const total = parseInt((await getSetting("founding_total")) ?? "200", 10);
  const claimed = parseInt((await getSetting("founding_claimed")) ?? "0", 10);
  return {
    total,
    claimed,
    remaining: Math.max(0, total - claimed),
    showProgress: claimed >= FOUNDING_PROGRESS_THRESHOLD,
  };
}

export const EARLY_BIRD_END_ISO = "2026-08-31T23:59:59+02:00";
