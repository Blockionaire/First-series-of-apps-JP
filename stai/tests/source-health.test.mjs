/**
 * Source health: the derived status, its reasons, and the cost of computing it.
 *
 * The rules are exercised directly through `assessSource` (pure, fixed clock);
 * the loader through `sourceHealthBoard` against a real migrated database,
 * counting the queries it makes as the registry grows.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import Database from "better-sqlite3";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try {
          return await next(specifier, context);
        } catch (e) {
          if (e?.code === "ERR_MODULE_NOT_FOUND" && /^\\.{1,2}\\//.test(specifier)) {
            return next(specifier + ".ts", context);
          }
          throw e;
        }
      }
    `)
);

let H, registerSqlDriver, MIGRATIONS, sourceHealthBoard, HEALTH_HISTORY;
before(async () => {
  H = await import("../src/lib/newsroom/source-health.ts");
  ({ registerSqlDriver } = await import("../src/lib/sql.ts"));
  ({ MIGRATIONS } = await import("../src/lib/schema/sql.generated.ts"));
  ({ sourceHealthBoard, HEALTH_HISTORY } = await import("../src/lib/newsroom/store.ts"));
});

const NOW = Date.parse("2026-09-24T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86_400_000).toISOString();
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();
const ok = (n = 20, h = 1) => ({ outcome: "ok", at: hoursAgo(h), itemsFound: n, httpStatus: 200 });

/** Reviewed, on, permitted, fetched an hour ago, confirmed last week. */
const healthy = (over = {}) => ({
  tier: 1,
  active: true,
  fetchAllowed: true,
  reviewStatus: "retrieval_approved",
  reviewedAt: ago(7),
  confirmedAt: null,
  termsCheckedAt: ago(7),
  supported: true,
  fetchFrequency: 30,
  lastAttemptAt: hoursAgo(1),
  lastSuccessAt: hoursAgo(1),
  lastOutcome: "ok",
  lastHttpStatus: 200,
  lastError: "",
  consecutiveFailures: 0,
  attempts: [ok(), ok(), ok(), ok()],
  probes: [],
  items: null,
  ...over,
});
const assess = (over) => H.assessSource(healthy(over), NOW);
const texts = (a) => a.reasons.map((r) => r.text).join(" | ");

