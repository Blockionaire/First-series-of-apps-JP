import { db, getSetting } from "./db";

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

export function allArticles(): Article[] {
  return (
    db()
      .prepare("SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC, id DESC")
      .all() as unknown[]
  ).map(rowToArticle);
}

export function articleBySlug(slug: string): Article | null {
  const r = db().prepare("SELECT * FROM articles WHERE slug=? AND status='published'").get(slug);
  return r ? rowToArticle(r) : null;
}

export function featuredArticles(): Article[] {
  return (
    db()
      .prepare("SELECT * FROM articles WHERE featured > 0 AND status='published' ORDER BY featured ASC")
      .all() as unknown[]
  ).map(rowToArticle);
}

export function relatedArticles(article: Article, limit = 3): Article[] {
  const rows = db()
    .prepare(
      "SELECT * FROM articles WHERE id != ? AND status='published' ORDER BY (category = ?) DESC, published_at DESC LIMIT ?"
    )
    .all(article.id, article.category, limit) as unknown[];
  return rows.map(rowToArticle);
}

export function allPrompts(): Prompt[] {
  return (
    db().prepare("SELECT * FROM prompts ORDER BY premium ASC, uses DESC").all() as unknown[]
  ).map(rowToPrompt);
}

export function promptBySlug(slug: string): Prompt | null {
  const r = db().prepare("SELECT * FROM prompts WHERE slug=?").get(slug);
  return r ? rowToPrompt(r) : null;
}

export function bumpPromptUses(id: number) {
  db().prepare("UPDATE prompts SET uses = uses + 1 WHERE id=?").run(id);
}

export function allPodcasts(): Podcast[] {
  return db().prepare("SELECT * FROM podcasts ORDER BY episode_no DESC").all() as Podcast[];
}

export function allResearch(): ResearchPaper[] {
  return db().prepare("SELECT * FROM research ORDER BY year DESC, id DESC").all() as ResearchPaper[];
}

export function allSignals(): Signal[] {
  return db().prepare("SELECT * FROM signals ORDER BY published_at DESC").all() as Signal[];
}

export function foundingStatus(): { total: number; claimed: number; remaining: number } {
  const total = parseInt(getSetting("founding_total") ?? "200", 10);
  const claimed = parseInt(getSetting("founding_claimed") ?? "0", 10);
  return { total, claimed, remaining: Math.max(0, total - claimed) };
}

/** EU AI Act enforcement moment — the deadline the whole platform orients around. */
export const ENFORCEMENT_ISO = "2026-08-02T00:00:00+02:00";
export const EARLY_BIRD_END_ISO = "2026-08-31T23:59:59+02:00";
