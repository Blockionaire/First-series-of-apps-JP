/**
 * A discovery run stays at ~9–22 D1 queries, whatever the platform allows.
 *
 * The scheduled run is one invocation. It used to issue about ten queries per
 * new item and three per open story on every run: ten sources with twenty
 * items each took ~2,000 queries, a quiet run ~1,000 (CODE_AUDIT.md, H2).
 * The newsroom is designed for Workers Paid, which allows 1,000 per
 * invocation (STAI is on Workers Free, 50, until it upgrades). The budgets
 * below fit Free and are kept after the upgrade deliberately — a run that
 * suddenly needs fifty times its usual budget is a regression to catch, not
 * headroom to use.
 *
 * This drives the REAL `runDiscovery` against a database built from the real
 * migrations, through a driver that counts every statement — each statement
 * inside a batch counts separately, the conservative reading of the limit —
 * at the workloads the registry can actually produce:
 *
 *   · a quiet run: everything already held, nothing new;
 *   · several sources publishing at once;
 *   · the whole proposed registry (50 fetchable sources) on its first run,
 *     and quiet afterwards with hundreds of open stories.
 *
 * The scheduled invocation spends two more queries before discovery starts
 * (the settings read and analytics retention).
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import Database from "better-sqlite3";

// src/lib modules import siblings without extensions, as Next resolves them.
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

/**
 * D1 queries per invocation on the plan STAI is on today: Workers Free (50).
 * Paid allows 1,000; the budgets below are kept either way.
 */
const PLATFORM_LIMIT = 50;
/**
 * Measured when this was written: quiet 11, ordinary 18–19, the full registry's
 * first run (1,000 items) 20. The budgets leave room for the scheduled
 * handler's own two queries and for honest growth, and fail long before 50.
 */
const BUDGET = {
  quiet: 15,
  ordinary: 25,
  maximum: 30,
};

let registerSqlDriver, MIGRATIONS, runDiscovery;
before(async () => {
  ({ registerSqlDriver } = await import("../src/lib/sql.ts"));
  ({ MIGRATIONS } = await import("../src/lib/schema/sql.generated.ts"));
  ({ runDiscovery } = await import("../src/lib/newsroom/discovery.ts"));
});

/** A fresh database and a driver that counts every statement it executes. */
function countingDb() {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) d.exec(m.sql);
  const counter = { n: 0 };
  registerSqlDriver(() => ({
    async all(q, p = []) { counter.n++; return d.prepare(q).all(...p); },
    async first(q, p = []) { counter.n++; return d.prepare(q).get(...p) ?? null; },
    async run(q, p = []) {
      counter.n++;
      const i = d.prepare(q).run(...p);
      return { changes: i.changes, lastRowId: Number(i.lastInsertRowid) };
    },
    async batch(statements) {
      counter.n += statements.length;
      return d.transaction(() =>
        statements.map((s) => {
          const i = d.prepare(s.sql).run(...(s.params ?? []));
          return { changes: i.changes, lastRowId: Number(i.lastInsertRowid) };
        })
      )();
    },
  }));
  return { d, counter };
}

/** `n` active, retrievable RSS sources across the three tiers. */
function addSources(d, n) {
  const insert = d.prepare(`INSERT INTO newsroom_sources
    (name, domain, source_type, authority_tier, jurisdictions, topics, ingestion_method, feed_url,
     fetch_frequency, fetch_allowed, license_notes, snapshot_retention, active)
    VALUES (?, ?, ?, ?, '["EU"]', '[]', 'rss', ?, 30, 1, '', 'indefinite', 1)`);
  for (let s = 0; s < n; s++) {
    const tier = (s % 3) + 1;
    insert.run(`Source ${s}`, `src${s}.example`, tier === 1 ? "regulator" : "professional_body", tier, `https://src${s}.example/feed.xml`);
  }
  // A registry also holds sources that are off: they cost a log row, not a fetch.
  d.prepare(`INSERT INTO newsroom_sources
    (name, domain, source_type, authority_tier, jurisdictions, topics, ingestion_method, feed_url,
     fetch_frequency, fetch_allowed, license_notes, snapshot_retention, active)
    VALUES ('Dormant', 'dormant.example', 'regulator', 1, '["DE"]', '[]', 'rss', 'https://dormant.example/feed.xml', 30, 0, '', 'indefinite', 0)`).run();
}

/**
 * A feed per source. Each item gets its own vocabulary so items form their
 * own stories, as real news mostly does — the expensive case for the old
 * per-story evaluation, and the realistic one for the budget.
 */
