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
 *   2. Shared rare terms, TITLE FIRST. The real work. A regulation's name, a
 *      standard's number and the thing that happened are in the headline;
 *      the lead adds a little, and only after the publisher's own house
 *      language has been taken out of it.
 *   3. Shared names in the headline. Capitalised names and standard
 *      references, which survive rewriting: every outlet covering an IAASB
 *      exposure draft says "IAASB", whatever else they change.
 *
 * ── Why house language is removed (CODE_AUDIT.md H3) ────────────────────
 * Every EBA item opens "The European Banking Authority (EBA) today published
 * … As part of its mandate to contribute to a single rulebook …". Measured
 * with the lead weighed like the title, ten unrelated EBA publications — a
 * stress test, a crypto consultation, an AML peer review — became ONE story,
 * because the only thing they shared was the publisher's boilerplate, and at
 * a cold start nothing marked it as common. Three rules now make that
 * impossible, each sufficient on its own for the EBA case:
 *
 *   · `houseTerms`: a word in most of one source's own feed is that
 *     publisher's house language, and does not count when that source's items
 *     are compared;
 *   · the score is 80% headline, measured in BOTH directions, so a lead can
 *     lift a headline match but cannot make one;
 *   · two items from the SAME publisher are one development only if their
 *     headlines say so — a publisher does not announce one thing twice at
 *     different addresses (a correction at the same address is a revision,
 *     handled before clustering).
 *
 * And one rule for a neighbouring false merge: two DIFFERENT issuing
 * authorities announcing their own acts are two developments, even on one
 * topic — the EBA consulting on MiCA reporting standards and ESMA finalising
 * MiCA white-paper standards share a vocabulary and nothing else. A genuine
 * joint publication carries near-identical headlines at both, and passes.
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
  /**
   * Tokens of the cluster's REPRESENTATIVE member, not of every member joined
   * together.
   *
   * The distinction is the whole of the first production bug. Similarity was
   * measured against the union of all members' text, and `weightedOverlap`
   * asks what fraction of the incoming item's tokens appear in that set — so
   * every join made the set larger and the cluster a better match for the next
   * thing. One cluster swallowed nine items from a single feed. A cluster
   * compared against one fixed document cannot become an attractor.
   */
  tokens: string[];
  entities: string[];
  /** The representative's headline tokens. Derived from `title` when absent. */
  titleTokens?: string[];
  /** Sources of the story's members, for the same-publisher rule. */
  sourceIds?: number[];
  /** Members' sources that are issuing authorities (see `ClusterInput.issuer`). */
  issuerIds?: number[];
  /** The representative's publication instant, for the proximity check. */
  publishedAt?: string | null;
  lastSeenAt: string;
};

export type ClusterInput = {
  url: string;
  title: string;
  lead: string;
  publishedAt?: string | null;
  /** The registered source the item came from. */
  sourceId?: number;
  /** That source's house language (see `houseTerms`): ignored in this item. */
  boilerplate?: ReadonlySet<string>;
  /**
   * The source issues what it announces: a Tier-1 regulator or standard
   * setter, speaking about its own act rather than covering someone else's.
   */
  issuer?: boolean;
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

/** Share of the score that comes from the headline; the rest from the lead. */
export const TITLE_WEIGHT = 0.8;

/**
 * Headline similarity two items from the SAME source need before they can be
 * one story. A publisher's follow-up to its own announcement repeats the
 * subject in the headline; a different announcement does not.
 */
export const SAME_SOURCE_TITLE_MIN = 0.5;

/**
 * Headline similarity an issuing authority's item needs to join a story that
 * a DIFFERENT issuing authority started. Joint publications clear it easily;
 * two regulators' separate acts on one topic do not.
 */
export const OTHER_ISSUER_TITLE_MIN = 0.6;

/**
 * A source's house language: the words in at least 60% of its own items.
 *
 * Computed from the feed a run has just read, so it needs no history and
 * works from the very first run. Four items minimum — below that, "most of
 * the feed" is too few documents to tell house style from coincidence, and
 * the other rules (headline weighting, the same-publisher rule) carry it.
 */
export const HOUSE_SHARE = 0.6;
export const HOUSE_MIN_ITEMS = 4;

export function houseTerms(items: { title: string; lead: string }[]): Set<string> {
  const house = new Set<string>();
  if (items.length < HOUSE_MIN_ITEMS) return house;
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const t of new Set(tokenize(`${it.title} ${it.lead}`))) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const [t, n] of counts) if (n / items.length >= HOUSE_SHARE) house.add(t);
  return house;
}