describe("classification", () => {
  test("reviewed, on, permitted, fetching, recently confirmed: healthy with no reasons", () => {
    const a = assess({});
    assert.equal(a.status, "healthy");
    assert.equal(a.technical, "working");
    assert.equal(a.legal, "permitted");
    assert.deepEqual(a.reasons, []);
  });

  test("repeated failures are broken, and the reason names the failure", () => {
    const a = assess({ consecutiveFailures: 3, lastOutcome: "http_error", lastHttpStatus: 403 });
    assert.equal(a.status, "broken");
    assert.equal(a.technical, "broken");
    assert.match(texts(a), /3 consecutive fetch failures — HTTP 403/);
  });

  test("a single transient failure is attention, not broken", () => {
    const a = assess({ consecutiveFailures: 1, lastOutcome: "timeout" });
    assert.equal(a.status, "attention");
    assert.equal(a.technical, "degraded");
    assert.match(texts(a), /1 recent fetch failure — Timeout/);
  });

  test("the last error is named in plain words", () => {
    assert.match(texts(assess({ consecutiveFailures: 4, lastOutcome: "off_domain_redirect" })), /Off-domain redirect/);
    assert.match(texts(assess({ consecutiveFailures: 4, lastOutcome: "parse_error", lastError: "no <item>" })), /Parse error: no <item>/);
  });

  test("an unreviewed source is unreviewed — and says what a test found", () => {
    const a = assess({
      reviewStatus: "unreviewed",
      reviewedAt: null,
      active: false,
      fetchAllowed: false,
      supported: false,
      probes: [{ ok: false, at: ago(1), httpStatus: 200, format: "html", finalUrl: "", itemCount: 0, error: "served an HTML page" }],
    });
    assert.equal(a.status, "unreviewed");
    assert.match(texts(a), /No extractor built/);
    assert.match(texts(a), /Last Test source failed: served an HTML page/);
    assert.match(texts(a), /Not yet reviewed/);
  });

  test("an unreviewed source that is on and failing is broken, not merely unreviewed", () => {
    const a = assess({ reviewStatus: "unreviewed", reviewedAt: null, consecutiveFailures: 5, lastOutcome: "http_error", lastHttpStatus: 500 });
    assert.equal(a.status, "broken");
    assert.match(texts(a), /Never reviewed/);
  });

  test("do not use, and switched off after review, are disabled", () => {
    assert.equal(assess({ reviewStatus: "do_not_use", active: false, fetchAllowed: false }).status, "disabled");
    assert.equal(assess({ reviewStatus: "do_not_use" }).legal, "restricted");
    const off = assess({ active: false });
    assert.equal(off.status, "disabled");
    assert.match(texts(off), /Switched off/);
  });

  test("retrieval permission is its own question: technically fine, legally unchecked", () => {
    const a = assess({
      active: true,
      fetchAllowed: false,
      probes: [{ ok: true, at: ago(1), httpStatus: 200, format: "rss", finalUrl: "https://x.eu/rss", itemCount: 30, error: "" }],
    });
    assert.equal(a.technical, "working", "a working feed");
    assert.equal(a.legal, "unchecked", "is still not permitted");
    assert.equal(a.status, "attention");
    assert.match(texts(a), /retrieval permission unchecked/);

    // And the reverse: a working, permitted feed is never "unchecked" because
    // it answered 200 — permission comes only from the switch.
    assert.equal(assess({ fetchAllowed: false, active: false, reviewStatus: "feed_verified" }).legal, "unchecked");
  });

  test("verified but not yet permitted waits on a person", () => {
    const a = assess({ active: false, fetchAllowed: false, reviewStatus: "feed_verified" });
    assert.equal(a.status, "attention");
    assert.match(texts(a), /Feed verified, retrieval permission unchecked/);
  });

  test("a stale human confirmation needs attention, by tier", () => {
    assert.equal(assess({ tier: 1, reviewedAt: ago(89) }).status, "healthy");
    const t1 = assess({ tier: 1, reviewedAt: ago(91) });
    assert.equal(t1.status, "attention");
    assert.equal(t1.confirmationStale, true);
    assert.match(texts(t1), /Human confirmation 3 months ago/);
    assert.equal(assess({ tier: 2, reviewedAt: ago(61) }).status, "attention", "Tier 2 is checked every 60 days");
    assert.equal(assess({ tier: 3, reviewedAt: ago(59) }).status, "healthy");
  });

  test("an explicit confirmation counts over an older review", () => {
    const a = assess({ tier: 1, reviewedAt: ago(200), confirmedAt: ago(3) });
    assert.equal(a.status, "healthy");
    assert.equal(a.lastConfirmedAt, ago(3));
  });

  test("terms checked more than a year ago need renewal", () => {
    const a = assess({ termsCheckedAt: ago(400) });
    assert.equal(a.status, "attention");
    assert.match(texts(a), /Terms last checked 13 months ago/);
  });

  test("marked needs fix is attention", () => {
    assert.match(texts(assess({ reviewStatus: "needs_fix" })), /Marked needs fix/);
  });
});

describe("empty and new sources", () => {
  test("on and permitted but never fetched: waiting, not broken", () => {
    const a = assess({ lastAttemptAt: null, lastSuccessAt: null, lastOutcome: "", attempts: [] });
    assert.equal(a.status, "attention");
    assert.match(texts(a), /Waiting for its first fetch/);
  });

  test("a freshly registered source is unreviewed and untested", () => {
    const a = assess({
      reviewStatus: "unreviewed", reviewedAt: null, active: false, fetchAllowed: false,
      lastAttemptAt: null, lastSuccessAt: null, attempts: [], probes: [], items: null,
    });
    assert.equal(a.status, "unreviewed");
    assert.equal(a.technical, "untested");
    assert.equal(a.legal, "unchecked");
  });

  test("silent for longer than three fetch intervals", () => {
    const a = assess({ lastSuccessAt: ago(14), lastAttemptAt: hoursAgo(1) });
    assert.equal(a.status, "attention");
    assert.match(texts(a), /Last success 14 days ago/);
  });

  test("html_scrape with no extractor, switched on, is broken", () => {
    const a = assess({ supported: false });
    assert.equal(a.status, "broken");
    assert.match(texts(a), /No extractor built/);
  });
});

