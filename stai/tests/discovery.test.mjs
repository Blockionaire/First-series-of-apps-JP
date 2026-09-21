/**
 * Discovery, clustering and the gates — the pure logic, against the real
 * modules.
 *
 * The orchestrator and everything that touches D1 is tested separately, in
 * tests/discovery-run.test.mjs, against a real server and a real database.
 * What is here is the part where a mistake is silent: a canonicalisation that
 * misses a duplicate, a clusterer that merges two unrelated stories, a gate
 * that stops firing.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseFeed, parseFeedDate, plainText, decodeEntities } from "../src/lib/newsroom/feed.ts";
import {
  canonicalUrl,
  contentFingerprint,
  inferJurisdictions,
  sha256Hex,
} from "../src/lib/newsroom/normalise.ts";
import {
  MATCH_THRESHOLD,
  WINDOW_DAYS,
  clusterTitle,
  entities,
  findCluster,
  tokenize,
} from "../src/lib/newsroom/cluster.ts";
import {
  applyCap,
  firstFailure,
  gatesPassed,
  runGates,
  scoreStory,
} from "../src/lib/newsroom/relevance.ts";
import { shouldFetch, FAILURE_OUTCOMES, SKIP_OUTCOMES } from "../src/lib/newsroom/fetcher.ts";
import { idempotencyKey, dayKey } from "../src/lib/newsroom/run-keys.ts";

/* ── Feeds ──────────────────────────────────────────────────────────────── */

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Regulator</title>
  <item>
    <title>Commission adopts implementing act on AI Act transparency</title>
    <link>https://example.eu/news/ip-26-1234</link>
    <pubDate>Mon, 21 Sep 2026 09:00:00 GMT</pubDate>
    <description><![CDATA[<p>The obligation <b>applies from</b> 1 January 2027.</p>]]></description>
  </item>
  <item>
    <title>Second item</title>
    <link>https://example.eu/news/ip-26-1235</link>
    <pubDate>Sun, 20 Sep 2026 09:00:00 GMT</pubDate>
    <description>Short text</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Standard Setter</title>
  <entry>
    <title>IAASB issues exposure draft on ISA 240</title>
    <link rel="alternate" href="https://example.org/ed-isa-240"/>
    <published>2026-09-21T08:00:00Z</published>
    <summary>Comments close in December.</summary>
  </entry>
