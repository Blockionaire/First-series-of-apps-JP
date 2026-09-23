# Phase 2.5 — source-specific extractors

**Status:** the machinery is built and **eight extractors are written** — APAS,
Anthropic, CEAOB, ENISA, the European AI Office, COSO, the FRC and H2A. The
remaining sources in the original proposal below are still awaiting Step 0
verification before any more are written.

## What exists now

`src/lib/newsroom/extractors/` holds the extractor allowlist. An `html_scrape`
source is retrievable **only** where a hand-written extractor is registered for
that exact domain; every other `html_scrape` row still reports
`skipped_unsupported`, unchanged. Registering a source can never, by itself,
cause a page to be scraped — that takes a file in that directory and a line in
its index.

| Publisher | File | Status |
|---|---|---|
| APAS (`apasbafa.bund.de`) | `extractors/apas.ts` | index confirmed live; **detail-page selectors unverified** |
| Anthropic (`anthropic.com/news`) | `extractors/anthropic.ts` | written, **unverified against the live site** |
| CEAOB (`finance.ec.europa.eu`) | `extractors/ceaob.ts` | written, **unverified against the live site** |
| ENISA (`enisa.europa.eu/news`) | `extractors/enisa.ts` | written, **unverified against the live site** |
| European AI Office (`digital-strategy.ec.europa.eu`) | `extractors/ai-office.ts` | written, **unverified against the live site** |
| COSO (`coso.org/news`) | `extractors/coso.ts` | written, **unverified against the live site** |
| FRC (`frc.org.uk/news-and-events/news/`) | `extractors/frc.ts` | written, **unverified against the live site** |
| H2A (`h2a-france.org/publications-et-actualites/`) | `extractors/h2a.ts` | **hub verified**; item shape under it unverified; no feed checked |

All eight anchor on URL taxonomy rather than class names, refuse navigation,
and return an **error** rather than an empty list when a page yields nothing
recognisable — so a redesign reads as an outage rather than as a quiet news
week. When one refuses, it **names the path shapes it actually found**, so a
wrong guess costs one round trip rather than three. That is the APAS lesson,
generalised.

### Two registered URLs changed

| Source | Was | Now | Why |
|---|---|---|---|
| ENISA | `…/news-items/news-wires/RSS` (rss) | `…/news` (html_scrape) | A Plone-era feed address predating the site redesign. |
| COSO | `/guidance` | `/news` | `/guidance` is a catalogue of evergreen framework landings, not a stream. An extractor reading it would report the same items every poll, dated by whatever sat nearby. |
| FRC | `/news-and-events/rss/` (rss) | `/news-and-events/news/` (html_scrape) | Feed obsolete, per the operator. |
| H3C → **H2A** | `h3c.org` | `h2a-france.org` | The Haut Conseil was reconstituted as the Haute Autorité de l'Audit. **The domain changed, so this is a different row, not an edit.** |

Every one of these is a **deliberate re-registration, not a silent fallback**.
The standing rule that a feed beats a scraper still holds: where a feed was
dropped it was because it was reported dead, and if a working one turns up it
should replace the extractor.

`load_proposal` skips domains already in the registry, so **rows registered
from an earlier version of the seed keep their stored URL and method** — an
existing ENISA, COSO or FRC row has to be corrected with **Edit**.

**H3C → H2A is done by `migrations/0010_h3c_to_h2a.sql`**, which runs on the
next `npm run cf:deploy`. It switches H3C off, withdraws its retrieval
permission and marks it `Do not use`; then registers H2A **inactive and not
retrievable**, exactly as `load_proposal` would. Registering a source has
never implied permission to read it, and a migration is not the place to start
— turning H2A on is still a person's act, in the registry, and still records
who did it.

It is the first migration here that touches data rather than schema, so what
it may do is deliberately narrow: it removes capability from one row and adds
a dormant one, and it is a no-op on a registry that has no H3C or already has
H2A. An H2A row added by hand first is left completely alone, including its
URL and any permission granted to it.

Nothing stops you doing it in the registry UI instead, in two clicks — the
migration writes the same columns `setSourceReviewStatus` and `createSource`
write, so a row retired either way is indistinguishable afterwards.

### H2A: the hub is verified, the shape under it is not