describe("data quality, only against a baseline", () => {
  test("zero items where there used to be content is broken", () => {
    const a = assess({ attempts: [ok(0, 1), ok(0, 2), ok(0, 3), ok(25, 4), ok(28, 5)] });
    assert.equal(a.status, "broken");
    assert.match(texts(a), /Returned 0 items on the last 3 fetches \(previously up to 28\)/);
  });

  test("zero items with no history is attention, not broken", () => {
    const a = assess({ attempts: [ok(0, 1), ok(0, 2), ok(0, 3)] });
    assert.equal(a.status, "attention");
  });

  test("a 304 lists nothing and is healthy", () => {
    const nm = (h) => ({ outcome: "not_modified", at: hoursAgo(h), itemsFound: 0, httpStatus: 304 });
    assert.equal(assess({ attempts: [nm(1), nm(2), nm(3), ok(25, 4)] }).status, "healthy");
  });

  test("items collapsing from ~30 to 0–2 is flagged", () => {
    const a = assess({ attempts: [ok(1, 1), ok(2, 2), ok(1, 3), ok(30, 4), ok(29, 5), ok(31, 6)] });
    assert.equal(a.status, "attention");
    assert.match(texts(a), /Items per fetch dropped from ~30 to 0–2/);
  });

  test("a naturally small feed is not flagged for being small", () => {
    assert.equal(assess({ attempts: [ok(2, 1), ok(1, 2), ok(2, 3), ok(2, 4), ok(1, 5), ok(2, 6)] }).status, "healthy");
  });

  test("newest item unexpectedly old for this source's rhythm", () => {
    // ~weekly publisher (10 items over ~63 days), newest 60 days ago.
    const a = assess({ items: { latestPublishedAt: ago(60), earliestInYear: ago(123), datedInYear: 10, datedTotal: 10, recent: 0, recentUndated: 0 } });
    assert.equal(a.status, "attention");
    assert.match(texts(a), /Newest item 2 months ago — usually every ~7 days/);
  });

  test("a regulator that publishes twice a quarter is not flagged for being quiet", () => {
    // 6 items across a year (~every 70 days), newest 40 days ago.
    const a = assess({ items: { latestPublishedAt: ago(40), earliestInYear: ago(390), datedInYear: 6, datedTotal: 6, recent: 0, recentUndated: 0 } });
    assert.equal(a.status, "healthy");
    // Too little history to judge at all.
    assert.equal(assess({ items: { latestPublishedAt: ago(200), earliestInYear: ago(300), datedInYear: 2, datedTotal: 2, recent: 0, recentUndated: 0 } }).status, "healthy");
  });

  test("dates disappearing from recent items is flagged", () => {
    const a = assess({ items: { latestPublishedAt: ago(1), earliestInYear: ago(30), datedInYear: 20, datedTotal: 20, recent: 5, recentUndated: 5 } });
    assert.match(texts(a), /Recent items carry no publication date/);
  });

  test("a format or redirect change between two tests is flagged", () => {
    const p = (format, finalUrl, d) => ({ ok: true, at: ago(d), httpStatus: 200, format, finalUrl, itemCount: 20, error: "" });
    const a = assess({ probes: [p("html_extractor", "https://x.eu/news", 1), p("rss", "https://x.eu/rss", 10)] });
    assert.match(texts(a), /Format changed between tests: rss → html_extractor/);
    assert.match(texts(a), /Redirect target changed between tests/);
  });
});

describe("ordering", () => {
  test("the table: broken, attention, unreviewed, healthy, disabled; Tier 1 first within each", () => {
    const rows = [
      { status: "healthy", tier: 1, name: "H" },
      { status: "disabled", tier: 1, name: "D" },
      { status: "broken", tier: 2, name: "B2" },
      { status: "unreviewed", tier: 1, name: "U" },
      { status: "broken", tier: 1, name: "B1" },
      { status: "attention", tier: 3, name: "A3" },
    ];
    assert.deepEqual([...rows].sort(H.compareByStatus).map((r) => r.name), ["B1", "B2", "A3", "U", "H", "D"]);
  });

  test("the attention list: broken by tier, then retrieval, then stale confirmation, then degraded, then unreviewed", () => {
    const row = (name, tier, over) => ({ name, tier, ...H.assessSource(healthy({ tier, ...over }), NOW) });
    const rows = [
      row("unreviewed T1", 1, { reviewStatus: "unreviewed", reviewedAt: null, active: false, fetchAllowed: false }),
      row("degraded T1", 1, { consecutiveFailures: 1, lastOutcome: "timeout" }),
      row("stale T2", 2, { reviewedAt: ago(100) }),
      row("unchecked T3", 3, { fetchAllowed: false }),
      row("broken T2", 2, { consecutiveFailures: 5, lastOutcome: "timeout" }),
      row("broken T1", 1, { consecutiveFailures: 5, lastOutcome: "timeout" }),
      row("healthy T1", 1, {}),
      row("disabled T1", 1, { active: false }),
    ];
    assert.deepEqual(H.attentionQueue(rows).map((r) => r.name), [
      "broken T1", "broken T2", "unchecked T3", "stale T2", "degraded T1", "unreviewed T1",
    ]);
  });
});

describe("relative ages", () => {
  test("today, yesterday, days, months, years", () => {
    assert.equal(H.relativeAge(hoursAgo(2), NOW), "today");
    assert.equal(H.relativeAge(ago(1), NOW), "yesterday");
    assert.equal(H.relativeAge(ago(12), NOW), "12 days ago");
    assert.equal(H.relativeAge(ago(122), NOW), "4 months ago");
    assert.equal(H.relativeAge(ago(800), NOW), "2 years ago");
    assert.equal(H.relativeAge(null, NOW), "never");
  });
});