</feed>`;

describe("feed parsing", () => {
  test("reads RSS", () => {
    const r = parseFeed(RSS);
    assert.equal(r.ok, true);
    assert.equal(r.format, "rss");
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].url, "https://example.eu/news/ip-26-1234");
    assert.match(r.items[0].title, /implementing act/);
    assert.equal(r.items[0].publishedAt, "2026-09-21T09:00:00.000Z");
    // CDATA unwrapped, markup stripped.
    assert.equal(r.items[0].lead, "The obligation applies from 1 January 2027.");
  });

  test("reads Atom, where the address is an attribute", () => {
    const r = parseFeed(ATOM);
    assert.equal(r.ok, true);
    assert.equal(r.format, "atom");
    assert.equal(r.items[0].url, "https://example.org/ed-isa-240");
    assert.equal(r.items[0].publishedAt, "2026-09-21T08:00:00.000Z");
  });

  test("reads JSON feeds and loose JSON APIs", () => {
    const jsonFeed = parseFeed(
      JSON.stringify({ items: [{ url: "https://x.eu/a", title: "A", date_published: "2026-09-20" }] })
    );
    assert.equal(jsonFeed.ok, true);
    assert.equal(jsonFeed.items[0].url, "https://x.eu/a");

    const bare = parseFeed(JSON.stringify([{ link: "https://x.eu/b", headline: "B" }]));
    assert.equal(bare.ok, true);
    assert.equal(bare.items[0].title, "B");
  });

  test("an HTML page where a feed was expected is named, not silently empty", () => {
    // The most common real failure: the feed URL moved and the server returns
    // a 200 landing page. "Zero items" would read as a quiet source.
    const r = parseFeed("<!doctype html><html><body>Page not found</body></html>");
    assert.equal(r.ok, false);
    assert.match(r.error, /HTML page/);
  });

  test("an item with no link is dropped — it cannot be deduplicated or opened", () => {
    const r = parseFeed(`<rss><channel><item><title>No link</title></item></channel></rss>`);
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 0);
  });

  test("a guid is used as the address only when it is one", () => {
    const opaque = parseFeed(
      `<rss><channel><item><title>T</title><guid>abc-123-def</guid></item></channel></rss>`
    );
    assert.equal(opaque.items.length, 0, "an opaque guid is not a URL");

    const permalink = parseFeed(
      `<rss><channel><item><title>T</title><guid>https://x.eu/t</guid></item></channel></rss>`
    );
    assert.equal(permalink.items[0].url, "https://x.eu/t");
  });

  test("entities and markup are resolved", () => {
    assert.equal(decodeEntities("AT&amp;T &#8212; &quot;x&quot;"), 'AT&T — "x"');
    assert.equal(plainText("<p>one</p>  <p>two</p>"), "one two");
  });

  test("an unparseable date becomes null, never now", () => {
    // Defaulting to the retrieval time would make everything from a broken
    // feed look like breaking news, and recency is a ranking input.
    assert.equal(parseFeedDate("not a date"), null);
    assert.equal(parseFeedDate(""), null);
    assert.equal(parseFeedDate("Thu, 01 Jan 1970 00:00:00 GMT"), null, "epoch is a templating bug");
    assert.equal(parseFeedDate("2140-01-01"), null, "so is a date far in the future");
    assert.equal(parseFeedDate("2026-09-21T09:00:00Z"), "2026-09-21T09:00:00.000Z");
  });
});

/* ── Normalisation ──────────────────────────────────────────────────────── */

describe("canonical URLs — the dedup key", () => {
  test("the three shapes of one press release collapse to one", () => {
    const a = canonicalUrl("https://ec.europa.eu/news/ip_26_1234");
    const b = canonicalUrl("https://ec.europa.eu/news/ip_26_1234?utm_source=rss&utm_medium=feed");
    const c = canonicalUrl("https://www.ec.europa.eu/news/ip_26_1234/#main-content");
    assert.equal(a, b);
    assert.equal(a, c);
  });

  test("a meaningful parameter is kept — over-merging loses a story", () => {
    // ?doc=32024R1689 is a different regulation. Stripping unknown parameters
    // would merge distinct documents, which is worse than showing a duplicate.
    const a = canonicalUrl("https://eur-lex.europa.eu/legal?doc=32024R1689");
    const b = canonicalUrl("https://eur-lex.europa.eu/legal?doc=32024R1690");
    assert.notEqual(a, b);
  });

  test("parameter order does not create a second document", () => {
    assert.equal(
      canonicalUrl("https://x.eu/a?b=2&a=1"),
      canonicalUrl("https://x.eu/a?a=1&b=2")
    );
  });

  test("non-http schemes and unparseable input are refused", () => {
    assert.equal(canonicalUrl("javascript:alert(1)"), null);
    assert.equal(canonicalUrl("mailto:x@y.eu"), null);
    assert.equal(canonicalUrl("not a url"), null);
  });

  test("a relative link resolves against the feed", () => {
    assert.equal(
      canonicalUrl("/news/item", "https://example.eu/feed.xml"),
      "https://example.eu/news/item"
    );
  });

  test("the content fingerprint changes when the headline does", async () => {
    const a = await sha256Hex(contentFingerprint({ title: "One", lead: "x" }));
    const b = await sha256Hex(contentFingerprint({ title: "One corrected", lead: "x" }));
    const same = await sha256Hex(contentFingerprint({ title: "One", lead: "x" }));
    assert.notEqual(a, b, "a corrected headline is a change");
    assert.equal(a, same, "and an unchanged entry is not");
  });
});

