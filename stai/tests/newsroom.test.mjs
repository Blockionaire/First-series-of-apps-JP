/**
 * Intelligence Engine, phase 1.
 *
 * These import the REAL modules — Node 22 strips the types — rather than
 * restating their logic. A test that reimplements the rule it checks passes
 * while production is broken, which is the failure mode this whole platform's
 * test suite is built to avoid.
 *
 * What is actually being defended here, in order of how much it would cost to
 * get wrong:
 *
 *   1. The Tier-3 gate. A discovery-only story must never reach generation.
 *      If this erodes, STAI publishes regulatory analysis sourced from Reddit.
 *   2. The primary-source rule for regulatory content. No override exists and
 *      none may be added.
 *   3. The budget arithmetic. A wrong division here is a real invoice.
 *   4. The state machine's absent edges. What it REFUSES is the design.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  AUTOPUBLISH_ENABLED,
  FAILURE_STATES,
  IN_FLIGHT_STATES,
  STORY_STATES,
  canTransition,
  isStoryState,
  mayAutoPublish,
  mayEnterResearch,
  mayReachReview,
  nextStates,
  transition,
} from "../src/lib/newsroom/state.ts";

import {
  GLOBAL,
  JURISDICTIONS,
  parseJurisdictions,
  serialiseJurisdictions,
  validateJurisdictions,
} from "../src/lib/newsroom/jurisdictions.ts";

import {
  MONTHLY_CAP_CENTS,
  STAGE_CEILINGS,
  STORY_CEILING_CENTS,
  callCostCents,
  dailyCapCents,
  maySpend,
  researchCapToday,
  workingDaysLeftInMonth,
} from "../src/lib/newsroom/budget.ts";

import {
  DEFAULT_FREQUENCY,
  DEFAULT_RETENTION,
  sourceHealth,
  validateSource,
} from "../src/lib/newsroom/sources.ts";

import {
  PROPOSED_SOURCES,
  proposedAsSourceCreates,
} from "../src/lib/newsroom/proposed-sources.ts";

// ─── The gate that matters most ───────────────────────────────────────────

describe("Tier 3 may discover, never generate", () => {
  test("a cluster with only Tier-3 sources cannot enter research", () => {
    const verdict = mayEnterResearch({ tier1: 0, tier2: 0 });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /discovery-only/);
  });

  test("one Tier-2 source is enough to open the gate", () => {
    assert.equal(mayEnterResearch({ tier1: 0, tier2: 1 }).ok, true);
  });

  test("one Tier-1 source is enough on its own", () => {
    assert.equal(mayEnterResearch({ tier1: 1, tier2: 0 }).ok, true);
  });

  test("the gate counts sources, not opinions — zero is zero however many Tier 3s there are", () => {
    // The shape of the input is the point: the function is not given a Tier-3
    // count at all, so no quantity of discovery sources can be argued into
    // satisfying it.
    assert.equal(mayEnterResearch({ tier1: 0, tier2: 0 }).ok, false);
  });
});

describe("regulatory content needs a primary source", () => {
  for (const riskClass of ["HIGH", "CRITICAL"]) {
    test(`${riskClass} with no primary source cannot reach review`, () => {
      const v = mayReachReview({ riskClass, primarySourceCount: 0 });
      assert.equal(v.ok, false);
      assert.match(v.reason, /primary source/);
    });

    test(`${riskClass} with a primary source may`, () => {
      assert.equal(mayReachReview({ riskClass, primarySourceCount: 1 }).ok, true);
    });
  }

  test("LOW and MEDIUM are not blocked by the primary-source rule", () => {
    assert.equal(mayReachReview({ riskClass: "LOW", primarySourceCount: 0 }).ok, true);
    assert.equal(mayReachReview({ riskClass: "MEDIUM", primarySourceCount: 0 }).ok, true);
  });

  test("the rule takes no override argument", () => {
    // If someone adds one, this fails. The masterplan says the rule is relaxed
    // in code review, in the open — not behind an admin checkbox.
    assert.equal(mayReachReview.length, 1, "mayReachReview must take exactly one argument object");
    const src = mayReachReview.toString();
    assert.ok(!/override|force|bypass|skip/i.test(src), "no bypass may exist in the gate");
  });
});

describe("nothing publishes itself in v1", () => {
  test("autopublish is off", () => {
    assert.equal(AUTOPUBLISH_ENABLED, false);
  });

  test("every risk class is refused while it is off — including LOW", () => {
    for (const risk of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
      assert.equal(mayAutoPublish(risk), false, `${risk} must not auto-publish`);
    }
  });
});

// ─── The state machine, and what it refuses ───────────────────────────────

describe("state machine", () => {
  test("every state can be reached from DISCOVERED, except the ones that cannot", () => {
    // A breadth-first walk. Anything unreachable is either a deliberate
    // orphan or a typo in the transition table, and there should be none of
    // the second kind.
    const seen = new Set(["DISCOVERED"]);
    const queue = ["DISCOVERED"];
    while (queue.length) {
      const s = queue.shift();
      for (const next of nextStates(s)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    const unreachable = STORY_STATES.filter((s) => !seen.has(s));
    assert.deepEqual(unreachable, [], `unreachable states: ${unreachable.join(", ")}`);
  });

  test("nothing may be written without evidence", () => {
    assert.equal(canTransition("DISCOVERED", "DRAFTING"), false);
    assert.equal(canTransition("QUEUED_FOR_RESEARCH", "DRAFTING"), false);
    assert.equal(canTransition("RESEARCHING", "DRAFTING"), false);
    // Only EVIDENCE_READY opens the writer.
    assert.equal(canTransition("EVIDENCE_READY", "DRAFTING"), true);
  });

  test("review cannot be skipped", () => {
    assert.equal(canTransition("NEEDS_REVIEW", "PUBLISHED"), false);
    assert.equal(canTransition("NEEDS_REVIEW", "PUBLISHING"), false);
    assert.equal(canTransition("EDITORIAL_QA", "APPROVED"), false);
    // Approval is its own recorded act.
    assert.equal(canTransition("NEEDS_REVIEW", "APPROVED"), true);
    assert.equal(canTransition("APPROVED", "PUBLISHING"), true);
  });

  test("a failed fact-check cannot be walked around", () => {
    // The engine must never overrule its own verifier. The only ways out are
    // back to research or out of the pipeline.
    assert.deepEqual([...nextStates("FACT_CHECK_FAILED")].sort(), [
      "QUEUED_FOR_RESEARCH",
      "REJECTED",
    ]);
    assert.equal(canTransition("FACT_CHECK_FAILED", "EDITORIAL_QA"), false);
    assert.equal(canTransition("FACT_CHECK_FAILED", "NEEDS_REVIEW"), false);
  });

  test("a published story stays reachable, because regulation arrives in stages", () => {
    assert.equal(canTransition("PUBLISHED", "LIVE"), true);
    assert.equal(canTransition("LIVE", "UPDATE_PROPOSED"), true);
    // An amendment goes through the same review as an original.
    assert.equal(canTransition("UPDATE_PROPOSED", "NEEDS_REVIEW"), true);
    assert.equal(canTransition("UPDATE_PROPOSED", "PUBLISHED"), false);
  });

  test("transition() reports rather than throws, so a retried step is not a crash", () => {
    const already = transition("NEEDS_REVIEW", "NEEDS_REVIEW");
    assert.equal(already.ok, false);
    assert.match(already.error, /Already in/);

    const illegal = transition("DISCOVERED", "PUBLISHED");
    assert.equal(illegal.ok, false);
    assert.match(illegal.error, /Cannot move/);

    const unknown = transition("DISCOVERED", "SOMETHING_ELSE");
    assert.equal(unknown.ok, false);
    assert.match(unknown.error, /Unknown target/);
  });

  test("every failure state is a real state, and every in-flight state is too", () => {
    for (const s of [...FAILURE_STATES, ...IN_FLIGHT_STATES]) {
      assert.ok(isStoryState(s), `${s} is listed but is not a state`);
    }
  });

  test("no state is both in-flight and a resting failure", () => {
    const overlap = IN_FLIGHT_STATES.filter((s) => FAILURE_STATES.includes(s));
    assert.deepEqual(overlap, [], "a failed story is not in flight — it is waiting for a human");
  });
});

// ─── Jurisdiction ─────────────────────────────────────────────────────────

describe("jurisdiction tagging", () => {
  test("multi-value is normal: EU and NL together is valid", () => {
    const v = validateJurisdictions(["EU", "NL"]);
    assert.equal(v.ok, true);
    assert.deepEqual(v.codes, ["EU", "NL"]);
  });

  test("GLOBAL is exclusive", () => {
    const v = validateJurisdictions([GLOBAL, "NL"]);
    assert.equal(v.ok, false);
    assert.match(v.error, /GLOBAL/);
  });

  test("GLOBAL alone is fine", () => {
    assert.equal(validateJurisdictions([GLOBAL]).ok, true);
  });

  test("an unknown code is rejected, not dropped", () => {
    // Dropping it would leave a piece tagged EU when someone meant EU and
    // somewhere else — a quiet wrong answer rather than a loud one.
    const v = validateJurisdictions(["EU", "ATLANTIS"]);
    assert.equal(v.ok, false);
    assert.match(v.error, /ATLANTIS/);
  });

  test("an empty tag set is rejected — every article carries one", () => {
    assert.equal(validateJurisdictions([]).ok, false);
    assert.equal(validateJurisdictions("").ok, false);
  });

  test("order and duplication carry no meaning and are normalised", () => {
    const a = validateJurisdictions(["NL", "EU", "NL"]);
    const b = validateJurisdictions(["EU", "NL"]);
    assert.deepEqual(a.codes, b.codes, "two spellings of the same tag set must render identically");
  });

  test("case and whitespace are forgiven; meaning is not", () => {
    const v = validateJurisdictions([" eu ", "uk"]);
    assert.equal(v.ok, true);
    assert.deepEqual(v.codes, ["UK", "EU"].sort(
      (x, y) => JURISDICTIONS.findIndex((j) => j.code === x) - JURISDICTIONS.findIndex((j) => j.code === y)
    ));
  });

  test("UK is in scope, because it has its own regulator and a lot of the audience", () => {
    const uk = JURISDICTIONS.find((j) => j.code === "UK");
    assert.ok(uk);
    assert.equal(uk.inScope, true);
  });

  test("US and APAC exist but are out of editorial scope", () => {
    for (const code of ["US", "APAC"]) {
      const j = JURISDICTIONS.find((x) => x.code === code);
      assert.ok(j, `${code} should be taggable`);
      assert.equal(j.inScope, false, `${code} is taggable, not targeted`);
    }
  });

  test("a round trip through storage preserves the tags", () => {
    const codes = validateJurisdictions(["EU", "NL"]).codes;
    assert.deepEqual(parseJurisdictions(serialiseJurisdictions(codes)), codes);
  });

  test("a corrupt stored value degrades to untagged rather than throwing", () => {
    // Mirrors jsonArray() in lib/content.ts: one bad row must not take down
    // the page rendering it.
    assert.deepEqual(parseJurisdictions("not json"), []);
    assert.deepEqual(parseJurisdictions('{"not":"an array"}'), []);
    assert.deepEqual(parseJurisdictions(null), []);
    assert.deepEqual(parseJurisdictions('["EU","ATLANTIS"]'), ["EU"]);
  });
});

// ─── Budget ───────────────────────────────────────────────────────────────

describe("budget", () => {
  test("the ceiling is the €75 the operator set", () => {
    assert.equal(MONTHLY_CAP_CENTS, 7500);
  });

  test("the daily share divides by working days, not calendar days", () => {
    // 7500 / 22 = 340 cents. Dividing by 30 would give 250, which the engine
    // would underspend five days a week and then breach on the sixth.
    assert.equal(dailyCapCents(), Math.floor(7500 / 22));
  });

  test("a story cannot cost more than its stages allow, together", () => {
    const sum = Object.values(STAGE_CEILINGS).reduce((a, b) => a + b, 0);
    assert.equal(STORY_CEILING_CENTS, sum);
  });

  test("with budget to spare, the configured cap is what runs", () => {
    const r = researchCapToday({ configuredCap: 8, monthSpentCents: 0, workingDaysLeft: 22 });
    assert.equal(r.cap, 8);
    assert.match(r.reason, /within budget/);
  });

  test("running ahead throttles the story count — it does not stop the desk", () => {
    // Most of the month's money gone with half the month left.
    const r = researchCapToday({ configuredCap: 8, monthSpentCents: 7000, workingDaysLeft: 11 });
    assert.ok(r.cap < 8, "the cap must come down");
    assert.ok(r.cap >= 0);
    assert.match(r.reason, /throttled|cannot cover/);
  });

  test("an exhausted month researches nothing rather than overspending", () => {
    const r = researchCapToday({ configuredCap: 8, monthSpentCents: 7500, workingDaysLeft: 5 });
    assert.equal(r.cap, 0);
    assert.match(r.reason, /exhausted/);
  });

  test("the throttle never returns a negative cap", () => {
    const r = researchCapToday({ configuredCap: 8, monthSpentCents: 9999, workingDaysLeft: 3 });
    assert.equal(r.cap, 0);
  });

  test("the monthly cap is checked before the call, not after", () => {
    const v = maySpend({
      stage: "research",
      estimateCents: 100,
      storySpentCents: 0,
      stageSpentCents: 0,
      monthSpentCents: 7450,
    });
    assert.equal(v.allowed, false);
    assert.match(v.reason, /monthly cap/);
  });

  test("a stage that loops is stopped by its own ceiling", () => {
    // The realistic failure: a retry loop, not one enormous call.
    const v = maySpend({
      stage: "editorial",
      estimateCents: 5,
      storySpentCents: 20,
      stageSpentCents: STAGE_CEILINGS.editorial,
      monthSpentCents: 0,
    });
    assert.equal(v.allowed, false);
    assert.match(v.reason, /editorial ceiling/);
  });

  test("a story cannot quietly exceed its total by spreading across stages", () => {
    const v = maySpend({
      stage: "writing",
      estimateCents: 10,
      storySpentCents: STORY_CEILING_CENTS,
      stageSpentCents: 0,
      monthSpentCents: 0,
    });
    assert.equal(v.allowed, false);
    assert.match(v.reason, /story ceiling/);
  });

  test("an ordinary call is allowed", () => {
    assert.equal(
      maySpend({
        stage: "research",
        estimateCents: 12,
        storySpentCents: 3,
        stageSpentCents: 3,
        monthSpentCents: 1000,
      }).allowed,
      true
    );
  });

  test("cost arithmetic: a known case", () => {
    // 100k input at $2/M and 10k output at $10/M = $0.20 + $0.10 = $0.30.
    const c = callCostCents({
      inputTokens: 100_000,
      outputTokens: 10_000,
      inputPerMillion: 2,
      outputPerMillion: 10,
    });
    assert.equal(c, 30);
  });

  test("caching is the lever it is claimed to be", () => {
    const uncached = callCostCents({
      inputTokens: 100_000,
      outputTokens: 1_000,
      inputPerMillion: 5,
      outputPerMillion: 25,
    });
    const cached = callCostCents({
      inputTokens: 100_000,
      cachedInputTokens: 90_000,
      outputTokens: 1_000,
      inputPerMillion: 5,
      outputPerMillion: 25,
    });
    assert.ok(cached < uncached, "a cached prefix must cost less");
    // 90% of the input at a tenth: the input portion drops to ~19% of itself.
    assert.ok(cached < uncached * 0.6, `expected a large saving, got ${cached} vs ${uncached}`);
  });

  test("batch submission halves the bill", () => {
    const args = { inputTokens: 1_000_000, outputTokens: 0, inputPerMillion: 1, outputPerMillion: 5 };
    assert.equal(callCostCents({ ...args, batch: true }) * 2, callCostCents(args));
  });

  test("cost rounds up, so the ledger never drifts under the real spend", () => {
    const c = callCostCents({
      inputTokens: 1,
      outputTokens: 0,
      inputPerMillion: 1,
      outputPerMillion: 1,
    });
    assert.equal(c, 1, "a fraction of a cent still counts as a cent");
  });

  test("working days left is between 1 and 23", () => {
    const n = workingDaysLeftInMonth(new Date(Date.UTC(2026, 8, 21)));
    assert.ok(n >= 1 && n <= 23, `got ${n}`);
    // 21 September 2026 is a Monday; the month ends on Wednesday the 30th.
    assert.equal(n, 8);
  });

  test("the last day of a month still allows a day of work", () => {
    // 30 September 2026 is a Wednesday.
    assert.equal(workingDaysLeftInMonth(new Date(Date.UTC(2026, 8, 30))), 1);
  });
});

// ─── Source registry ──────────────────────────────────────────────────────

describe("source validation", () => {
  const base = {
    name: "Example Regulator",
    domain: "example.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["regulation"],
    ingestion_method: "rss",
    feed_url: "https://example.eu/feed.xml",
  };

  test("a well-formed source passes", () => {
    const v = validateSource(base);
    assert.equal(v.ok, true);
    assert.equal(v.value.fetch_allowed, false, "permission is never assumed");
  });

  test("a feed on another host is refused", () => {
    // This is what stops a Tier-1 row laundering a blog's claims.
    const v = validateSource({ ...base, feed_url: "https://someblog.example.com/feed" });
    assert.equal(v.ok, false);
    assert.match(v.error, /does not belong/);
  });

  test("a subdomain of the registered domain is fine", () => {
    assert.equal(validateSource({ ...base, feed_url: "https://export.example.eu/f" }).ok, true);
  });

  test("http is refused — everything is fetched over TLS", () => {
    const v = validateSource({ ...base, feed_url: "http://example.eu/feed.xml" });
    assert.equal(v.ok, false);
    assert.match(v.error, /https/);
  });

  test("a bad tier is rejected, not clamped", () => {
    const v = validateSource({ ...base, authority_tier: 4 });
    assert.equal(v.ok, false);
    assert.match(v.error, /Tier/);
  });

  test("an unknown jurisdiction is rejected", () => {
    assert.equal(validateSource({ ...base, jurisdictions: ["ATLANTIS"] }).ok, false);
  });

  test("a source with no jurisdiction is rejected", () => {
    assert.equal(validateSource({ ...base, jurisdictions: [] }).ok, false);
  });

  test("manual sources need no feed URL — they exist for hand entry", () => {
    const v = validateSource({ ...base, ingestion_method: "manual", feed_url: "" });
    assert.equal(v.ok, true);
  });

  test("tier decides the default cadence and retention", () => {
    for (const tier of [1, 2, 3]) {
      const v = validateSource({ ...base, authority_tier: tier });
      assert.equal(v.value.fetch_frequency, DEFAULT_FREQUENCY[tier]);
      assert.equal(v.value.snapshot_retention, DEFAULT_RETENTION[tier]);
    }
  });

  test("only Tier 1 keeps a copy indefinitely", () => {
    // Copyright, not storage: a news article's full body kept forever to
    // support three extracted sentences is not defensible.
    assert.equal(DEFAULT_RETENTION[1], "indefinite");
    assert.notEqual(DEFAULT_RETENTION[2], "indefinite");
    assert.notEqual(DEFAULT_RETENTION[3], "indefinite");
  });
});

describe("source health — the silent failure", () => {
  const ok = {
    active: true,
    fetch_allowed: true,
    fetch_frequency: 30,
    last_success_at: null,
    consecutive_failures: 0,
  };
  const now = Date.parse("2026-09-21T12:00:00.000Z");

  test("a feed that has stopped producing is caught even though nothing errored", () => {
    // The failure worth catching: a redesigned site returns 200 and an empty
    // list forever. No error, no alert, and a Tier-1 regulator quietly drops
    // out of coverage.
    const h = sourceHealth(
      { ...ok, last_success_at: "2026-09-21T09:00:00.000Z" },
      now
    );
    assert.equal(h.state, "silent", "3 hours with a 30-minute cadence is silence");
  });

  test("a quiet regulator inside the window is not flagged", () => {
    const h = sourceHealth({ ...ok, last_success_at: "2026-09-21T11:00:00.000Z" }, now);
    assert.equal(h.state, "ok");
  });

  test("repeated failures outrank silence", () => {
    const h = sourceHealth({ ...ok, consecutive_failures: 4, last_success_at: "2026-09-21T11:59:00.000Z" }, now);
    assert.equal(h.state, "failing");
  });

  test("a source we may not fetch says so first of all", () => {
    const h = sourceHealth({ ...ok, fetch_allowed: false, consecutive_failures: 9 }, now);
    assert.equal(h.state, "blocked", "permission is reported before mechanics");
  });

  test("never fetched is its own state, not a false alarm", () => {
    assert.equal(sourceHealth(ok, now).state, "never_fetched");
  });

  test("an unparseable timestamp does not read as healthy", () => {
    const h = sourceHealth({ ...ok, last_success_at: "not a date" }, now);
    assert.notEqual(h.state, "ok");
  });
});

describe("the proposed source list", () => {
  const proposed = proposedAsSourceCreates();

  test("is between 40 and 60 sources, as asked", () => {
    assert.ok(
      proposed.length >= 40 && proposed.length <= 60,
      `expected 40–60 sources, got ${proposed.length}`
    );
  });

  test("every entry passes the registry's own validation", () => {
    // Not trusted because it shipped in the repo. A malformed entry must fail
    // here rather than sit in the registry looking approved.
    const bad = [];
    for (const p of proposed) {
      const v = validateSource(p);
      if (!v.ok) bad.push(`${p.name}: ${v.error}`);
    }
    assert.deepEqual(bad, [], `invalid proposed sources:\n  ${bad.join("\n  ")}`);
  });

  test("nothing is proposed as active or as retrievable", () => {
    for (const p of proposed) {
      assert.equal(p.fetch_allowed, false, `${p.name} must not assume permission`);
      assert.ok(!("active" in p), `${p.name} must not carry an active flag at all`);
    }
  });

  test("no domain appears twice — one publication, one tier", () => {
    const domains = proposed.map((p) => p.domain);
    const dupes = domains.filter((d, i) => domains.indexOf(d) !== i);
    assert.deepEqual([...new Set(dupes)], []);
  });

  test("weighted towards primary sources, because that is the binding constraint", () => {
    const tier1 = proposed.filter((p) => p.authority_tier === 1).length;
    assert.ok(tier1 >= proposed.length / 3, `only ${tier1} of ${proposed.length} are Tier 1`);
  });

  test("European-first: most sources speak for Europe or globally", () => {
    const european = proposed.filter((p) =>
      p.jurisdictions.some((j) => ["EU", "EEA", "GLOBAL", "NL", "BE", "DE", "FR", "UK", "IE"].includes(j))
    );
    assert.equal(european.length, proposed.length, "every source should be Europe-relevant");
  });

  test("the UK is actually covered, not just declared in scope", () => {
    const uk = proposed.filter((p) => p.jurisdictions.includes("UK"));
    assert.ok(uk.length >= 3, `only ${uk.length} UK sources`);
  });

  test("the Dutch home market is covered", () => {
    const nl = proposed.filter((p) => p.jurisdictions.includes("NL"));
    assert.ok(nl.length >= 2, `only ${nl.length} NL sources`);
  });

  test("every source carries a rationale a reviewer can read", () => {
    for (const p of PROPOSED_SOURCES) {
      assert.ok(p.rationale && p.rationale.length > 20, `${p.name} needs a real rationale`);
    }
  });

  test("anything that forbids scraping is marked manual", () => {
    // LinkedIn's terms forbid automated retrieval. A row that says so in a
    // note but still carries a scrape method would be a note nobody enforces.
    const linkedin = PROPOSED_SOURCES.find((p) => p.domain === "linkedin.com");
    assert.ok(linkedin);
    assert.equal(linkedin.ingestion_method, "manual");
  });
});
