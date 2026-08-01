import { allArticles, type Article } from "./content";

/**
 * Local BM25 retrieval over article chunks — the grounding layer for Ask STAI.
 * Deliberately not an external vector DB: the corpus is small (hundreds of
 * chunks), lexical retrieval is transparent and reproducible (an auditor's
 * virtue), and nothing leaves the box. If the corpus grows 100×, swap this
 * module for pgvector + embeddings; the interface stays.
 */

export type Chunk = {
  articleId: number;
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  author: string;
  seq: number;
  text: string;
};

export type Hit = Chunk & { score: number };

const STOP = new Set(
  "a an and are as at be by for from has have in is it its of on or that the this to was were will with we you your not our their they i if do does can".split(
    " "
  )
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüéèáàß\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function chunkArticle(a: Article): Chunk[] {
  // Split on markdown headings and blank-line paragraph groups, ~120-260 words per chunk.
  const blocks = a.body_md.split(/\n(?=## )|\n\n(?=\S)/).map((b) => b.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buf = "";
  let seq = 0;
  const flush = () => {
    if (buf.trim().length > 0) {
      chunks.push({
        articleId: a.id,
        slug: a.slug,
        title: a.title,
        category: a.category,
        publishedAt: a.published_at,
        author: a.author,
        seq: seq++,
        text: buf.trim(),
      });
      buf = "";
    }
  };
  for (const b of blocks) {
    if ((buf + " " + b).split(/\s+/).length > 220) flush();
    buf = buf ? buf + "\n\n" + b : b;
    if (buf.split(/\s+/).length > 120 && /^##\s/m.test(b)) flush();
  }
  flush();
  // Prepend the dek as chunk context for the first chunk.
  if (chunks.length > 0) chunks[0].text = `${a.dek}\n\n${chunks[0].text}`;
  return chunks;
}

type Index = {
  chunks: Chunk[];
  df: Map<string, number>;
  tf: Map<string, number>[]; // per chunk
  len: number[];
  avgLen: number;
  builtFor: number; // article count fingerprint
};

let _index: Index | null = null;

function buildIndex(): Index {
  const articles = allArticles();
  const chunks = articles.flatMap(chunkArticle);
  const df = new Map<string, number>();
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  for (const c of chunks) {
    const tokens = tokenize(c.text + " " + c.title + " " + c.category);
    const m = new Map<string, number>();
    for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(m);
    len.push(tokens.length);
  }
  const avgLen = len.reduce((a, b) => a + b, 0) / Math.max(1, len.length);
  return { chunks, df, tf, len, avgLen, builtFor: articles.length };
}

export function searchChunks(query: string, k = 6): Hit[] {
  if (!_index) _index = buildIndex();
  const idx = _index;
  const qTokens = [...new Set(tokenize(query))];
  if (qTokens.length === 0) return [];
  const N = idx.chunks.length;
  const k1 = 1.4;
  const b = 0.75;
  const scores = new Array<number>(N).fill(0);
  for (const t of qTokens) {
    const n = idx.df.get(t);
    if (!n) continue;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    for (let i = 0; i < N; i++) {
      const f = idx.tf[i].get(t);
      if (!f) continue;
      scores[i] += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * idx.len[i]) / idx.avgLen));
    }
  }
  const ranked = scores
    .map((score, i) => ({ score, i }))
    .filter((x) => x.score > 0)
    .sort((a, b2) => b2.score - a.score);

  // Diversify: cap at 2 chunks per article so citations span sources.
  const perArticle = new Map<number, number>();
  const hits: Hit[] = [];
  for (const { score, i } of ranked) {
    const c = idx.chunks[i];
    const seen = perArticle.get(c.articleId) ?? 0;
    if (seen >= 2) continue;
    perArticle.set(c.articleId, seen + 1);
    hits.push({ ...c, score });
    if (hits.length >= k) break;
  }
  return hits;
}

export function invalidateSearchIndex() {
  _index = null;
}
