/**
 * Recognising that eighteen reports are one development.
 *
 * ── Lexical, on purpose ─────────────────────────────────────────────────
 * Masterplan change C4. `src/lib/search.ts` already rejected an external
 * vector database for reasons that hold here too: the working set is small,
 * lexical matching is transparent and reproducible — an auditor's virtue —
 * and nothing leaves the box. A story cluster a human disagrees with can be
 * explained here ("these two share eleven rare terms"); one produced by an
 * embedding cannot.
 *
 * Embeddings get added when the dry run's hand-labelled data shows recall is
 * poor, and not before. That is the measurement the two weeks exist to
 * produce.
 *
 * ── Three signals, in order of confidence ───────────────────────────────
 *   1. Same canonical URL. Two registered sources syndicating one press
 *      release. Certain — this is identity, not similarity.
 *   2. Shared rare terms. The real work. A regulation's name, a standard's
 *      number and a body's acronym are exactly the terms that are rare across
 *      the corpus and common within one story.
 *   3. Shared entities. Capitalised names and standard references, which
 *      survive rewriting: every outlet covering an IAASB exposure draft says
 *      "IAASB", whatever else they change.
 *
 * ── The window ──────────────────────────────────────────────────────────
 * Seven days. Long enough that a Friday announcement and Monday's analysis
 * join the same story; short enough that "European Commission publishes
 * guidance" in March does not swallow the one in September.
 */

/** Terms that carry no distinguishing weight in this corpus. */
const STOP = new Set(
  ("a an and are as at be by for from has have in is it its of on or that the this to was were " +
    "will with we you your not our their they if do does can new news says said after before " +
    "more most about into over under between during against report reports published publishes " +
    "announced announces update updates latest")
    .split(" ")
);

/**
 * The same tokenizer shape as lib/search.ts, kept separate deliberately.
 *
 * Sharing the function would couple the newsroom's clustering to the Ask STAI
 * retrieval index: a stop word added to improve one would silently change the
 * other. They are different corpora with different failure modes.
 */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüéèáàß\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Capitalised names, acronyms and standard references.
 *
 * "ISA 240", "IAASB", "European Commission", "Regulation (EU) 2024/1689".
 * These survive rewriting, which is what makes them worth matching on: every
 * outlet paraphrases the summary and none of them rename the standard.
 */
export function entities(text: string): string[] {
  const found = new Set<string>();

  // Standards and regulations: letters then a number, e.g. ISA 240, IFRS 18.
  for (const m of text.matchAll(/\b([A-Z]{2,10})\s?(\d{1,4}(?:\/\d{2,4})?)\b/g)) {
    found.add(`${m[1]} ${m[2]}`.toUpperCase());
  }
  // Bare acronyms of three or more capitals.
  for (const m of text.matchAll(/\b([A-Z]{3,10})\b/g)) {
    found.add(m[1].toUpperCase());
  }
  // Multi-word proper nouns: two or more consecutive capitalised words.
  for (const m of text.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})\b/g)) {
    found.add(m[1].toUpperCase());
  }
  return [...found];
}

export type ClusterCandidate = {
  storyId: number;
  title: string;
  /** Canonical URLs already in the cluster. */
  urls: string[];
  tokens: string[];
  entities: string[];
  lastSeenAt: string;
};

export type ClusterInput = {
  url: string;
  title: string;
  lead: string;
};

export type Match = {
  storyId: number;
  score: number;
  /** In plain words, why. Shown in the Inbox so a human can disagree with it. */
  reason: string;
};

/** How similar two token sets are, weighted towards rarer terms. */
function weightedOverlap(a: string[], b: string[], df: Map<string, number>, docs: number): number {
  const setB = new Set(b);
  let shared = 0;
  let total = 0;
  for (const t of new Set(a)) {
    // Inverse document frequency: a term in every story tells you nothing, a
    // term in two stories tells you they are probably the same story.
    const weight = Math.log(1 + docs / (1 + (df.get(t) ?? 0)));
    total += weight;
    if (setB.has(t)) shared += weight;
  }
  return total === 0 ? 0 : shared / total;
}

/** Above this, two items are the same development. */
export const MATCH_THRESHOLD = 0.42;

/** Days a story stays open to new members. */
export const WINDOW_DAYS = 7;

/**
 * Find the story this item belongs to, if any.
 *
 * Returns the best match above the threshold, or null for a new story. The
 * reason string is part of the contract: every clustering decision has to be
 * explainable in the Inbox, because the dry run is a human disagreeing with
 * specific decisions.
 */
export function findCluster(
  item: ClusterInput,
  candidates: ClusterCandidate[],
  now = Date.now()
): Match | null {
  if (candidates.length === 0) return null;

  const cutoff = now - WINDOW_DAYS * 86_400_000;
  const open = candidates.filter((c) => {
    const seen = Date.parse(c.lastSeenAt);
    return !Number.isFinite(seen) || seen >= cutoff;
  });
  if (open.length === 0) return null;

  // 1. Identity. Same address, same document — no similarity needed.
  for (const c of open) {
    if (c.urls.includes(item.url)) {
      return { storyId: c.storyId, score: 1, reason: "same canonical URL as an item already in this story" };
    }
  }

  const itemTokens = tokenize(`${item.title} ${item.lead}`);
  const itemEntities = entities(`${item.title} ${item.lead}`);

  // Document frequency across the open window, so weighting reflects what is
  // actually common in the current news cycle rather than in general English.
  const df = new Map<string, number>();
  for (const c of open) {
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }

  let best: Match | null = null;
  for (const c of open) {
    const lexical = weightedOverlap(itemTokens, c.tokens, df, open.length);

    const sharedEntities = itemEntities.filter((e) => c.entities.includes(e));
    // Entities are corroboration, not proof: "EUROPEAN COMMISSION" appears in
    // half the corpus. Capped so they can lift a genuine match over the line
    // without carrying a weak one there on their own.
    const entityBoost = Math.min(0.2, sharedEntities.length * 0.07);

    const score = lexical + entityBoost;
    if (score < MATCH_THRESHOLD) continue;
    if (best && score <= best.score) continue;

    const parts = [`${Math.round(lexical * 100)}% weighted term overlap`];
    if (sharedEntities.length > 0) {
      parts.push(`shares ${sharedEntities.slice(0, 4).join(", ")}`);
    }
    best = { storyId: c.storyId, score, reason: parts.join("; ") };
  }

  return best;
}

/**
 * A readable title for a cluster.
 *
 * The earliest Tier-1 headline where there is one, because the issuing body
 * describes its own announcement more precisely than the coverage does.
 * Falling back to the first thing seen is fine — this is a label for a human
 * scanning a list, not a published headline.
 */
export function clusterTitle(members: { title: string; tier: number; seenAt: string }[]): string {
  if (members.length === 0) return "Untitled story";
  const sorted = [...members].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.seenAt.localeCompare(b.seenAt);
  });
  return sorted[0].title;
}
