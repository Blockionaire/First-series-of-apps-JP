import { getSetting } from "./db";
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
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToArticle(r: any): Article {
  return { ...r, tags: JSON.parse(r.tags), premium: !!r.premium };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPrompt(r: any): Prompt {
  return { ...r, variables: JSON.parse(r.variables), premium: !!r.premium };
}

export async function allArticles(): Promise<Article[]> {
  const rows = await sql().all(
    "SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC, id DESC"
  );
  return rows.map(rowToArticle);
}

export async function articleBySlug(slug: string): Promise<Article | null> {
  const r = await sql().first("SELECT * FROM articles WHERE slug=? AND status='published'", [slug]);
  return r ? rowToArticle(r) : null;
}

export async function featuredArticles(): Promise<Article[]> {
  const rows = await sql().all(
    "SELECT * FROM articles WHERE featured > 0 AND status='published' ORDER BY featured ASC"
  );
  return rows.map(rowToArticle);
}

export async function relatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const rows = await sql().all(
    "SELECT * FROM articles WHERE id != ? AND status='published' ORDER BY (category = ?) DESC, published_at DESC LIMIT ?",
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
  const rows = await sql().all(
    "SELECT * FROM prompts WHERE status='published' ORDER BY premium ASC, uses DESC"
  );
  return rows.map(rowToPrompt);
}

export async function promptBySlug(slug: string): Promise<Prompt | null> {
  const r = await sql().first("SELECT * FROM prompts WHERE slug=? AND status='published'", [slug]);
  return r ? rowToPrompt(r) : null;
}

export async function bumpPromptUses(id: number): Promise<void> {
  await sql().run("UPDATE prompts SET uses = uses + 1 WHERE id=?", [id]);
}

export async function allPodcasts(): Promise<Podcast[]> {
  return sql().all<Podcast>("SELECT * FROM podcasts ORDER BY episode_no DESC");
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

/** EU AI Act enforcement moment — the deadline the whole platform orients around. */
export const ENFORCEMENT_ISO = "2026-08-02T00:00:00+02:00";
export const EARLY_BIRD_END_ISO = "2026-08-31T23:59:59+02:00";