describe("jurisdiction inference", () => {
  test("what the source declares is always kept", () => {
    const j = inferJurisdictions("Something entirely generic", ["NL"]);
    assert.ok(j.includes("NL"), "a weak text signal must not overrule a human's setting");
  });

  test("a member-state item on an EU feed picks up the country", () => {
    const j = inferJurisdictions("The AFM has published its findings for Dutch audit firms", ["EU"]);
    assert.ok(j.includes("NL"));
    assert.ok(j.includes("EU"));
  });

  test("GLOBAL drops away once a specific market is named", () => {
    const j = inferJurisdictions("The FRC published UK guidance", ["GLOBAL"]);
    assert.ok(j.includes("UK"));
    assert.ok(!j.includes("GLOBAL"), "GLOBAL is exclusive");
  });

  test("nothing identifiable falls back to GLOBAL rather than to nothing", () => {
    assert.deepEqual(inferJurisdictions("A general statement", []), ["GLOBAL"]);
  });
});

/* ── Clustering ─────────────────────────────────────────────────────────── */

const candidate = (id, title, lead, url, lastSeen = "2026-09-21T09:00:00.000Z") => ({
  storyId: id,
  title,
  urls: [url],
  tokens: tokenize(`${title} ${lead}`),
  entities: entities(`${title} ${lead}`),
  lastSeenAt: lastSeen,
});

const NOW = Date.parse("2026-09-21T12:00:00.000Z");

describe("clustering", () => {
  test("eighteen reports of one development are one story", () => {
    const existing = [
      candidate(
        1,
        "European Commission adopts implementing act on AI Act transparency obligations",
        "The act sets out how providers must disclose AI-generated content from January 2027.",
        "https://ec.europa.eu/a"
      ),
    ];
    const reuters = {
      url: "https://reuters.com/b",
      title: "EU adopts AI Act transparency rules for providers",
      lead: "The European Commission adopted an implementing act on AI Act transparency obligations, applying from 2027.",
    };
    const match = findCluster(reuters, existing, NOW);
    assert.ok(match, "coverage of an announcement belongs to the announcement");
    assert.equal(match.storyId, 1);
    assert.match(match.reason, /overlap/);
  });

  test("two unrelated developments stay apart", () => {
    const existing = [
      candidate(
        1,
        "IAASB issues exposure draft on ISA 240 fraud",
        "Comments close in December on the revised fraud standard.",
        "https://iaasb.org/a"
      ),
    ];
    const unrelated = {
      url: "https://x.eu/b",
      title: "Microsoft raises Copilot pricing for enterprise customers",
      lead: "New per-seat pricing takes effect next quarter for enterprise agreements.",
    };
    assert.equal(findCluster(unrelated, existing, NOW), null);
  });

  test("the same address is identity, not similarity", () => {
    const existing = [candidate(7, "Whatever", "text", "https://ec.europa.eu/same")];
    const m = findCluster(
      { url: "https://ec.europa.eu/same", title: "Totally different words here", lead: "" },
      existing,
      NOW
    );
    assert.ok(m);
    assert.equal(m.score, 1);
    assert.match(m.reason, /same canonical URL/);
  });

  test("a story older than the window does not swallow a new one", () => {
    // "European Commission publishes guidance" in March must not absorb the
    // one in September.
    const stale = candidate(
      1,
      "European Commission publishes guidance on AI Act transparency",
      "Guidance for providers.",
      "https://ec.europa.eu/old",
      new Date(NOW - (WINDOW_DAYS + 2) * 86_400_000).toISOString()
    );
    const fresh = {
      url: "https://ec.europa.eu/new",
      title: "European Commission publishes guidance on AI Act transparency",
      lead: "Guidance for providers.",
    };
    assert.equal(findCluster(fresh, [stale], NOW), null);
  });

  test("entities alone cannot carry a weak match over the line", () => {
    // Both mention the Commission; they are not the same story.
    const existing = [
      candidate(
        1,
        "European Commission fines a telecoms operator",
        "Competition decision concerning market abuse.",
        "https://ec.europa.eu/a"
      ),
    ];
    const other = {
      url: "https://ec.europa.eu/b",
      title: "European Commission appoints new director for agriculture",
      lead: "A personnel announcement.",
    };
    const m = findCluster(other, existing, NOW);
    assert.equal(m, null, "a shared institution is not a shared story");
  });

  test("entities are extracted in the forms that survive rewriting", () => {
    const e = entities("The IAASB revised ISA 240 after the European Commission responded");
    assert.ok(e.includes("IAASB"));
    assert.ok(e.includes("ISA 240"));
    assert.ok(e.some((x) => x.includes("EUROPEAN COMMISSION")));
  });

  test("the threshold is a real number, not accidentally zero", () => {
    assert.ok(MATCH_THRESHOLD > 0.2 && MATCH_THRESHOLD < 0.9);
  });

  test("the cluster's label prefers the primary source's own words", () => {
    const title = clusterTitle([
      { title: "Coverage of the thing", tier: 2, seenAt: "2026-09-21T08:00:00Z" },
      { title: "The body's own announcement", tier: 1, seenAt: "2026-09-21T09:00:00Z" },
    ]);
    assert.equal(title, "The body's own announcement");
  });

  test("no candidates means a new story, not a crash", () => {
    assert.equal(findCluster({ url: "https://x.eu/a", title: "T", lead: "" }, [], NOW), null);
  });
});

