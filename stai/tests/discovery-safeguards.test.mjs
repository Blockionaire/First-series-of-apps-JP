/**
 * What one discovery run is allowed to spend, and what it may never do.
 *
 * Workers Paid allows far more than discovery needs — 1,000 D1 queries,
 * 10,000 subrequests and minutes of CPU per invocation. The run is held to
 * much less on purpose, by limits an operator can see and change:
 *
 *   · a maximum number of sources per run (least recently attempted first);
 *   · a maximum number of publication pages opened behind indexes;
 *   · a time budget after which nothing new is started;
 *   · no retries inside a run;
 *   · one run at a time;
 *   · and discovery ships switched off.
 *
 * Each is exercised against the real `runDiscovery` / `hydrate` and a real
 * migrated database.
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

let registerSqlDriver, MIGRATIONS, runDiscovery, DiscoveryBusyError, hydrate, isEnabled, TOGGLES;
before(async () => {
  ({ registerSqlDriver } = await import("../src/lib/sql.ts"));
  ({ MIGRATIONS } = await import("../src/lib/schema/sql.generated.ts"));
  ({ runDiscovery, DiscoveryBusyError } = await import("../src/lib/newsroom/discovery.ts"));
  ({ hydrate } = await import("../src/lib/newsroom/extractors/hydrate.ts"));
  ({ isEnabled, TOGGLES } = await import("../src/lib/site-config.ts"));
});

function freshDb() {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) d.exec(m.sql);
  registerSqlDriver(() => ({
    async all(q, p = []) { return d.prepare(q).all(...p); },
    async first(q, p = []) { return d.prepare(q).get(...p) ?? null; },
    async run(q, p = []) {
      const i = d.prepare(q).run(...p);
      return { changes: i.changes, lastRowId: Number(i.lastInsertRowid) };
    },
    async batch(statements) {
      return d.transaction(() =>
        statements.map((s) => {
          const i = d.prepare(s.sql).run(...(s.params ?? []));
          return { changes: i.changes, lastRowId: Number(i.lastInsertRowid) };
        })
      )();
    },
  }));
  return d;
}

function addSources(d, n) {
  const insert = d.prepare(`INSERT INTO newsroom_sources
    (name, domain, source_type, authority_tier, jurisdictions, topics, ingestion_method, feed_url,
     fetch_frequency, fetch_allowed, license_notes, snapshot_retention, active)
    VALUES (?, ?, 'regulator', 1, '["EU"]', '[]', 'rss', ?, 30, 1, '', 'indefinite', 1)`);
  for (let s = 0; s < n; s++) insert.run(`Source ${s}`, `src${s}.example`, `https://src${s}.example/feed.xml`);
}

const setLimit = (d, key, value) =>
  d.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, String(value));

/** A one-item feed per host, recording every request made. */
function recordingFetch({ delayMs = 0, status = 200, gate = null } = {}) {
  const asked = [];
  const fn = async (url) => {
    asked.push(url);
    if (gate) await gate;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (status !== 200) return new Response("no", { status });
    const host = new URL(url).host;
    return new Response(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><item><title>Notice from ${host} on audit oversight</title><link>https://${host}/n/1</link><pubDate>${new Date(Date.now() - 3600e3).toUTCString()}</pubDate><description>${host} ${host.length} audit guidance update</description></item></channel></rss>`,
      { status: 200, headers: { "content-type": "application/rss+xml" } }
    );
  };
  fn.asked = asked;
  return fn;
}

const outcomes = (d, runId) =>
  d.prepare("SELECT s.name, f.outcome, f.error FROM newsroom_fetch_log f JOIN newsroom_sources s ON s.id = f.source_id WHERE f.run_id = ? ORDER BY f.id").all(runId);

describe("discovery ships switched off", () => {
  test("the scheduled switch defaults to off on a fresh database", async () => {
    freshDb();
    assert.equal(TOGGLES.find((t) => t.id === "discovery")?.on, false, "the shipped default is off");
    assert.equal(await isEnabled("discovery"), false, "and with no row it reads as off");
  });
});

