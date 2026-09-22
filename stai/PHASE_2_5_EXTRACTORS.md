# Phase 2.5 — source-specific extractors

**Status:** the machinery is built and **APAS is the first extractor**. The six
sources below are still awaiting Step 0 verification before any more are
written.

## What exists now

`src/lib/newsroom/extractors/` holds the extractor allowlist. An `html_scrape`
source is retrievable **only** where a hand-written extractor is registered for
that exact domain; every other `html_scrape` row still reports
`skipped_unsupported`, unchanged. Registering a source can never, by itself,
cause a page to be scraped — that takes a file in that directory and a line in
its index.

| Publisher | File | Status |
|---|---|---|
| APAS (`apasbafa.bund.de`) | `extractors/apas.ts` | written, **selectors unverified against the live site** |

The APAS extractor anchors on the Government Site Builder URL taxonomy
(`/SharedDocs/` documents, `_node.html` section indexes) rather than on class
names, requires a German date near each link, refuses navigation, and returns
an **error** rather than an empty list when a page yields nothing recognisable
— so a redesign reads as an outage rather than as a quiet news week.

It was written without network access, so no APAS page has ever been fetched by
this code. `tests/fixtures/apas-index.html` is synthetic and says so. **Run
Test source on the APAS row before marking it retrievable**; the probe runs the
extractor itself, so what you see is what a discovery run would get.

---

**Original proposal below — status: not built. Awaiting Step 0.**

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

This repository has never had internet access — the environment's network
policy answers `403` to every outbound host — so the `html_scrape` marks are
*assumptions from each site's public structure*, not verified findings. **None
of the URLs below has been fetched from this codebase.** They are candidates to
try, ranked by how likely each is to exist, and the point of listing them is
that trying one now costs a click.

### The instrument: `Test source`

`/admin/editorial/sources` has a **Test source** button on every row, added for
exactly this. It makes one request without ingesting anything and reports the
HTTP status, the final URL after redirects, the content type, the detected
format, the item count, the newest publication date and the first three item
titles.

It works on a source that is **off and unapproved** — deciding whether a URL is
worth approving has to be possible before approving it — and it grants nothing:
no retrieval permission, no activation, no stored items. The box beside it
takes a candidate path to try without committing it, and every attempt is kept
in `newsroom_source_probes`, so the sequence of what did not work survives the
browser tab.

The URL must belong to the row's registered domain. That is the containment:
the furthest the tester can be aimed is a different path on a publisher already
in the registry.

### The order to check in

1. **View source on the news page** and look for
   `<link rel="alternate" type="application/rss+xml">`. This is still the most
   reliable single answer and takes ten seconds.
2. **Try the conventional paths** with Test source. Table below.
3. **Open the network tab on the news listing.** Several institutional sites
   are a static shell over a JSON endpoint, which is more stable than their
   HTML and needs no extractor at all — register it as `json_api`.
4. **Check whether an aggregator already carries it.** IFAC's feed has
   historically carried IAASB and IESBA announcements, which would settle two
   of the six at once. EUR-Lex covers much of the Commission.

### Candidate paths to try, per source

Ranked most to least likely. Stop at the first that returns a feed with items.

| Source | Registered now | Try, in order |
|---|---|---|
| **IAASB** | `https://www.iaasb.org/news-events` | `/feed`, `/rss.xml`, `/news-events/rss`, `/news-events/feed` — then check IFAC's own feed, since IAASB sits under IFAC and its announcements have historically appeared there |
| **IESBA** | `https://www.ethicsboard.org/news-events` | Same shapes as IAASB — the two sites share a platform, so whatever works for one very likely works for the other. Check IFAC's feed for the same reason |
| **EFRAG** | `https://www.efrag.org/en/news-and-calendar` | `/en/news-and-calendar/rss`, `/rss`, `/feed`; then the network tab — the news-and-calendar page is the most likely of the six to be a JSON-backed shell |
| **European AI Office** | `https://digital-strategy.ec.europa.eu/en/policies/ai-office` | The Commission's digital-strategy site publishes per-section RSS: try `/en/news/rss.xml` and the `?f[0]=` filtered variants the news page's own RSS icon points at. Most likely of the six to already have a real feed |
| **CEAOB** | `https://finance.ec.europa.eu/.../auditing_en` | Same platform family as the AI Office — look for the site's news RSS and a topic filter. If none, this is genuinely low volume and `manual` is a defensible answer |
| **NBA** | `https://www.nba.nl/nieuws/` | `/rss`, `/nieuws/rss`, `/feed`, `/nieuws/rss.xml` — Dutch association sites on common CMSs usually expose one |

### When you find one

**It is a registry edit, not an extractor.** Use **Edit** on the row and set
*both* the feed URL and the retrieval method in the same save. Saving the URL
alone on an `html_scrape` row leaves the source skipped as `skipped_unsupported`
on every run — verified, approved, activated and silently never fetched — which
is why the method sits in the edit form next to the URL, and why Test source
warns when the detected format and the registered method disagree.

Then: set **Review** to `Feed verified`, check robots.txt and the site's terms,
and only then tick **Retrievable**.

### Report back before any extractor is written

Which of the six have feeds decides how much of this phase exists at all. If
the AI Office and CEAOB both turn out to have Commission RSS, and IFAC carries
IAASB and IESBA, then four of six are registry edits and the extractor work is
EFRAG and NBA only — a much smaller and much better outcome than the plan
below.

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
