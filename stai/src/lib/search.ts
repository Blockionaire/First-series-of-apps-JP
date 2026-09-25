import { allArticlesWithBodies, type Article } from "./content";
import { sql } from "./sql";

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
  /** The corpus fingerprint this index was built from. */
  builtFor: string;
};

/**
 * Cached per isolate, validated per query.
 *
 * This cache used to be invalidated by the article editor calling
 * invalidateSearchIndex(). That works in one Node process and is a fiction on
 * Workers: an editor's save runs in one isolate, and every other isolate —
 * including every isolate in every other colo — keeps serving its own stale
 * index with nothing to tell it otherwise. A reader could see an unpublished
 * article cited for as long as that isolate lived.
 *
 * So the index now carries the fingerprint of the corpus it was built from and
 * re-checks it on every query. The check is one indexed aggregate; the rebuild
 * (which reads every article body) still only happens when the corpus actually
 * changed. Correctness no longer depends on reaching other isolates, which is
 * the property Workers cannot provide.
 */
let _index: Index | null = null;

/**
 * Cheap summary of the published corpus. Changes whenever an article is added,
 * removed, published, unpublished or edited.
 *
 * METADATA ONLY — and that is a hard requirement, not a preference.
 *
 * The first version of this summed LENGTH(body_md), which meant every single
 * Ask STAI question read every article body just to decide whether anything
 * had changed. On a local SQLite file that is invisible; on D1 it is a billed
 * row read per article per question, to answer a question the index already
 * knows.
 *
 * COUNT and MAX(updated_at) over published articles are both columns of
 * idx_articles_fingerprint, so the database answers from the index without
 * touching a row. tests/d1-migrations.test.mjs asserts the query plan still
 * says COVERING INDEX, so this cannot quietly regress.
 *
 * Why the pair is sufficient:
 *   published    → COUNT rises
 *   unpublished  → COUNT falls
 *   edited       → MAX(updated_at) rises
 *   created      → both
 * The length term is not needed once updated_at carries milliseconds, which
 * the schema guarantees: two saves inside the same second can no longer share
 * a timestamp.
 */
async function corpusFingerprint(): Promise<string> {
  const row = await sql().first<{ n: number; edited: string }>(
    `SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS edited
     FROM articles WHERE status='published'`
  );
  if (!row) return "0:";
  return `${row.n}:${row.edited}`;
}

async function buildIndex(fingerprint: string): Promise<Index> {
  const articles = await allArticlesWithBodies();
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
  return { chunks, df, tf, len, avgLen, builtFor: fingerprint };
}

export async function searchChunks(query: string, k = 6): Promise<Hit[]> {
  const fingerprint = await corpusFingerprint();
  if (!_index || _index.builtFor !== fingerprint) _index = await buildIndex(fingerprint);
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

/**
 * Drop the cached index in THIS isolate.
 *
 * Kept only as a local fast path — it saves one stale query in the process
 * that made the edit. It is explicitly NOT how correctness is achieved:
 * every query re-checks the corpus fingerprint, so an isolate that never
 * receives this call still cannot serve a stale result. Do not reintroduce
 * anything that relies on this reaching another isolate.
 */
export function invalidateSearchIndex() {
  _index = null;
}