/* ── Gates ──────────────────────────────────────────────────────────────── */

const facts = (over = {}) => ({
  title: "European Commission adopts implementing act on AI Act audit documentation",
  lead: "The requirement applies from 1 January 2027 for regulated entities.",
  jurisdictions: ["EU"],
  tier1Count: 1,
  tier2Count: 2,
  tier3Count: 0,
  sourceCount: 3,
  firstSeenAt: "2026-09-21T09:00:00.000Z",
  publishedAt: "2026-09-21T09:00:00.000Z",
  publishedTitles: [],
  escalated: false,
  ...over,
});

const gate = (gates, id) => gates.find((g) => g.id === id);

describe("relevance gates", () => {
  test("a good story passes everything", () => {
    const gates = runGates(facts(), NOW);
    assert.ok(gatesPassed(gates), JSON.stringify(gates.filter((g) => !g.passed)));
  });

  test("Tier 3 alone fails the tier gate — the rule from decision D1", () => {
    const gates = runGates(facts({ tier1Count: 0, tier2Count: 0, tier3Count: 4 }), NOW);
    const g = gate(gates, "tier_support");
    assert.equal(g.passed, false);
    assert.match(g.detail, /discovery-only/);
    assert.equal(gatesPassed(gates), false);
  });

  test("a human escalation satisfies the tier gate and says so", () => {
    const gates = runGates(
      facts({ tier1Count: 0, tier2Count: 0, tier3Count: 4, escalated: true }),
      NOW
    );
    const g = gate(gates, "tier_support");
    assert.equal(g.passed, true);
    assert.match(g.detail, /escalated by a human/);
  });

  test("off-topic is rejected", () => {
    const gates = runGates(
      facts({ title: "Local football club signs a new striker", lead: "A transfer." }),
      NOW
    );
    assert.equal(gate(gates, "on_topic").passed, false);
  });

  test("a US-only story is out of the European focus", () => {
    const gates = runGates(facts({ jurisdictions: ["US"] }), NOW);
    assert.equal(gate(gates, "jurisdiction").passed, false);
    assert.match(gate(gates, "jurisdiction").detail, /outside the European focus/);
  });

  test("UK is in scope", () => {
    assert.equal(gate(runGates(facts({ jurisdictions: ["UK"] }), NOW), "jurisdiction").passed, true);
  });

  test("marketing is rejected", () => {
    const gates = runGates(
      facts({ title: "Acme is delighted to announce its award-winning audit platform" }),
      NOW
    );
    assert.equal(gate(gates, "not_trivial").passed, false);
  });

  test("speculation is rejected — it cannot be evidenced", () => {
    const gates = runGates(
      facts({ title: "Commission could soon revisit the AI Act, sources say", lead: "Rumours suggest a review." }),
      NOW
    );
    assert.equal(gate(gates, "not_speculation").passed, false);
  });

  test("something STAI already published is rejected", () => {
    const gates = runGates(
      facts({
        publishedTitles: [
          "European Commission adopts implementing act on AI Act audit documentation",
        ],
      }),
      NOW
    );
    assert.equal(gate(gates, "not_covered").passed, false);
  });

  test("stale news is rejected", () => {
    const gates = runGates(facts({ publishedAt: "2026-01-01T00:00:00.000Z" }), NOW);
    assert.equal(gate(gates, "fresh").passed, false);
  });

  test("every gate runs even after one fails", () => {
    // The Inbox shows the full list: "failed on trivial AND jurisdiction" is a
    // different correction from "failed only on trivial".
    const gates = runGates(
      facts({ jurisdictions: ["US"], title: "Acme is delighted to announce a webinar" }),
      NOW
    );
    assert.equal(gates.length, runGates(facts(), NOW).length, "no short-circuit");
    assert.ok(gates.filter((g) => !g.passed).length >= 2);
  });

  test("firstFailure names the gate for the Inbox", () => {
    const gates = runGates(facts({ tier1Count: 0, tier2Count: 0, tier3Count: 1 }), NOW);
    assert.equal(firstFailure(gates).id, "tier_support");
    assert.equal(firstFailure(runGates(facts(), NOW)), null);
  });
});

