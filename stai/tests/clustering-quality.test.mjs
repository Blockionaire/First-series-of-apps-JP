/**
 * Clustering quality, measured on labelled items (tests/fixtures/clustering-cases.mjs).
 *
 * Before the house-language fix (CODE_AUDIT.md H3), the same cases gave:
 *   labelled set — 40 false-merge pairs and 3 missed merges; 29 items → 12 stories
 *   EBA ten      — 45 false-merge pairs; ten unrelated publications → 1 story
 *
 * The bounds below are what the current clusterer achieves, set so that a
 * regression shows up as a failure rather than as a slightly worse Inbox.
 *
 * Counts are PAIRS: two items predicted in one story that the labels keep
 * apart (a false merge), or labelled together but predicted apart (missed).
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

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

let replay, ITEMS, EBA_TEN, SOURCES, houseTerms, findCluster, buildCandidates;
before(async () => {
  ({ replay } = await import("./support/cluster-replay.mjs"));
  ({ ITEMS, EBA_TEN, SOURCES } = await import("./fixtures/clustering-cases.mjs"));
  ({ houseTerms, findCluster, buildCandidates } = await import("../src/lib/newsroom/cluster.ts"));
});

const storyOf = (result, items, url) => result.predicted[items.findIndex((i) => i.url === url)];

describe("clustering quality on labelled items", () => {
  test("ten unrelated EBA publications stay ten stories", () => {
    const r = replay(EBA_TEN, SOURCES);
    assert.equal(r.stories, 10, `became ${r.stories} stories:\n${r.falseList.map((p) => p.join("  |  ")).join("\n")}`);
    assert.equal(r.falseMerges, 0);
  });

  test("the labelled set: no missed merges, at most one borderline false merge", () => {
    const r = replay(ITEMS, SOURCES);
    assert.equal(r.missedMerges, 0, `missed:\n${r.missedList.map((p) => p.join("  |  ")).join("\n")}`);
    // The one known borderline: a law-firm post on supervisors collecting DORA
    // registers joins the ESAs' joint guidelines on the DORA register — the
    // same instrument, an adjacent development, and lexically inseparable.
    assert.ok(r.falseMerges <= 2, `${r.falseMerges} false-merge pairs:\n${r.falseList.map((p) => p.join("  |  ")).join("\n")}`);
    for (const [a, b] of r.falseList) {
      assert.ok(/DORA register/.test(a) && /DORA register/.test(b), `unexpected false merge: ${a} | ${b}`);
    }
  });

  test("every EBA and ESMA publication in the set is its own story, bar their joint one", () => {
    const r = replay(ITEMS, SOURCES);
    for (const publisher of ["eba", "esma"]) {
      const own = ITEMS.filter((i) => i.source === publisher && i.story !== "esas-joint");
      const stories = new Set(own.map((i) => storyOf(r, ITEMS, i.url)));
      assert.equal(stories.size, own.length, `${publisher}: ${own.length} publications in ${stories.size} stories`);
    }
  });

  test("coverage joins the announcement it covers", () => {
    const r = replay(ITEMS, SOURCES);
    for (const story of ["eba-ml", "eba-stress", "esma-ai", "isa-240", "frc-ai", "omnibus", "ifrs-18"]) {
      const members = ITEMS.filter((i) => i.story === story);
      const predicted = new Set(members.map((i) => storyOf(r, ITEMS, i.url)));
      assert.equal(predicted.size, 1, `${story}: ${members.length} reports split into ${predicted.size} stories`);
    }
  });

  test("a joint publication by two authorities is one story", () => {
    const r = replay(ITEMS, SOURCES);
    const joint = ITEMS.filter((i) => i.story === "esas-joint");
    assert.equal(storyOf(r, ITEMS, joint[0].url), storyOf(r, ITEMS, joint[1].url));
  });

  test("two authorities' separate acts on one topic are two stories", () => {
    const r = replay(ITEMS, SOURCES);
    const eba = ITEMS.find((i) => i.story === "eba-crypto");
    const esma = ITEMS.find((i) => i.story === "esma-mica");
    assert.notEqual(storyOf(r, ITEMS, eba.url), storyOf(r, ITEMS, esma.url));
  });

  test("two standards approved by one board in one week are two stories", () => {
    const r = replay(ITEMS, SOURCES);
    const a = ITEMS.find((i) => i.story === "isa-240" && i.source === "iaasb");
    const b = ITEMS.find((i) => i.story === "isa-500");
    assert.notEqual(storyOf(r, ITEMS, a.url), storyOf(r, ITEMS, b.url));
  });
});

describe("a story that coverage has joined", () => {
  // Run one: the EBA announces, Accountancy Europe covers it — the story now
  // has two publishers, so the same-publisher rule no longer protects it.
  // Run two: the EBA's next, unrelated announcements arrive. Only the
  // headline and the house-language rules stand between them and that story,
  // because the EBA's boilerplate is in all of them.
  const order = () => {
    const pick = (story, source) => ITEMS.find((i) => i.story === story && i.source === source);
    return [
      pick("eba-ml", "eba"),
      pick("eba-ml", "ae"),
      ...["eba-stress", "eba-crypto", "eba-aml", "eba-mrel", "eba-remuneration", "eba-esg", "eba-irrbb"].map((s) => pick(s, "eba")),
    ];
  };

  test("the publisher's next announcements do not join it", () => {
    const items = order();
    const r = replay(items, SOURCES);
    const covered = r.predicted[0];
    assert.equal(r.predicted[1], covered, "the coverage joined its announcement");
    for (let i = 2; i < items.length; i++) {
      assert.notEqual(r.predicted[i], covered, `"${items[i].title}" joined the covered story: ${r.reasons[i]}`);
    }
    assert.equal(r.falseMerges, 0, r.falseList.map((p) => p.join("  |  ")).join("\n"));
  });
});

describe("house language", () => {
  test("a publisher's boilerplate is recognised from its own feed", () => {
    const house = houseTerms(ITEMS.filter((i) => i.source === "eba"));
    for (const t of ["eba", "european", "banking", "authority", "mandate", "rulebook", "convergence"]) {
      assert.ok(house.has(t), `"${t}" should be EBA house language`);
    }
    for (const t of ["stress", "crypto", "mrel", "irrbb", "learning"]) {
      assert.ok(!house.has(t), `"${t}" is a subject, not house language`);
    }
  });

  test("boilerplate alone cannot join a publisher's item to a story coverage made mixed", () => {
    // Found by probing: without house language, this item joins the risk
    // dashboard story on "EBA" + "report" in the headline and the whole EBA
    // lead — 28% headline overlap plus a shared name. Nothing about colleges
    // is in that story.
    const lead = (w) =>
      `The European Banking Authority (EBA) today published ${w}. As part of its mandate to contribute to a single rulebook in banking, the EBA publishes guidelines, standards and reports to promote convergence of supervisory practices across the European Union.`;
    const [story] = buildCandidates(
      [{ id: 1, canonical_title: "EBA publishes its risk dashboard for the second quarter", last_seen_at: "2026-09-18T10:00:00.000Z" }],
      [
        { story_id: 1, canonical_url: "https://www.eba.europa.eu/rdb-q2", title: "EBA publishes its risk dashboard for the second quarter",
          lead: lead("its risk dashboard for the second quarter"), published_at: "2026-09-17T09:00:00.000Z", retrieved_at: "2026-09-17T10:00:00.000Z", source_id: 1, issuer: true },
        { story_id: 1, canonical_url: "https://www.accountancyeurope.eu/rdb", title: "Bank risk dashboard: what auditors should note",
          lead: "Commentary on the EBA's quarterly figures.", published_at: "2026-09-17T15:00:00.000Z", retrieved_at: "2026-09-17T16:00:00.000Z", source_id: 7, issuer: false },
      ]
    );
    const colleges = {
      url: "https://www.eba.europa.eu/colleges-report",
      title: "EBA publishes its report on the functioning of supervisory colleges",
      lead: lead("its report on the functioning of supervisory colleges"),
      publishedAt: "2026-09-18T09:00:00.000Z",
      sourceId: 1,
      issuer: true,
      boilerplate: houseTerms(ITEMS.filter((i) => i.source === "eba")),
    };
    assert.equal(findCluster(colleges, [story], Date.parse("2026-09-18T12:00:00.000Z")), null);
  });

  test("the publisher's own name is not a shared entity", () => {
    // Found by probing: with "EBA" counted as a shared name, an IRB
    // benchmarking report joins the machine-learning-in-IRB story (44%
    // headline overlap plus "EBA, IRB"). "EBA" says who is speaking; only
    // "IRB" is about something, and one topic word is not one development.
    const lead = (w) =>
      `The European Banking Authority (EBA) today published ${w}. As part of its mandate to contribute to a single rulebook in banking, the EBA publishes guidelines, standards and reports to promote convergence of supervisory practices across the European Union.`;
    const [story] = buildCandidates(
      [{ id: 1, canonical_title: "EBA publishes guidelines on machine learning in IRB models", last_seen_at: "2026-09-18T10:00:00.000Z" }],
      [
        { story_id: 1, canonical_url: "https://www.eba.europa.eu/ml-irb", title: "EBA publishes guidelines on machine learning in IRB models",
          lead: lead("guidelines on machine learning in IRB models"), published_at: "2026-09-17T09:00:00.000Z", retrieved_at: "2026-09-17T10:00:00.000Z", source_id: 1, issuer: true },
        { story_id: 1, canonical_url: "https://www.accountancyeurope.eu/ml-irb", title: "Machine learning in IRB models: EBA guidance for auditors",
          lead: "Commentary on the EBA's work.", published_at: "2026-09-17T15:00:00.000Z", retrieved_at: "2026-09-17T16:00:00.000Z", source_id: 7, issuer: false },
      ]
    );
    const benchmarking = {
      url: "https://www.eba.europa.eu/irb-benchmarking",
      title: "EBA publishes report on IRB models benchmarking",
      lead: lead("report on IRB models benchmarking"),
      publishedAt: "2026-09-18T09:00:00.000Z",
      sourceId: 1,
      issuer: true,
      boilerplate: houseTerms(ITEMS.filter((i) => i.source === "eba")),
    };
    assert.equal(findCluster(benchmarking, [story], Date.parse("2026-09-18T12:00:00.000Z")), null);
  });

  test("a feed too small to tell house style from coincidence yields none", () => {
    assert.equal(houseTerms(ITEMS.filter((i) => i.source === "eba").slice(0, 3)).size, 0);
  });

  test("the reason names the headline, so a human can disagree with it", () => {
    const r = replay(ITEMS, SOURCES);
    const joined = r.reasons.filter((x) => x !== "new story");
    assert.ok(joined.length > 0);
    for (const reason of joined) assert.match(reason, /headline overlap|same canonical URL/);
  });

  test("candidates built by hand without the new fields still work", () => {
    // Older callers and tests pass tokens and entities only.
    const c = {
      storyId: 1,
      title: "IAASB approves revised ISA 240 on fraud",
      urls: ["https://iaasb.org/a"],
      tokens: ["iaasb", "approves", "revised", "isa", "240", "fraud"],
      entities: ["IAASB", "ISA 240"],
      lastSeenAt: "2026-09-18T00:00:00.000Z",
    };
    const m = findCluster(
      { url: "https://x.eu/b", title: "Revised ISA 240: IAASB approves fraud standard", lead: "" },
      [c],
      Date.parse("2026-09-18T12:00:00.000Z")
    );
    assert.ok(m, "a clear match still matches");
    assert.ok(buildCandidates([], []).length === 0);
  });
});