function feeds(items, { generation = 0, base = Date.now() } = {}) {
  const tok = (n) => "zq" + ((n * 2654435761) >>> 0).toString(36).slice(0, 7);
  const words = "audit oversight regulator guidance reporting sustainability assurance standard inspection enforcement".split(" ");
  return async (url) => {
    const host = new URL(url).host;
    const s = Number(host.replace(/\D/g, ""));
    let xml = "";
    for (let i = 0; i < items; i++) {
      const g = generation * 100_000 + s * 1000 + i;
      const w = [tok(g), tok(g + 7), tok(g + 13), words[i % 10]].join(" ");
      const date = new Date(base - (i + 1) * 3_600_000).toUTCString();
      // The lead shares no boilerplate with other items: a shared lead is the
      // clustering defect CODE_AUDIT.md H3 describes (Stage 3), and a budget
      // test must not depend on that defect collapsing everything into one story.
      const lead = [tok(g + 19), tok(g + 23), tok(g + 29), tok(g + 31), words[(i + 3) % 10]].join(" ");
      xml += `<item><title>Update ${g} on ${w}</title><link>https://${host}/n/${generation}/${i}</link><pubDate>${date}</pubDate><description>${lead}</description></item>`;
    }
    return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${xml}</channel></rss>`, {
      status: 200,
      headers: { "content-type": "application/rss+xml" },
    });
  };
}

async function measure(counter, run) {
  counter.n = 0;
  const result = await run();
  return { queries: counter.n, result };
}

function within(queries, budget, label) {
  if (process.env.SHOW_BUDGET) console.log(`[budget] ${label}: ${queries}`);
  assert.ok(
    queries <= budget && queries < PLATFORM_LIMIT,
    `${label}: ${queries} D1 queries — budget ${budget} (platform limit ${PLATFORM_LIMIT})`
  );
}

describe("discovery query budget (~9–22 per run; Workers Paid allows 1,000)", () => {
  test("several sources publishing at once: 10 sources × 20 new items", async () => {
    const { d, counter } = countingDb();
    addSources(d, 10);
    const { queries, result } = await measure(counter, () => runDiscovery({ fetch: feeds(20), force: true }));
    assert.equal(result.itemsIngested, 200, "every item was ingested");
    within(queries, BUDGET.ordinary, "first run, 200 new items");
  });

  test("a quiet run: the same feeds again, nothing new, 200 open stories", async () => {
    const { d, counter } = countingDb();
    addSources(d, 10);
    await runDiscovery({ fetch: feeds(20), force: true });
    const { queries, result } = await measure(counter, () =>
      runDiscovery({ fetch: feeds(20), force: true, now: Date.now() + 31 * 60_000 })
    );
    assert.equal(result.itemsIngested, 0);
    assert.equal(result.evaluated, 200, "every open story was still evaluated");
    within(queries, BUDGET.quiet, "quiet run");
  });

  test("an ordinary run: a few new items on top of what is held", async () => {
    const { d, counter } = countingDb();
    addSources(d, 10);
    await runDiscovery({ fetch: feeds(20), force: true });
    // Two sources publish one new item each; the rest re-serve their feeds.
    const base = feeds(20);
    const fresh = feeds(1, { generation: 1 });
    const mixed = async (url) => (/src[01]\./.test(url) ? mergeFeeds(await base(url), await fresh(url)) : base(url));
    const { queries, result } = await measure(counter, () =>
      runDiscovery({ fetch: mixed, force: true, now: Date.now() + 31 * 60_000 })
    );
    assert.equal(result.itemsIngested, 2);
    within(queries, BUDGET.ordinary, "ordinary run");
  });

  test("the whole proposed registry: 50 sources × 20 items on the first run", async () => {
    const { d, counter } = countingDb();
    addSources(d, 50);
    const { queries, result } = await measure(counter, () => runDiscovery({ fetch: feeds(20), force: true }));
    assert.equal(result.itemsIngested, 1000);
    within(queries, BUDGET.maximum, "first run, 1,000 new items");
  });

  test("the whole proposed registry, quiet, with 300+ open stories", async () => {
    const { d, counter } = countingDb();
    addSources(d, 50);
    await runDiscovery({ fetch: feeds(20), force: true });
    const { queries, result } = await measure(counter, () =>
      runDiscovery({ fetch: feeds(20), force: true, now: Date.now() + 31 * 60_000 })
    );
    assert.equal(result.itemsIngested, 0);
    assert.equal(result.evaluated, 300, "evaluation is still capped at 300 stories");
    within(queries, BUDGET.quiet, "quiet run, full registry");
  });

  test("a run where no source is due costs almost nothing", async () => {
    const { d, counter } = countingDb();
    addSources(d, 50);
    await runDiscovery({ fetch: feeds(20), force: true });
    // Not forced: every source was attempted moments ago and is not due.
    const { queries, result } = await measure(counter, () => runDiscovery({ fetch: feeds(20) }));
    assert.ok(result.sources.every((s) => s.outcome !== "ok"), "nothing was fetched");
    within(queries, BUDGET.quiet, "nothing due");
  });
});

/** Two RSS responses as one channel. */
async function mergeFeeds(a, b) {
  const [x, y] = [await a.text(), await b.text()];
  const items = (s) => s.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return new Response(
    `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${[...items(y), ...items(x)].join("")}</channel></rss>`,
    { status: 200, headers: { "content-type": "application/rss+xml" } }
  );
}