describe("ranking", () => {
  test("a primary source outranks coverage of it", () => {
    const primary = scoreStory(facts({ tier1Count: 2, tier2Count: 0, sourceCount: 2 }), NOW);
    const coverage = scoreStory(facts({ tier1Count: 0, tier2Count: 2, sourceCount: 2 }), NOW);
    assert.ok(primary.score > coverage.score);
    assert.ok(primary.reasons.some((r) => /primary source/.test(r)));
  });

  test("a deadline lifts a story, because that is the editorial test", () => {
    const withDate = scoreStory(facts(), NOW);
    const without = scoreStory(facts({ lead: "General commentary with no dates." }), NOW);
    assert.ok(withDate.score > without.score);
  });

  test("recency matters but is not a cliff", () => {
    const today = scoreStory(facts(), NOW);
    const lastWeek = scoreStory(facts({ publishedAt: "2026-09-14T09:00:00.000Z" }), NOW);
    assert.ok(today.score > lastWeek.score);
    assert.ok(lastWeek.score > 0, "a week-old regulatory development still counts");
  });

  test("the score stays inside 0-100", () => {
    const huge = scoreStory(
      facts({ tier1Count: 50, tier2Count: 50, sourceCount: 200, jurisdictions: ["EU", "NL", "UK"] }),
      NOW
    );
    assert.ok(huge.score <= 100 && huge.score >= 0);
  });
});