describe("maximum sources per run", () => {
  test("takes the limit, logs the rest as held back, and rotates next run", async () => {
    const d = freshDb();
    addSources(d, 8);
    setLimit(d, "newsroom.max_sources_per_run", 3);

    const first = recordingFetch();
    const r1 = await runDiscovery({ fetch: first, force: true });
    assert.equal(first.asked.length, 3, "three sources fetched");
    const held = outcomes(d, r1.runId).filter((o) => o.outcome === "skipped_budget");
    assert.equal(held.length, 5, "the other five are recorded, not silently dropped");
    assert.match(held[0].error, /run limit of 3 sources reached — still due/);
    assert.equal(
      d.prepare("SELECT COUNT(*) n FROM newsroom_sources WHERE last_attempt_at IS NULL").get().n,
      5,
      "held-back sources are untouched — still due, health unchanged"
    );

    // The next run takes the least recently attempted: the five never tried.
    const second = recordingFetch();
    await runDiscovery({ fetch: second, force: true, now: Date.now() + 3600e3 });
    const firstHosts = new Set(first.asked.map((u) => new URL(u).host));
    assert.equal(second.asked.length, 3);
    for (const u of second.asked) assert.ok(!firstHosts.has(new URL(u).host), `${u} was fetched twice before others had a turn`);
  });
});

describe("time budget per run", () => {
  test("stops starting sources once the budget is spent, and still finishes the run", async () => {
    const d = freshDb();
    addSources(d, 6);
    const slow = recordingFetch({ delayMs: 40 });
    const r = await runDiscovery({ fetch: slow, force: true, runBudgetMs: 60 });
    assert.ok(slow.asked.length < 6, `fetched ${slow.asked.length} of 6 despite the budget`);
    assert.ok(slow.asked.length >= 1, "the budget still lets the run start");
    const held = outcomes(d, r.runId).filter((o) => o.outcome === "skipped_budget");
    assert.equal(held.length, 6 - slow.asked.length);
    assert.match(held[0].error, /run time budget .* reached — still due/);
    assert.equal(d.prepare("SELECT status FROM newsroom_pipeline_runs WHERE id=?").get(r.runId).status, "succeeded");
  });
});

describe("detail-page budget", () => {
  // A two-phase extractor with five publication pages behind its index.
  const extractor = {
    domain: "example.org",
    name: "Example",
    accepts: () => true,
    indexUrls: [],
    extract: () => ({ ok: true, items: [], rejected: [] }),
    detail: (_html, url) => ({ ok: true, item: { url, title: `Publication at ${url}`, lead: "", publishedAt: "2026-09-20T00:00:00.000Z" } }),
  };
  const index = {
    ok: true,
    items: [],
    rejected: [],
    pending: [1, 2, 3, 4, 5].map((i) => ({ url: `https://example.org/p/${i}` })),
  };
  const pages = () => {
    const asked = [];
    const fn = async (url) => {
      asked.push(url);
      return new Response("<html></html>", { status: 200 });
    };
    fn.asked = asked;
    return fn;
  };

  test("without a run budget, the extractor's own cap applies as before", async () => {
    const f = pages();
    const { fetched, result } = await hydrate(extractor, index, { fetch: f });
    assert.equal(fetched, 5);
    assert.ok(!result.rejected.some((r) => /run budget/.test(r)), "no budget note when no budget bit");
  });

  test("the run's remaining allowance lowers the cap, and says so", async () => {
    const f = pages();
    const { fetched, result } = await hydrate(extractor, index, { fetch: f, budget: 2 });
    assert.equal(fetched, 2);
    assert.equal(f.asked.length, 2);
    assert.ok(result.rejected.some((r) => /^3 publication pages not opened this run — run budget reached/.test(r)));
  });

  test("a budget never RAISES an extractor's own cap", async () => {
    const f = pages();
    const { fetched } = await hydrate({ ...extractor, detailLimit: 2 }, index, { fetch: f, budget: 100 });
    assert.equal(fetched, 2);
  });

  test("past the run's deadline, no page is opened", async () => {
    const f = pages();
    const { fetched, result } = await hydrate(extractor, index, { fetch: f, deadline: Date.now() - 1 });
    assert.equal(fetched, 0);
    assert.equal(f.asked.length, 0);
    assert.ok(result.rejected.some((r) => /^5 publication pages not opened this run/.test(r)));
  });
});

