export type SeedArticle = {
  slug: string;
  title: string;
  dek: string;
  category: "Regulation" | "Practice" | "Tools" | "Analysis" | "News";
  tags: string[];
  author: string;
  authorRole: string;
  publishedAt: string; // ISO date
  readingMin: number;
  featured: number; // 0 none, 1 lead, 2-4 front page slots
  urgency: 1 | 2 | 3; // radar: 3 = act now
  premium: boolean;
  body: string; // markdown
};

export type SeedPrompt = {
  slug: string;
  title: string;
  category: string;
  description: string;
  body: string;
  variables: string[];
  modelNote: string;
  premium: boolean;
  uses: number;
};

export type SeedPodcast = {
  slug: string;
  episodeNo: number;
  title: string;
  guest: string;
  description: string;
  durationMin: number;
  publishedAt: string;
};

export type SeedResearch = {
  slug: string;
  title: string;
  source: string;
  authors: string;
  year: number;
  topic: string;
  summary: string;
  takeaway: string;
};

export type SeedSignal = {
  label: string;
  detail: string;
  kind: "reg" | "standard" | "market" | "stai";
  publishedAt: string;
};