The operator confirmed the official publication hub:
`https://h2a-france.org/publications-et-actualites/`. That replaced a guess
(`/actualites/`, inferred from the predecessor site at `h3c.org`), and the
correction says something about the rest of the guesswork — **H2A files
publications and news together under one combined section**, which is neither
what the old site did nor what a French institutional site usually does.

So the other inferred section names (`/communiques/`, `/espace-presse/`,
`/doctrine/`) were **removed rather than kept as spare capacity**. A list of
plausible paths nobody has seen is not a safety net; it is several more
chances to be confidently wrong. One section, and it is the one somebody
looked at.

Still unseen: the shape of an item **under** the hub. The extractor assumes
`/publications-et-actualites/<slug>`. If that is wrong, the refusal says so
specifically — it names the path shapes the hub actually links and states that
the hub address is confirmed, so the diagnosis points at the item rule rather
than at the surface.

### H2A: the feed was asked for first and could not be tried

The instruction was to prefer an official feed and fall back to an extractor
only if the feed is not usable. This build environment has no outbound network,
so **no h2a-france.org URL has been fetched and no feed has been confirmed to
exist**. A guessed feed URL in the seed would read as a checked fact.

So the row is registered against the news surface, and the question is handed
to whoever has a network, in the place they will meet it: `extractH2a`
recognises an RSS or Atom body and **refuses it with an instruction** — *"set
this source's method to `rss` and test again"*. Point the row at a candidate
feed with **Test source**; if one exists, that is what it will say.

### FRC: podcasts and videos need a rule a URL cannot make

The FRC lists recordings **in** the news stream, at news addresses, with only a
type label to mark them. A recording is not text a regulatory claim can cite,
so `MEDIA_KINDS` is checked against the entry's own category. The fixture
carries a podcast and a video at news addresses; removing the rule lets both
through.

### The AI Office is scoped by subject, not by domain

`digital-strategy.ec.europa.eu` is the whole of DG CONNECT: broadband, digital
skills, media pluralism, submarine cables. The AI Office page is a **hub**, so
a link becomes an item only if it meets all three of:

1. a Digital Strategy **update** address — `/en/news/…` or `/en/library/…`
   (not `/policies/…`, which is an evergreen description);
2. it names a **specific** AI Office subject — "AI Act", "AI Office", "GPAI",
   "general-purpose AI", "code of practice" and so on. The bare word **"AI" is
   deliberately excluded**: it appears across this host in other units' work,
   and admitting it turns a scoped extractor into a subject-matter guess;
3. it carries a date.

The fixture carries a real Digital Europe funding announcement that says "AI"
in so many words, so the subject list is under test rather than assumed.

### APAS is two-phase, and why

Two live tests corrected it twice, and both corrections are worth keeping in
mind before pointing an extractor at any government site.

The first test found the landing page served 200 and linked plenty of
`/SharedDocs/…/APAS/DE/…` URLs, none of them publications — `slogan.html` is a
strapline. On the Government Site Builder `/SharedDocs/` is a shared *content
repository*, so "not navigation" is not "is a publication".

The second found that the confirmed index lists its publications as

    /SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html

— a series numbered sequentially, with **no date in the address**, **no
headline in the link text**, and **no date on the index at all**. So the
extractor returns those links as `pending`, `hydrate()` opens each one, and
`detail()` reads the title and the publication date off the page itself. An
entry that cannot produce **both** is dropped, however genuine its URL looks.

Bounds: a retrieval opens at most 30 detail pages, a `Test source` at most 6,
sequentially, and every URL is re-checked against the APAS mandant before the
request leaves. `Test source` reports how many it opened against how many were
listed, so a sample is never mistaken for the whole source.

### Still unverified

No APAS page has been fetched by this code — the build environment has no
outbound network. The index URL and the `vb_verlautbarung_NN.html` pattern come
from the operator's live tests. **What a detail page looks like has been seen
by nobody**, so the date chain tries named metadata, `<time datetime>`, a
labelled date line and finally a German date in the content region — in that
order, all but the first scoped to the content region so the site-wide footer
date cannot stamp the whole series. Expect the detail selectors, not the URL
rules, to be what the next live test corrects.

Every fixture under `tests/fixtures/` is synthetic and says so in its header.
**Run Test source before marking any of these retrievable**; the probe runs the
extractor and its detail fetches, so what you see is what a discovery run would
get.

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

This was the scope when phase 2.5 began. COSO, APAS and H2A (H3C's successor)
have since been given extractors — see the table at the top.

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