describe("no retries inside a run", () => {
  test("a failing source is asked exactly once, and the run moves on", async () => {
    const d = freshDb();
    addSources(d, 3);
    const failing = recordingFetch({ status: 503 });
    const r = await runDiscovery({ fetch: failing, force: true });
    assert.equal(failing.asked.length, 3, "one request per source, none repeated");
    assert.deepEqual(outcomes(d, r.runId).map((o) => o.outcome), ["http_error", "http_error", "http_error"]);
  });

  test("a network error is asked exactly once too", async () => {
    const d = freshDb();
    addSources(d, 2);
    const asked = [];
    const throwing = async (url) => {
      asked.push(url);
      throw new TypeError("fetch failed");
    };
    await runDiscovery({ fetch: throwing, force: true });
    assert.equal(asked.length, 2);
  });

  test("a failing publication page is asked exactly once", async () => {
    const asked = [];
    const failing = async (url) => {
      asked.push(url);
      return new Response("", { status: 500 });
    };
    const extractor = {
      domain: "example.org", name: "Example", accepts: () => true, indexUrls: [],
      extract: () => ({ ok: true, items: [], rejected: [] }),
      detail: () => ({ ok: false, error: "unreachable" }),
    };
    await hydrate(extractor, { ok: true, items: [], rejected: [], pending: [{ url: "https://example.org/a" }, { url: "https://example.org/b" }] }, { fetch: failing });
    assert.deepEqual(asked, ["https://example.org/a", "https://example.org/b"]);
  });
});

describe("one run at a time", () => {
  test("a second run while one is in progress is refused and touches nothing", async () => {
    const d = freshDb();
    addSources(d, 2);
    let release;
    const gate = new Promise((r) => (release = r));
    const held = recordingFetch({ gate });
    const first = runDiscovery({ fetch: held, force: true });
    // Wait until the first run is inside its fetch, holding the lease.
    while (held.asked.length === 0) await new Promise((r) => setImmediate(r));

    const logBefore = d.prepare("SELECT COUNT(*) n FROM newsroom_fetch_log").get().n;
    const second = recordingFetch();
    await assert.rejects(runDiscovery({ fetch: second, force: true }), DiscoveryBusyError);
    assert.equal(second.asked.length, 0, "the refused run fetched nothing");
    assert.equal(d.prepare("SELECT COUNT(*) n FROM newsroom_fetch_log").get().n, logBefore, "and logged nothing");

    release();
    const r = await first;
    assert.equal(d.prepare("SELECT status FROM newsroom_pipeline_runs WHERE id=?").get(r.runId).status, "succeeded");

    // The lease is released with the run.
    const third = await runDiscovery({ fetch: recordingFetch(), force: true, now: Date.now() + 3600e3 });
    assert.ok(third.runId > 0);
  });

  test("a run that died without finishing stops blocking once its lease is stale", async () => {
    const d = freshDb();
    addSources(d, 1);
    d.prepare(
      `INSERT INTO newsroom_pipeline_runs (workflow, idempotency_key, status, started_at)
       VALUES ('discovery', 'discovery:dead', 'running', ?)`
    ).run(new Date(Date.now() - 2 * 3600e3).toISOString());

    const r = await runDiscovery({ fetch: recordingFetch(), force: true });
    assert.ok(r.runId > 0, "the new run proceeded");
    const dead = d.prepare("SELECT status, error FROM newsroom_pipeline_runs WHERE idempotency_key='discovery:dead'").get();
    assert.equal(dead.status, "failed");
    assert.match(dead.error, /abandoned/);
  });

  test("a recent run still in progress is NOT treated as stale", async () => {
    const d = freshDb();
    addSources(d, 1);
    d.prepare(
      `INSERT INTO newsroom_pipeline_runs (workflow, idempotency_key, status, started_at)
       VALUES ('discovery', 'discovery:live', 'running', ?)`
    ).run(new Date(Date.now() - 60_000).toISOString());
    await assert.rejects(runDiscovery({ fetch: recordingFetch(), force: true }), DiscoveryBusyError);
    assert.equal(d.prepare("SELECT status FROM newsroom_pipeline_runs WHERE idempotency_key='discovery:live'").get().status, "running");
  });
});