const NO_TERMS: ReadonlySet<string> = new Set();

/** Days a story stays open to new members. */
export const WINDOW_DAYS = 7;

/**
 * How far apart two items may be published and still be one development.
 *
 * The second half of the EBA fix. Lexical similarity alone cannot separate a
 * weekly mailing from last week's: "EBA e-mail alert 18 September" and "EBA
 * e-mail alert 11 September" differ by two tokens out of a dozen, and no
 * symmetric text measure calls that a different document. What separates them
 * is that they were published a week apart — one development happens once.
 *
 * Three days, because coverage of an announcement lands the same day or the
 * next, and a Friday announcement can draw Monday analysis. It is deliberately
 * shorter than the seven-day membership window: that window says how long a
 * story stays open at all, this says how close two reports must be to be the
 * same report.
 *
 * Applied only when BOTH dates are known. An unknown date is not evidence of
 * distance, and blocking on it would split stories whose feeds omit dates.
 */
export const SAME_DEVELOPMENT_DAYS = 3;

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

  // The item's own words, without its publisher's house language. The
  // headline's words are kept apart from the lead's: they carry the score.
  const house = item.boilerplate ?? NO_TERMS;
  const titleTokens = [...new Set(tokenize(item.title))].filter((t) => !house.has(t));
  const titleSet = new Set(titleTokens);
  const leadTokens = [...new Set(tokenize(item.lead))].filter((t) => !house.has(t) && !titleSet.has(t));
  const itemAll = [...titleTokens, ...leadTokens];
  // Names in the headline only, and not the publisher's own name: "EBA" in an
  // EBA item says who is speaking, not what about.
  const itemEntities = entities(item.title).filter(
    (e) => !tokenize(e).every((t) => house.has(t))
  );

  // Document frequency across the open window, so weighting reflects what is
  // actually common in the current news cycle rather than in general English.
  const df = new Map<string, number>();
  for (const c of open) {
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const itemPublished = item.publishedAt ? Date.parse(item.publishedAt) : NaN;

  let best: Match | null = null;
  for (const c of open) {
    // Publication proximity, before any text is compared. Two near-identical
    // documents published a week apart are a recurring bulletin, not one
    // development reported twice — and that is the only thing that separates
    // them, since their text barely differs. Skipped when either date is
    // unknown: an absent date is not evidence of distance.
    const candidatePublished = c.publishedAt ? Date.parse(c.publishedAt) : NaN;
    if (Number.isFinite(itemPublished) && Number.isFinite(candidatePublished)) {
      const apart = Math.abs(itemPublished - candidatePublished);
      if (apart > SAME_DEVELOPMENT_DAYS * 86_400_000) continue;
    }

    // Headline similarity, both ways: the item's headline words found in the
    // story, and the story's headline words found in the item. One direction
    // alone lets a short headline ("EBA update") match anything wordy.
    const candidateTitle = c.titleTokens ?? tokenize(c.title);
    const titleSim =
      titleTokens.length === 0
        ? 0
        : (weightedOverlap(titleTokens, c.tokens, df, open.length) +
            weightedOverlap(candidateTitle, itemAll, df, open.length)) /
          2;

    // Same publisher, different address: one development only if the
    // headlines agree.
    const samePublisher =
      item.sourceId !== undefined &&
      (c.sourceIds?.length ?? 0) > 0 &&
      c.sourceIds!.every((id) => id === item.sourceId);
    if (samePublisher && titleSim < SAME_SOURCE_TITLE_MIN) continue;

    // A different authority's own act, unless the headlines say "joint".
    const otherIssuer =
      item.issuer === true &&
      item.sourceId !== undefined &&
      (c.issuerIds?.length ?? 0) > 0 &&
      !c.issuerIds!.includes(item.sourceId);
    if (otherIssuer && titleSim < OTHER_ISSUER_TITLE_MIN) continue;

    const leadSim = weightedOverlap(leadTokens, c.tokens, df, open.length);
    const lexical = TITLE_WEIGHT * titleSim + (1 - TITLE_WEIGHT) * leadSim;

    const sharedEntities = itemEntities.filter((e) => c.entities.includes(e));
    // Entities are corroboration, not proof: "EUROPEAN COMMISSION" appears in
    // half the corpus. Capped so they can lift a genuine match over the line
    // without carrying a weak one there on their own.
    const entityBoost = Math.min(0.2, sharedEntities.length * 0.07);

    const score = lexical + entityBoost;
    if (score < MATCH_THRESHOLD) continue;
    if (best && score <= best.score) continue;

    const parts = [`${Math.round(titleSim * 100)}% headline overlap`];
    if (sharedEntities.length > 0) {
      parts.push(`shares ${sharedEntities.slice(0, 4).join(", ")}`);
    }
    best = { storyId: c.storyId, score, reason: parts.join("; ") };
  }

  return best;
}