describe("the daily cap", () => {
  const cands = (n) =>
    Array.from({ length: n }, (_, i) => ({ storyId: i + 1, score: 90 - i, gates: [], reasons: [] }));

  test("the top N are selected and the rest are ranked, not discarded", () => {
    const sel = applyCap(cands(20), 8);
    assert.equal(sel.filter((s) => s.selected).length, 8);
    assert.equal(sel.length, 20, "the near-misses must stay visible");
    assert.match(sel[8].reason, /outside today's cap/);
    assert.match(sel[0].reason, /within today's cap/);
  });

  test("a quiet day yields fewer candidates, not filler", () => {
    const sel = applyCap(cands(3), 8);
    assert.equal(sel.filter((s) => s.selected).length, 3);
  });

  test("a cap of zero selects nothing", () => {
    assert.equal(applyCap(cands(10), 0).filter((s) => s.selected).length, 0);
  });

  test("ties break deterministically — a re-run cannot change the answer", () => {
    const tied = [
      { storyId: 5, score: 50, gates: [], reasons: [] },
      { storyId: 2, score: 50, gates: [], reasons: [] },
      { storyId: 9, score: 50, gates: [], reasons: [] },
    ];
    const a = applyCap(tied, 2).map((s) => s.storyId);
    const b = applyCap([...tied].reverse(), 2).map((s) => s.storyId);
    assert.deepEqual(a, b);
    assert.deepEqual(a, [2, 5, 9]);
  });
});

/* ── The permission gate on retrieval ───────────────────────────────────── */

const source = (over = {}) => ({
  active: true,
  fetch_allowed: true,
  ingestion_method: "rss",
  fetch_frequency: 30,
  last_attempt_at: null,
  ...over,
});

describe("what may be fetched", () => {
  test("an inactive source is never fetched", () => {
    const d = shouldFetch(source({ active: false }), NOW);
    assert.equal(d.due, false);
    assert.equal(d.outcome, "skipped_inactive");
  });

  test("a source without retrieval permission is never fetched", () => {
    const d = shouldFetch(source({ fetch_allowed: false }), NOW);
    assert.equal(d.due, false);
    assert.equal(d.outcome, "skipped_not_permitted");
  });

  test("force skips the cadence and NOT the permission", () => {
    // The manual "run now" button must not be a way around consent.
    assert.equal(shouldFetch(source({ fetch_allowed: false }), NOW, true).outcome, "skipped_not_permitted");
    assert.equal(shouldFetch(source({ active: false }), NOW, true).outcome, "skipped_inactive");
    // But it does bypass "not due".
    const recent = source({ last_attempt_at: new Date(NOW - 60_000).toISOString() });
    assert.equal(shouldFetch(recent, NOW).due, false);
    assert.equal(shouldFetch(recent, NOW, true).due, true);
  });

  test("cadence is respected", () => {
    const justNow = source({ last_attempt_at: new Date(NOW - 5 * 60_000).toISOString() });
    const d = shouldFetch(justNow, NOW);
    assert.equal(d.due, false);
    assert.equal(d.outcome, "skipped_not_due");

    const old = source({ last_attempt_at: new Date(NOW - 45 * 60_000).toISOString() });
    assert.equal(shouldFetch(old, NOW).due, true);
  });

  test("manual sources are never fetched", () => {
    assert.equal(shouldFetch(source({ ingestion_method: "manual" }), NOW).outcome, "skipped_manual");
  });

  test("html_scrape reports unsupported rather than falling back to a generic scraper", () => {
    // A generic extractor would fill the Inbox with navigation links and look
    // like it was working.
    const d = shouldFetch(source({ ingestion_method: "html_scrape" }), NOW);
    assert.equal(d.due, false);
    assert.equal(d.outcome, "skipped_unsupported");
    assert.match(d.reason, /no generic scraper/);
  });

  test("a skip is never counted as a failure", () => {
    for (const o of SKIP_OUTCOMES) {
      assert.ok(!FAILURE_OUTCOMES.includes(o), `${o} is a skip, not a failure`);
    }
  });
});

/* ── Run identity ───────────────────────────────────────────────────────── */

describe("idempotency", () => {
  test("two firings in the same hour are the same run", () => {
    const a = idempotencyKey("discovery", new Date("2026-09-21T09:00:10Z"));
    const b = idempotencyKey("discovery", new Date("2026-09-21T09:59:50Z"));
    assert.equal(a, b);
  });

  test("the next hour is a different run", () => {
    assert.notEqual(
      idempotencyKey("discovery", new Date("2026-09-21T09:30:00Z")),
      idempotencyKey("discovery", new Date("2026-09-21T10:30:00Z"))
    );
  });

  test("the cap's day is UTC, so it does not move with the reviewer", () => {
    assert.equal(dayKey(new Date("2026-09-21T23:30:00Z")), "2026-09-21");
  });
});
