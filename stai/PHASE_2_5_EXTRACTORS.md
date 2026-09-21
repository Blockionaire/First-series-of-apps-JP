# Phase 2.5 — source-specific extractors

**Status:** proposed, not built. Awaiting approval.

Twenty of the 51 registered sources publish nothing machine-readable and are
marked `html_scrape`, which phase 2 does not implement. They report
`skipped_unsupported` and fetch nothing.

Several of them are the primary sources this desk's whole evidence rule points
at. This proposes extractors for **six**, chosen because their absence changes
what the engine can legitimately publish — not because the list would look
tidier complete.

**No generic web scraper.** One extractor per site, each with its own parse
function, its own saved fixture and its own test. A generic extractor would
fill the Inbox with navigation links and look like it was working, which is
worse than an honest `skipped_unsupported`.

---

## Why these six

The masterplan's hardest rule (§8) is that a regulatory or standards claim
cannot reach review without a **Tier-1 primary source**. Right now the engine
can reach EU institutions through EUR-Lex, the Commission press corner, ESMA,
EBA, EIOPA, EDPB and ENISA — all RSS.

It cannot reach **any auditing or ethics standard setter at all**, and it
cannot reach the body writing the sustainability-reporting standards. So a
piece about ISA 240 or about an ESRS amendment either has no primary source and
is blocked, or gets written from secondary coverage — which is exactly the
laundering the tiers exist to prevent.

| # | Source | Why it is critical | Volume |
|---|---|---|---|
| 1 | **IAASB** (`iaasb.org`) | ISA and ISQM pronouncements. The only primary source for any auditing-standards claim. Without it the desk's core beat has no Tier-1 source. | ~2–4/month |
| 2 | **EFRAG** (`efrag.org`) | ESRS development and CSRD technical advice. CSRD assurance is the single largest live change in European reporting. | ~4–8/month |
| 3 | **European AI Office** (`digital-strategy.ec.europa.eu`) | AI Act guidance, codes of practice and implementation timelines. The desk's founding subject. The Commission press corner carries announcements; the AI Office carries the guidance itself. | ~2–5/month |
| 4 | **IESBA** (`ethicsboard.org`) | The ethics code, including its technology and independence work — the rule practitioners breach first when they adopt AI tooling. | ~1–3/month |
| 5 | **NBA** (`nba.nl`) | Dutch professional body: NV COS changes and practice notes. The home market, and the one where "what does this mean for me" is most concrete. | ~4–8/month |
| 6 | **CEAOB** (`finance.ec.europa.eu`) | The committee of European audit oversight bodies. Very low volume, and when it publishes it is directly about the audit profession's supervision. | ~1–2/month |

Total expected: **15–30 items a month.** Low volume, high value — which is the
right shape, and also why hand-written extractors are affordable here.

### Deliberately not in scope

- **COSO, ISO, IIA** — global frameworks, useful context, rarely time-critical.
- **SSRN, AAA journal** — research feeds; the Research Note format can wait.
- **APAS (DE), H3C (FR)** — national oversight, valuable but lower volume than
  NBA and harder to parse; a phase 2.6 if the first six go well.
- **PwC / KPMG / EY insight pages** — Tier 2. Interpretation, never a primary
  citation, and the desk already has IAS Plus for standards commentary.
- **LinkedIn** — stays `manual`. Its terms forbid automated retrieval and that
  does not change because the content would be useful.

---

## Step 0 — check for a feed before writing any extractor

**Do this first, for all six.** An extractor written for a site that publishes
an undocumented Atom feed is pure waste, and feed URLs are often unlinked.

This repository has never had internet access, so the `html_scrape` marks are
*assumptions from the site's public structure*, not verified findings. For each
domain, check in this order:

1. `<link rel="alternate" type="application/rss+xml">` in the page source;
2. the conventional paths — `/feed`, `/rss`, `/rss.xml`, `/atom.xml`,
   `/feed.xml`, `/news/feed`;