/* ── Building candidates ────────────────────────────────────────────────── */

export type StoryRow = { id: number; canonical_title: string; last_seen_at: string };
export type MemberRow = {
  story_id: number;
  canonical_url: string;
  title: string;
  lead: string;
  published_at: string | null;
  retrieved_at: string;
  /** The member's source, for the same-publisher rule. */
  source_id?: number;
  /** The member's source is an issuing authority (see `ClusterInput.issuer`). */
  issuer?: boolean;
};

/**
 * Turn stories and their members into things `findCluster` can match against.
 *
 * Lives here rather than beside the query it serves, and is pure, because this
 * fold IS the first production bug. It used to join every member's text
 * together, and the consequence — one EBA cluster absorbing nine items — was
 * invisible until it happened live. A pure function can be held to the rule
 * directly, which is the only way this stays fixed.
 *
 * `members` must arrive OLDEST FIRST; the caller's ORDER BY guarantees it, and
 * the first row seen for a story becomes that story's representative.
 */
export function buildCandidates(stories: StoryRow[], members: MemberRow[]): ClusterCandidate[] {
  const byStory = new Map<
    number,
    {
      urls: string[];
      repText: string | null;
      repTitle: string | null;
      repPublished: string | null;
      sources: Set<number>;
      issuers: Set<number>;
    }
  >();
  for (const m of members) {
    const entry =
      byStory.get(m.story_id) ??
      { urls: [], repText: null, repTitle: null, repPublished: null, sources: new Set<number>(), issuers: new Set<number>() };
    // Every URL, for the identity check — a story matches on any member's
    // address, even though it matches on only one member's text.
    entry.urls.push(m.canonical_url);
    if (m.source_id !== undefined) entry.sources.add(m.source_id);
    if (m.source_id !== undefined && m.issuer) entry.issuers.add(m.source_id);
    if (entry.repText === null) {
      entry.repText = `${m.title} ${m.lead}`;
      entry.repTitle = m.title;
      entry.repPublished = m.published_at;
    }
    byStory.set(m.story_id, entry);
  }

  return stories.map((s) => {
    const entry = byStory.get(s.id);
    const text = entry?.repText ?? s.canonical_title;
    return {
      storyId: s.id,
      title: s.canonical_title,
      urls: entry?.urls ?? [],
      tokens: tokenize(text),
      entities: entities(text),
      titleTokens: tokenize(entry?.repTitle ?? s.canonical_title),
      sourceIds: entry && entry.sources.size > 0 ? [...entry.sources] : undefined,
      issuerIds: entry && entry.issuers.size > 0 ? [...entry.issuers] : undefined,
      publishedAt: entry?.repPublished ?? null,
      lastSeenAt: s.last_seen_at,
    };
  });
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
