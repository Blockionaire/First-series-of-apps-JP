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
import fs from "node:fs";
import path from "node:path";

import { parseFeed, parseFeedDate, plainText, decodeEntities } from "../src/lib/newsroom/feed.ts";
import {
  canonicalUrl,
  contentFingerprint,
  inferJurisdictions,
  sha256Hex,
} from "../src/lib/newsroom/normalise.ts";
import {
  MATCH_THRESHOLD,
  buildCandidates,
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
import { probeFeed, detectFormat } from "../src/lib/newsroom/probe.ts";
import { feedUrlBelongsTo } from "../src/lib/newsroom/sources.ts";
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

describe("clustering does not run away — the EBA case", () => {
  /**
   * Found in the first production run, with the EBA as the only active source.
   *
   * Nine items from one feed collapsed into a single story, and the card then
   * showed one item's headline beside a different item's publication date. Two
   * distinct causes, both reproduced here.
   */
  const ALERT = (day, month) => ({
    url: `https://www.eba.europa.eu/eba-e-mail-alert-${day}-${month}-2026`,
    title: `EBA e-mail alert ${day} ${month}, 2026`,
    lead: "The EBA publishes its regular e-mail alert for subscribers.",
    publishedAt: `2026-${month === "September" ? "09" : "08"}-${String(day).padStart(2, "0")}T09:30:00.000Z`,
  });

  /**
   * Mirrors what the orchestrator does: feed items in, grow clusters.
   *
   * Deliberately rebuilds candidates through the REAL `buildCandidates` on
   * every item, including its ordering contract, rather than maintaining its
   * own cluster shape. A harness that constructs candidates by hand tests the
   * harness: the union-of-members bug lived in exactly that fold, so a harness
   * that did not use it could not see the bug.
   */
  function cluster(items, now) {
    const stories = [];
    const members = [];

    for (const it of items) {
      // Oldest first per story, as the orchestrator's ORDER BY delivers them.
      const ordered = [...members].sort((a, b) =>
        (a.published_at ?? a.retrieved_at).localeCompare(b.published_at ?? b.retrieved_at)
      );
      const match = findCluster(it, buildCandidates(stories, ordered), now);

      const storyId = match?.storyId ?? stories.length + 1;
      if (!match) {
        stories.push({
          id: storyId,
          canonical_title: it.title,
          last_seen_at: new Date(now).toISOString(),
        });
      }
      members.push({
        story_id: storyId,
        canonical_url: it.url,
        title: it.title,
        lead: it.lead,
        published_at: it.publishedAt,
        retrieved_at: new Date(now).toISOString(),
      });
    }

    return stories.map((s) => ({
      storyId: s.id,
      members: members.filter((m) => m.story_id === s.id),
    }));
  }

  test("a weekly boilerplate alert is a separate story each week", () => {
    // These differ only by the date in the title. They are five separate
    // mailings, not one development reported five times.
    const weekly = [
      ALERT(18, "September"),
      ALERT(11, "September"),
      ALERT(4, "September"),
      ALERT(28, "August"),
      ALERT(5, "August"),
    ];
    const out = cluster(weekly, NOW);
    assert.equal(
      out.length,
      weekly.length,
      `expected ${weekly.length} stories, got ${out.length} — boilerplate titles merged`
    );
  });

  test("a cluster does not become an attractor as it grows", () => {
    // The structural failure: similarity was measured against the UNION of
    // every member's text, so the more a cluster absorbed the better it
    // matched the next thing, and one cluster swallowed the feed.
    const items = [
      ALERT(18, "September"),
      ALERT(11, "September"),
      ALERT(4, "September"),
      {
        url: "https://www.eba.europa.eu/dora-rts",
        title: "EBA publishes final draft technical standards on DORA incident reporting",
        lead: "The European Banking Authority published final draft regulatory technical standards today.",
        publishedAt: "2026-09-20T09:00:00.000Z",
      },
      {
        url: "https://www.eba.europa.eu/ict-consultation",
        title: "EBA consults on guidelines for ICT risk management",
        lead: "The European Banking Authority launched a consultation on ICT risk management guidelines.",
        publishedAt: "2026-09-19T09:00:00.000Z",
      },
    ];
    const out = cluster(items, NOW);
    const biggest = Math.max(...out.map((c) => c.members.length));
    assert.equal(biggest, 1, `one cluster absorbed ${biggest} unrelated items`);
  });

  test("genuine coverage of one development still clusters", () => {
    // The fix must not break the thing clustering is FOR.
    const items = [
      {
        url: "https://ec.europa.eu/ip-26-1234",
        title: "European Commission adopts implementing act on AI Act audit documentation",
        lead: "The requirement applies from 1 January 2027 for regulated entities across the European Union.",
        publishedAt: "2026-09-21T09:00:00.000Z",
      },
      {
        url: "https://reuters.com/eu-aiact-audit",
        title: "EU adopts AI Act audit documentation rules",
        lead: "The European Commission adopted an implementing act on AI Act audit documentation, applying from 1 January 2027 for regulated entities.",
        publishedAt: "2026-09-21T14:00:00.000Z",
      },
    ];
    const out = cluster(items, NOW);
    assert.equal(out.length, 1, "a regulator's announcement and the coverage of it are one story");
    assert.equal(out[0].members.length, 2);
  });

  test("items published days apart are not the same development", () => {
    // Even near-identical text. One development happens once; coverage of it
    // lands within a few days, not a fortnight later.
    const a = {
      url: "https://www.eba.europa.eu/a",
      title: "EBA publishes guidelines on ICT risk management",
      lead: "Guidelines for ICT risk management in financial institutions.",
      publishedAt: "2026-09-20T09:00:00.000Z",
    };
    const b = {
      ...a,
      url: "https://www.eba.europa.eu/b",
      publishedAt: "2026-08-20T09:00:00.000Z",
    };
    const out = cluster([a, b], NOW);
    assert.equal(out.length, 2, "a month apart is not one development");
  });

  /* ── The union, isolated ──────────────────────────────────────────────
   * The two causes are separable, and the proximity guard alone would hide
   * this one: everything below is published inside the three-day window, so
   * only the representative rule can keep these apart.
   */
  const STORY = [{ id: 1, canonical_title: "EBA DORA standards", last_seen_at: "2026-09-21T09:00:00.000Z" }];
  const TWO_MEMBERS = [
    {
      story_id: 1,
      canonical_url: "https://www.eba.europa.eu/dora-rts",
      title: "EBA publishes final draft technical standards on DORA incident reporting",
      lead: "The European Banking Authority published final draft regulatory technical standards.",
      published_at: "2026-09-20T09:00:00.000Z",
      retrieved_at: "2026-09-20T10:00:00.000Z",
    },
    {
      // A member that does not belong — however it got here, the cluster must
      // not start matching on its vocabulary.
      story_id: 1,
      canonical_url: "https://www.esma.europa.eu/sustainability-templates",
      title: "ESMA consults on sustainability disclosure templates for asset managers",
      lead: "The consultation covers sustainability disclosure templates used by asset managers.",
      published_at: "2026-09-21T09:00:00.000Z",
      retrieved_at: "2026-09-21T10:00:00.000Z",
    },
  ];

  test("a cluster's text is its first member's, not every member's", () => {
    const [c] = buildCandidates(STORY, TWO_MEMBERS);
    assert.ok(c.tokens.includes("dora"), "keeps the representative's own terms");
    assert.ok(
      !c.tokens.includes("sustainability"),
      "a later member's vocabulary leaked into the cluster's text"
    );
    assert.deepEqual(c.urls.length, 2, "but every member's URL is still matchable");
    assert.equal(c.publishedAt, "2026-09-20T09:00:00.000Z", "the representative's date");
  });

  test("a cluster does not match on a member it should never have absorbed", () => {
    const [c] = buildCandidates(STORY, TWO_MEMBERS);
    const incoming = {
      url: "https://www.esma.europa.eu/sustainability-templates-funds",
      title: "ESMA consults on sustainability disclosure templates for investment funds",
      lead: "The consultation covers sustainability disclosure templates used by investment funds.",
      publishedAt: "2026-09-21T11:00:00.000Z",
    };
    assert.equal(
      findCluster(incoming, [c], NOW),
      null,
      "matched the second member's text — the cluster is acting as an attractor"
    );
  });
});

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

  /* The second half of the first production run's confusion. A card headed
   * "EBA e-mail alert 18 September" was rejected as "published 47 days ago",
   * because the freshness gate was handed the OLDEST member's date while the
   * title came from a different member. A living story is as recent as its
   * newest development, not its first. */
  test("a story is as fresh as its newest development, not its first", () => {
    const gates = runGates(
      facts({
        publishedAt: "2026-08-05T09:30:00.000Z", // 47 days back — the first report
        latestPublishedAt: "2026-09-17T09:00:00.000Z", // 4 days back — the follow-up
      }),
      NOW
    );
    assert.equal(gate(gates, "fresh").passed, true, gate(gates, "fresh").detail);
  });

  test("a story whose newest member is also old is still rejected", () => {
    // The fix must not become a way for anything with a long tail to pass.
    const gates = runGates(
      facts({
        publishedAt: "2026-01-01T00:00:00.000Z",
        latestPublishedAt: "2026-06-01T12:00:00.000Z",
      }),
      NOW
    );
    assert.equal(gate(gates, "fresh").passed, false);
    assert.match(gate(gates, "fresh").detail, /112 days ago/);
  });

  test("the rejection reason quotes the date it actually judged", () => {
    // The card said "47 days" next to a headline dated three days earlier, and
    // there was no way to tell from the Inbox which date had been used.
    const gates = runGates(
      facts({ publishedAt: "2026-08-05T09:30:00.000Z", latestPublishedAt: null }),
      NOW
    );
    assert.equal(gate(gates, "fresh").passed, false);
    assert.match(gate(gates, "fresh").detail, /47 days ago/);
    assert.match(gate(gates, "fresh").detail, /2026-08-05/, "names the judged date");
  });

  test("ranking recency follows the newest development too", () => {
    const stale = scoreStory(facts({ publishedAt: "2026-09-01T09:00:00.000Z" }), NOW);
    const revived = scoreStory(
      facts({
        publishedAt: "2026-09-01T09:00:00.000Z",
        latestPublishedAt: "2026-09-21T09:00:00.000Z",
      }),
      NOW
    );
    assert.ok(revived.score > stale.score, "a story that moved today ranks above one that did not");
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
  test("two firings in the same hour are two runs", () => {
    // Overlap is the lease's job; the key identifies one invocation. An
    // hourly key let a retry re-arm, and overwrite, a failed run (M2).
    const at = new Date("2026-09-21T09:00:10Z");
    assert.notEqual(idempotencyKey("discovery", at), idempotencyKey("discovery", at));
  });

  test("the key names the workflow and the moment, so it reads in the Inbox", () => {
    assert.equal(idempotencyKey("discovery", new Date("2026-09-21T09:30:00Z"), "ab12cd34"), "discovery:2026-09-21T09:30:00.000Z:ab12cd34");
  });

  test("the cap's day is UTC, so it does not move with the reviewer", () => {
    assert.equal(dayKey(new Date("2026-09-21T23:30:00Z")), "2026-09-21");
  });
});

/* ── The feed tester (phase 2.5) ────────────────────────────────────────── */

describe("probing a candidate feed", () => {
  /** A stub server in one function. `init` may set status, headers and body. */
  const serve = (init) => async (url) => {
    const { status = 200, headers = {}, body = "", finalUrl = url } = init(url) ?? {};
    const res = new Response(status === 204 || status === 304 ? null : body, {
      status,
      headers: { "content-type": "application/rss+xml", ...headers },
    });
    // Response.url is read-only and empty on a constructed Response; the
    // redirect case is the whole reason finalUrl is reported, so it has to be
    // settable here.
    Object.defineProperty(res, "url", { value: finalUrl });
    return res;
  };

  const FEED = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item><title>EFRAG issues draft ESRS guidance</title><link>https://efrag.org/a</link>
      <pubDate>Mon, 21 Sep 2026 09:00:00 GMT</pubDate></item>
    <item><title>Second</title><link>https://efrag.org/b</link>
      <pubDate>Fri, 18 Sep 2026 09:00:00 GMT</pubDate></item>
    <item><title>Third</title><link>https://efrag.org/c</link>
      <pubDate>Wed, 16 Sep 2026 09:00:00 GMT</pubDate></item>
    <item><title>Fourth</title><link>https://efrag.org/d</link></item>
  </channel></rss>`;

  test("a working feed is described, not ingested", async () => {
    const p = await probeFeed("https://efrag.org/rss", { fetch: serve(() => ({ body: FEED })) });
    assert.equal(p.ok, true);
    assert.equal(p.httpStatus, 200);
    assert.equal(p.format, "rss");
    assert.equal(p.itemCount, 4);
    // The NEWEST date across the items, not the first item's.
    assert.equal(p.latestPublishedAt, "2026-09-21T09:00:00.000Z");
    assert.equal(p.sampleTitles.length, 3, "three titles, enough to recognise the feed");
    assert.match(p.sampleTitles[0], /EFRAG/);
    assert.equal(p.itemsWithoutDate, 1, "the undated item is counted, not hidden");
    assert.equal(p.error, "");
  });

  test("an HTML landing page is named as one, whatever the header says", async () => {
    // The commonest real failure in this registry: the feed moved and the
    // server answers 200 with a page, still labelled application/xml.
    const p = await probeFeed("https://efrag.org/rss", {
      fetch: serve(() => ({ body: "<!doctype html><html><body>Not found</body></html>" })),
    });
    assert.equal(p.ok, false);
    assert.equal(p.httpStatus, 200, "the request succeeded — that is the trap");
    assert.equal(p.format, "html");
    assert.match(p.error, /HTML page/);
  });

  test("a redirect is reported with where it ended up", async () => {
    const p = await probeFeed("https://efrag.org/rss", {
      fetch: serve(() => ({ body: FEED, finalUrl: "https://efrag.org/news/feed.xml" })),
    });
    assert.equal(p.redirected, true);
    assert.equal(p.finalUrl, "https://efrag.org/news/feed.xml");
  });

  test("the same URL back is not called a redirect", async () => {
    const p = await probeFeed("https://efrag.org/rss", { fetch: serve(() => ({ body: FEED })) });
    assert.equal(p.redirected, false);
  });

  test("an HTTP error keeps its status and reports no items", async () => {
    const p = await probeFeed("https://efrag.org/rss", {
      fetch: serve(() => ({ status: 404, body: "gone" })),
    });
    assert.equal(p.ok, false);
    assert.equal(p.httpStatus, 404);
    assert.equal(p.itemCount, 0);
    assert.match(p.error, /404/);
  });

  test("a feed that parses to nothing is a failure, and says which", async () => {
    const p = await probeFeed("https://efrag.org/rss", {
      fetch: serve(() => ({ body: `<?xml version="1.0"?><rss><channel></channel></rss>` })),
    });
    assert.equal(p.ok, false, "an empty feed is not worth approving");
    assert.equal(p.httpStatus, 200);
    assert.match(p.error, /no items/);
  });

  test("a network failure is a result, never a throw", async () => {
    const p = await probeFeed("https://efrag.org/rss", {
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    assert.equal(p.ok, false);
    assert.equal(p.httpStatus, null);
    assert.match(p.error, /ECONNREFUSED/);
  });

  test("the probe never sends conditional headers", async () => {
    // A 304 is the right answer to a polling crawler and useless to a person
    // asking what is at an address.
    let sent = {};
    await probeFeed("https://efrag.org/rss", {
      fetch: async (_u, init) => {
        sent = init.headers;
        return new Response(FEED, { status: 200, headers: { "content-type": "text/xml" } });
      },
    });
    assert.equal(sent["if-none-match"], undefined);
    assert.equal(sent["if-modified-since"], undefined);
    assert.match(sent["user-agent"], /STAI-Newsroom/, "still identifies itself honestly");
  });

  test("format detection reads the body, not the content type", () => {
    assert.equal(detectFormat("<!doctype html><html>", "application/xml"), "html");
    assert.equal(detectFormat('{"items":[]}', "text/html"), "json");
    assert.equal(detectFormat('<?xml version="1.0"?><feed xmlns="...">', ""), "atom");
    assert.equal(detectFormat('<?xml version="1.0"?><rss version="2.0">', ""), "rss");
    assert.equal(detectFormat("", ""), "unknown");
  });
});

describe("Test source on a two-phase extractor", () => {
  // The operator's question about APAS is "does this URL serve publications",
  // and for a source whose titles and dates live one page deeper, the only
  // answer worth giving is one that opened some of those pages. A probe that
  // stopped at the index would report zero items for a working source.

  const read = (name) =>
    fs.readFileSync(path.join(import.meta.dirname, `fixtures/${name}`), "utf8");

  // The registered surface, confirmed live: 200, and twenty APAS links.
  const APAS_INDEX =
    "https://www.apasbafa.bund.de/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html";

  /** The index, plus the publication pages behind it. */
  const apasSite = () => {
    const pages = {
      "/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html": read("apas-verlautbarungen.html"),
      "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html": read("apas-vb-26.html"),
      "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_25.html": read("apas-vb-25.html"),
      "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_24.html": read("apas-vb-24.html"),
      "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_22.html": read("apas-vb-22.html"),
    };
    const asked = [];
    const fn = async (url) => {
      asked.push(url);
      const key = new URL(url).pathname.replace(/;jsessionid=[^/;?]*/gi, "");
      const body = pages[key];
      return new Response(body ?? "not found", {
        status: body ? 200 : 404,
        statusText: body ? "OK" : "Not Found",
        headers: { "content-type": "text/html" },
      });
    };
    fn.asked = asked;
    return fn;
  };

  test("it reports usable · html_extractor · N items with real headlines", async () => {
    const fetchFn = apasSite();
    const p = await probeFeed(APAS_INDEX, {
      fetch: fetchFn,
      hint: "html_scrape",
      domain: "apasbafa.bund.de",
    });

    assert.equal(p.ok, true, p.error);
    assert.equal(p.format, "html_extractor");
    assert.match(p.extractor, /APAS/);
    assert.ok(p.itemCount > 0, "a working source reported no items");
    // The point of the sample: an operator recognises the source from these.
    assert.ok(
      p.sampleTitles.some((t) => /Verlautbarung Nr\. \d+/.test(t)),
      `expected real headlines, got ${JSON.stringify(p.sampleTitles)}`
    );
    assert.ok(p.latestPublishedAt, "no dates came back");
    assert.equal(p.itemsWithoutDate, 0, "an item without a date should never be emitted");
  });

  test("it says how many pages it opened against how many were listed", async () => {
    // Otherwise "3 items" reads as a smaller source than it is, and the
    // operator approving retrieval cannot tell a sample from the whole thing.
    const p = await probeFeed(APAS_INDEX, {
      fetch: apasSite(),
      hint: "html_scrape",
      domain: "apasbafa.bund.de",
    });
    assert.equal(p.detailsListed, 5);
    assert.ok(p.detailsFetched > 0 && p.detailsFetched <= p.detailsListed);
  });

  test("a test opens fewer pages than a retrieval would", async () => {
    // A diagnostic an admin may fire a hundred times an hour must not pull a
    // government site's entire publication series each time.
    const fetchFn = apasSite();
    await probeFeed(APAS_INDEX, {
      fetch: fetchFn,
      hint: "html_scrape",
      domain: "apasbafa.bund.de",
    });
    assert.ok(
      fetchFn.asked.length <= 7,
      `a probe made ${fetchFn.asked.length} requests: ${fetchFn.asked.join(", ")}`
    );
  });

  test("it never requests anything outside the APAS mandant", async () => {
    const fetchFn = apasSite();
    await probeFeed(APAS_INDEX, {
      fetch: fetchFn,
      hint: "html_scrape",
      domain: "apasbafa.bund.de",
    });
    for (const url of fetchFn.asked) {
      assert.match(url, /^https:\/\/www\.apasbafa\.bund\.de\//, url);
      assert.ok(!url.includes("/BAFA/"), `the probe requested BAFA content: ${url}`);
    }
  });

  test("an index whose pages all fail is reported as a failure, not as empty", async () => {
    const indexOnly = async (url) =>
      new URL(url).pathname.endsWith("kurzmeldungen_node.html")
        ? new Response(read("apas-verlautbarungen.html"), {
            status: 200,
            headers: { "content-type": "text/html" },
          })
        : new Response("", { status: 500, statusText: "Server Error" });

    const p = await probeFeed(APAS_INDEX, {
      fetch: indexOnly,
      hint: "html_scrape",
      domain: "apasbafa.bund.de",
    });
    assert.equal(p.ok, false);
    assert.ok(p.error, "a broken template must produce an error, not a quiet zero");
    assert.equal(p.detailsListed, 5, "the count of what was listed survives the failure");
  });
});

describe("the feed tester cannot be aimed off-domain", () => {
  /* This is the containment, so it is tested as such rather than as
   * validation. Everything below is a URL an admin could type into the box. */
  test("a URL on the registered domain is allowed", () => {
    assert.equal(feedUrlBelongsTo("https://www.efrag.org/news/rss", "efrag.org"), true);
    assert.equal(feedUrlBelongsTo("https://efrag.org/rss", "www.efrag.org"), true);
    assert.equal(feedUrlBelongsTo("https://feeds.efrag.org/x", "efrag.org"), true, "subdomains");
  });

  test("another origin is refused", () => {
    assert.equal(feedUrlBelongsTo("https://evil.example.com/x", "efrag.org"), false);
    // The near-miss that a naive endsWith check would wave through.
    assert.equal(feedUrlBelongsTo("https://notefrag.org/x", "efrag.org"), false);
    assert.equal(feedUrlBelongsTo("https://efrag.org.evil.com/x", "efrag.org"), false);
  });

  test("internal and metadata addresses are refused", () => {
    assert.equal(feedUrlBelongsTo("http://169.254.169.254/latest/meta-data/", "efrag.org"), false);
    assert.equal(feedUrlBelongsTo("https://127.0.0.1/admin", "efrag.org"), false);
    assert.equal(feedUrlBelongsTo("https://localhost/", "efrag.org"), false);
  });

  test("non-https schemes are refused", () => {
    assert.equal(feedUrlBelongsTo("http://efrag.org/rss", "efrag.org"), false, "plain http");
    assert.equal(feedUrlBelongsTo("file:///etc/passwd", "efrag.org"), false);
    assert.equal(feedUrlBelongsTo("javascript:alert(1)", "efrag.org"), false);
    assert.equal(feedUrlBelongsTo("not a url", "efrag.org"), false);
  });

  test("an empty domain never matches anything", () => {
    assert.equal(feedUrlBelongsTo("https://anything.com/x", ""), false);
  });
});