3. whether the news listing is rendered from a JSON endpoint the page already
   calls (open the network tab — several institutional sites are a static
   shell over a JSON API, which is far more stable than their HTML);
4. whether an official aggregator carries it. EUR-Lex covers much of the
   Commission; IFAC's feed sometimes carries IAASB and IESBA announcements,
   which would settle two of the six at once.

**Anything found this way is a registry edit, not an extractor.** Change
`ingestion_method` and `feed_url` and it starts working immediately.

Budget half a day. Realistically one to three of the six will turn out to have
a feed.

---

## Design

### An extractor is a named function, registered by domain

```
src/lib/newsroom/extractors/
  index.ts          // domain → extractor, and nothing else
  iaasb.ts
  efrag.ts
  ai-office.ts
  iesba.ts
  nba.ts
  ceaob.ts
```

Each exports one function with the same shape the feed parser already produces,
so everything downstream — normalisation, dedup, clustering, gates — is
untouched:

```ts
export type Extractor = {
  /** Registry domain this serves. One extractor, one site. */
  domain: string;
  /** Parse a fetched listing page into feed items. */
  extract(html: string, pageUrl: string): FeedItem[];
  /** A sample this extractor must keep parsing. */
  fixture: string;
};
```

`fetchSource` gains one branch: when `ingestion_method === "html_scrape"`, look
the domain up in the registry. **No extractor registered → `skipped_unsupported`,
exactly as today.** There is no fallback path and no generic extraction.

### Three rules for every extractor

1. **Anchor on structure, not styling.** Match `<article>`, `<time datetime>`,
   `itemprop`, a stable id — never a Tailwind-ish class that changes when
   somebody edits a template.
2. **Return nothing rather than something wrong.** An extractor that cannot
   find its anchor returns `[]`, which surfaces as `empty_feed` and then as
   `silent` health after 3× the cadence. A navigation link presented as a
   standard is far worse than a visible gap.
3. **A date or nothing.** No date is better than the retrieval time, for the
   same reason the feed parser refuses to guess: recency is a ranking input, so
   a fabricated date promotes a piece that has not earned it.

### Testing

Each extractor gets a saved HTML fixture in `tests/fixtures/extractors/` and a
test asserting the items it produces. Fixtures are trimmed to the listing
region — enough to parse, not a copy of the site — and are the regression
evidence when a site is redesigned.

Plus one shared test: **every registered extractor's domain must exist in the
source registry, and every `html_scrape` source without an extractor must still
report `skipped_unsupported`.** That is what stops this quietly becoming a
generic scraper by accretion.

### Health

No new mechanism needed — this is why `empty_feed` exists as a distinct
outcome. A redesigned site returns 200 and an extractor that matches nothing,
so the source goes `empty_feed` → `silent` within 3× its cadence and appears in
the Inbox warnings. That is the failure mode extractors have and feeds mostly
do not, and it is already instrumented.

---

## Effort and sequencing

| Step | Work |
|---|---|
| 0 | Feed hunt across all six — half a day, may remove some from the list |
| 1 | Extractor seam in `fetchSource` + registry + shared tests — half a day |
| 2 | IAASB, EFRAG, AI Office — one day |
| 3 | IESBA, NBA, CEAOB — half a day |
| 4 | Fixtures, tests, full verification — half a day |

**Roughly two to three days**, less whatever step 0 removes.

### When

**After the dry run starts, not before.** Two reasons. The first week of the
dry run will show which feeds actually resolve — the 30 currently-fetchable
sources are unverified URLs, and fixing those is higher value than adding new
ones. And the dry run's labelled verdicts will show whether the gap is
theoretical or real: if standards stories are arriving adequately through IFAC
and IAS Plus commentary, this is less urgent than it looks on paper.

Phase 3 should not start until this is done, because phase 3 is the evidence
engine and the primary-source rule is what it enforces. An evidence engine that
cannot reach the IAASB will block every auditing-standards story it is handed.