/* ── The loader: a fixed number of queries, whatever the registry's size ── */

function freshDb() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  const counter = { n: 0 };
  registerSqlDriver(() => ({
    async all(q, p = []) { counter.n++; return d.prepare(q).all(...p); },
    async first(q, p = []) { counter.n++; return d.prepare(q).get(...p) ?? null; },
    async run(q, p = []) { counter.n++; const i = d.prepare(q).run(...p); return { changes: i.changes, lastRowId: Number(i.lastInsertRowid) }; },
    async batch(st) { counter.n++; return d.transaction(() => st.map((s) => { const i = d.prepare(s.sql).run(...(s.params ?? [])); return { changes: i.changes, lastRowId: Number(i.lastInsertRowid) }; }))(); },
  }));
  return { d, counter };
}

function populate(d, n) {
  const src = d.prepare(`INSERT INTO newsroom_sources (name, domain, source_type, authority_tier, jurisdictions, topics,
     ingestion_method, feed_url, fetch_frequency, fetch_allowed, snapshot_retention, active)
     VALUES (?, ?, 'regulator', ?, '["EU"]', '[]', 'rss', ?, 30, 1, 'indefinite', 1)`);
  const log = d.prepare("INSERT INTO newsroom_fetch_log (source_id, outcome, items_found, started_at) VALUES (?, ?, ?, ?)");
  const probe = d.prepare("INSERT INTO newsroom_source_probes (source_id, url, actor, ok, format, item_count, created_at) VALUES (?, 'u', 'a', 1, 'rss', 5, ?)");
  const item = d.prepare("INSERT INTO newsroom_source_items (source_id, url, content_hash, published_at, retrieved_at) VALUES (?, ?, ?, ?, ?)");
  for (let i = 0; i < n; i++) {
    const id = src.run(`Source ${i}`, `s${i}.example`, 1 + (i % 3), `https://s${i}.example/rss`).lastInsertRowid;
    // Oldest first, as a real log fills: ids grow with time.
    for (let k = 19; k >= 0; k--) {
      log.run(id, "skipped_not_due", 0, hoursAgo(k)); // skips are not attempts
      log.run(id, k % 5 === 0 ? "http_error" : "ok", 10 + k, hoursAgo(k));
    }
    probe.run(id, ago(3));
    probe.run(id, ago(2));
    probe.run(id, ago(1));
    for (let k = 0; k < 4; k++) item.run(id, `https://s${i}.example/${k}`, `h${i}-${k}`, ago(k * 7), ago(k));
  }
}

describe("sourceHealthBoard", () => {
  test("costs the same number of queries for 5 sources as for 120", async () => {
    const small = freshDb();
    populate(small.d, 5);
    small.counter.n = 0;
    const a = await sourceHealthBoard(NOW);
    const smallQueries = small.counter.n;

    const large = freshDb();
    populate(large.d, 120);
    large.counter.n = 0;
    const b = await sourceHealthBoard(NOW);

    assert.equal(a.length, 5);
    assert.equal(b.length, 120);
    assert.equal(large.counter.n, smallQueries, "query count must not grow with the number of sources");
    assert.ok(smallQueries <= 4, `${smallQueries} queries`);
  });

  test("history is the last attempts per source, newest first, skips excluded", async () => {
    const { d } = freshDb();
    populate(d, 3);
    const [first] = await sourceHealthBoard(NOW);
    assert.equal(first.attempts.length, HEALTH_HISTORY);
    assert.ok(first.attempts.every((a) => !a.outcome.startsWith("skipped")));
    assert.ok(first.attempts[0].at >= first.attempts[1].at, "newest first");
    assert.equal(first.probes.length, 2, "the latest two tests");
    assert.equal(first.probes[0].at, ago(1));
    assert.equal(first.items.latestPublishedAt, ago(0));
    assert.equal(first.items.datedTotal, 4);
  });

  test("a source with no history at all loads with empty history", async () => {
    const { d } = freshDb();
    d.prepare(`INSERT INTO newsroom_sources (name, domain, source_type, authority_tier, jurisdictions, topics,
       ingestion_method, feed_url, fetch_frequency, snapshot_retention) VALUES ('New', 'new.example', 'news', 2, '["EU"]', '[]', 'rss', 'https://new.example/rss', 60, 'ninety_days')`).run();
    const [row] = await sourceHealthBoard(NOW);
    assert.deepEqual(row.attempts, []);
    assert.deepEqual(row.probes, []);
    assert.equal(row.items, null);
    assert.equal(row.source.confirmed_at, null, "nothing is confirmed by default");
    assert.equal(row.source.terms_checked_at, null);
  });
});
