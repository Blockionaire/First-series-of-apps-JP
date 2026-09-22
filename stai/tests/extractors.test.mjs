/**
 * Site-specific extractors, and the rules that keep them site-specific.
 *
 * Two separate things are under test and they matter for different reasons:
 *
 *   · the APAS extractor does what it claims on a page shaped like APAS's;
 *   · nothing in the system can scrape a page nobody wrote an extractor for.
 *
 * The second is the one that protects the desk. An extractor that misses an
 * item costs a story; a generic scraper that runs everywhere costs the
 * Inbox's credibility, because navigation links cluster and rank exactly like
 * real ones and the failure is invisible until something is published from a
 * menu entry.
 *
 * The fixture is SYNTHETIC — see its header. These assertions are about
 * behaviour, not about that file's bytes, so they should survive it being
 * replaced with a real saved page.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  acceptsApasIndex,
  extractApas,
  isApasDocument,
  isApasPublication,
} from "../src/lib/newsroom/extractors/apas.ts";
import { extractorFor, EXTRACTORS } from "../src/lib/newsroom/extractors/index.ts";
import { parseGermanDate, findAnchors } from "../src/lib/newsroom/extractors/html.ts";
import { shouldFetch } from "../src/lib/newsroom/fetcher.ts";
import { canonicalUrl } from "../src/lib/newsroom/normalise.ts";

const FIXTURE = fs.readFileSync(
  path.join(import.meta.dirname, "fixtures/apas-index.html"),
  "utf8"
);
const PAGE = "https://www.apasbafa.bund.de/SharedDocs/Bekanntmachungen/DE/bekanntmachungen_node.html";

/* ── German dates ───────────────────────────────────────────────────────── */

describe("German dates", () => {
  test("dd.mm.yyyy is read day-first", () => {
    // The whole reason this function exists. Date.parse reads "01.02.2026"
    // as January where it accepts it at all, which would store a February
    // publication five weeks older than it is.
    assert.equal(parseGermanDate("01.02.2026").slice(0, 10), "2026-02-01");
    assert.equal(parseGermanDate("15.01.2026").slice(0, 10), "2026-01-15");
    assert.equal(parseGermanDate("5.1.2026").slice(0, 10), "2026-01-05");
  });

  test("written months are read too", () => {
    assert.equal(parseGermanDate("12. Dezember 2025").slice(0, 10), "2025-12-12");
    assert.equal(parseGermanDate("3. März 2026").slice(0, 10), "2026-03-03");
  });

  test("the instant is midday, not midnight", () => {
    // Midnight Berlin is the previous day in UTC, which would make every item
    // appear published the day before it was.
    assert.match(parseGermanDate("15.01.2026"), /T12:00:00/);
  });

  test("impossible and implausible dates are refused", () => {
    assert.equal(parseGermanDate("31.02.2026"), null, "31 February rolls over silently otherwise");
    assert.equal(parseGermanDate("00.01.2026"), null);
    assert.equal(parseGermanDate("15.13.2026"), null);
    assert.equal(parseGermanDate("01.01.1970"), null, "epoch is a templating bug");
    assert.equal(parseGermanDate("01.01.2140"), null, "and so is a date far ahead");
    assert.equal(parseGermanDate("kein Datum"), null);
    assert.equal(parseGermanDate(""), null);
  });
});

/* ── What counts as an APAS publication ─────────────────────────────────── */

describe("APAS URL rules", () => {
  const P = "https://www.apasbafa.bund.de";

  test("a SharedDocs document page is a publication", () => {
    assert.equal(isApasPublication(`${P}/SharedDocs/Kurzmeldungen/DE/2026/meldung.html`), true);
    assert.equal(isApasPublication(`${P}/SharedDocs/Bekanntmachungen/DE/2026/b.html`), true);
  });

  test("a _node.html section index is navigation, not a publication", () => {
    // The single most valuable rule here. These sit in the same lists as real
    // items and their titles read like plausible headlines.
    assert.equal(isApasPublication(`${P}/SharedDocs/Bekanntmachungen/DE/bekanntmachungen_node.html`), false);
  });

  test("a session id does not disqualify a real publication", () => {
    // APAS is Java-backed and appends `;jsessionid=` for any client without a
    // session cookie, which a crawler permanently is. Rejecting these would
    // drop genuine Bekanntmachungen on most runs; canonicalUrl strips the id
    // so identity still collapses to one document.
    assert.equal(isApasPublication(`${P}/SharedDocs/DE/x.html;jsessionid=ABC`), true);
    assert.equal(
      canonicalUrl(`${P}/SharedDocs/DE/x.html;jsessionid=ABC`),
      canonicalUrl(`${P}/SharedDocs/DE/x.html`),
      "the same page under two addresses must be one item"
    );
  });

  test("another domain is never an APAS publication", () => {
    assert.equal(isApasPublication("https://www.bafa.de/SharedDocs/DE/x.html"), false);
    assert.equal(isApasPublication("https://evil.example.com/SharedDocs/DE/x.html"), false);
    // The near-miss a naive suffix check would wave through.
    assert.equal(isApasPublication("https://apasbafa.bund.de.evil.com/SharedDocs/x.html"), false);
  });

  test("a path outside SharedDocs is not a publication", () => {
    assert.equal(isApasPublication(`${P}/APAS/DE/Service/Impressum/impressum.html`), false);
  });

  test("documents are SharedDocs PDFs on the same domain", () => {
    assert.equal(isApasDocument(`${P}/SharedDocs/Downloads/DE/2026/b.pdf`), true);
    assert.equal(isApasDocument(`${P}/SharedDocs/Downloads/DE/2026/b.html`), false);
    assert.equal(isApasDocument("https://elsewhere.example/a.pdf"), false);
  });

  test("the extractor refuses pages it does not understand", () => {
    assert.equal(acceptsApasIndex(PAGE), true);
    assert.equal(acceptsApasIndex(`${P}/APAS/DE/Aktuelles/aktuelles_node.html`), true);
    assert.equal(acceptsApasIndex("https://www.bafa.de/anything"), false, "another publisher");
    assert.equal(acceptsApasIndex(`http://www.apasbafa.bund.de/SharedDocs/x.html`), false, "plain http");
    assert.equal(acceptsApasIndex("not a url"), false);
  });
});

/* ── The extractor on a page ────────────────────────────────────────────── */

describe("extracting APAS publications", () => {
  const result = extractApas(FIXTURE, PAGE);

  test("it succeeds and returns only genuine publications", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.equal(result.items.length, 4, JSON.stringify(result.items.map((i) => i.title), null, 1));
  });

  test("navigation is not collected", () => {
    const titles = result.items.map((i) => i.title.toLowerCase());
    for (const nav of ["startseite", "impressum", "bekanntmachungen", "mehr", "bafa"]) {
      assert.ok(!titles.includes(nav), `"${nav}" is navigation and was collected as a publication`);
    }
    const urls = result.items.map((i) => i.url);
    assert.ok(!urls.some((u) => /_node\.html/.test(u)), "a section index was collected");
    assert.ok(!urls.some((u) => /bafa\.de/.test(u)), "an off-domain link was collected");
  });

  test("titles are decoded and readable", () => {
    const first = result.items[0];
    assert.match(first.title, /Bekanntmachung nach § 66a/, "entities resolved");
    assert.ok(!/&[a-z]+;/i.test(first.title), "no raw entities survive");
  });

  test("dates come from the page, in both notations", () => {
    const byUrl = Object.fromEntries(result.items.map((i) => [i.url, i.publishedAt]));
    const at = (frag) =>
      byUrl[Object.keys(byUrl).find((u) => u.includes(frag))]?.slice(0, 10);
    assert.equal(at("bekanntmachung_2026_03"), "2026-03-03");
    assert.equal(at("inspektionsbericht_2025"), "2026-02-17");
    assert.equal(at("berufsaufsicht_massnahmen"), "2026-01-05", "5.1.2026, not 1 May");
    assert.equal(at("hinweise_qualitaetssicherung"), "2025-12-12", "written month");
  });

  test("an entry with no date is rejected, never dated today", () => {
    // Defaulting to the retrieval time would make everything from a broken
    // page look like breaking news, and recency is a ranking input.
    assert.ok(
      !result.items.some((i) => i.url.includes("undatierte_meldung")),
      "an undated entry was collected"
    );
    assert.ok(
      result.rejected.some((r) => /undatierte_meldung/.test(r) && /date/i.test(r)),
      "and the rejection was not recorded"
    );
  });

  test("the linked official document is captured", () => {
    const withPdf = result.items.find((i) => i.url.includes("bekanntmachung_2026_03"));
    assert.match(withPdf.documentUrl, /\/SharedDocs\/Downloads\/DE\/2026\/bekanntmachung_2026_03\.pdf/);
  });

  test("an entry with no document simply has none", () => {
    const withoutPdf = result.items.find((i) => i.url.includes("inspektionsbericht_2025"));
    assert.ok(!withoutPdf.documentUrl, "invented an attachment that is not on the page");
  });

  test("the document URL never reaches the lead", () => {
    // `lead` is tokenised for clustering. A URL sharing a host and path prefix
    // with every other APAS item would give them all common vocabulary and
    // merge them into one story — the exact runaway fixed in the EBA work.
    for (const i of result.items) {
      assert.ok(!/https?:\/\//.test(i.lead), `a URL leaked into the lead: ${i.lead}`);
      assert.ok(!/\.pdf/i.test(i.lead), `a document path leaked into the lead: ${i.lead}`);
    }
  });

  test("URLs are absolute, so they can be deduplicated and opened", () => {
    for (const i of result.items) {
      assert.match(i.url, /^https:\/\/www\.apasbafa\.bund\.de\//);
    }
  });

  test("re-running on the same page gives the same result", () => {
    // Discovery re-reads this page every cadence; drift would create duplicate
    // stories for one publication.
    const again = extractApas(FIXTURE, PAGE);
    assert.deepEqual(again.items, result.items);
  });
});

/* ── Failing loudly ─────────────────────────────────────────────────────── */

describe("a changed page is an outage, not a quiet week", () => {
  test("a page with no links at all is an error", () => {
    const r = extractApas("<html><body><p>Wartungsarbeiten</p></body></html>", PAGE);
    assert.equal(r.ok, false);
    assert.match(r.error, /no links/i);
  });

  test("a page whose links all moved off /SharedDocs/ is an error", () => {
    // The realistic redesign: the site still works, the taxonomy changed.
    // "Zero items" here would read as "APAS published nothing", which is a
    // plausible sentence and a month of blindness.
    const moved = FIXTURE.replace(/\/SharedDocs\//g, "/Publikationen/");
    const r = extractApas(moved, PAGE);
    assert.equal(r.ok, false);
    assert.match(r.error, /structure has probably changed/i);
  });

  test("a page where every date disappeared is an error", () => {
    const undated = FIXTURE.replace(/\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/g, "").replace(
      /12\.\s+Dezember\s+2025/,
      ""
    );
    const r = extractApas(undated, PAGE);
    assert.equal(r.ok, false);
    assert.match(r.error, /structure has probably changed/i);
  });

  test("rejections are counted even on success", () => {
    const r = extractApas(FIXTURE, PAGE);
    assert.ok(r.ok);
    assert.ok(r.rejected.length > 0, "a jump in this number is how a template change is spotted");
  });
});

/* ── No generic scraper ─────────────────────────────────────────────────── */

describe("nothing can scrape a publisher nobody wrote an extractor for", () => {
  test("the registry is an allowlist, keyed by exact domain", () => {
    assert.ok(extractorFor("apasbafa.bund.de"), "APAS is registered");
    assert.ok(extractorFor("www.apasbafa.bund.de"), "www resolves to the same entry");
    assert.equal(extractorFor("bafa.de"), null, "the parent department is NOT covered");
    assert.equal(extractorFor("efrag.org"), null);
    assert.equal(extractorFor("apasbafa.bund.de.evil.com"), null, "suffix lookalike");
    assert.equal(extractorFor(""), null);
  });

  test("every registered extractor refuses at least one URL", () => {
    // Guards against an extractor whose accepts() returns true for anything,
    // which would make it a generic scraper wearing a domain name.
    for (const e of EXTRACTORS) {
      assert.equal(
        e.accepts("https://example.com/news"),
        false,
        `${e.name} accepts an arbitrary page`
      );
    }
  });

  test("html_scrape without an extractor is still skipped as unsupported", () => {
    const base = {
      active: true,
      fetch_allowed: true,
      ingestion_method: "html_scrape",
      fetch_frequency: 60,
      last_attempt_at: null,
    };
    const no = shouldFetch({ ...base, domain: "efrag.org" }, Date.now(), true);
    assert.equal(no.due, false);
    assert.equal(no.outcome, "skipped_unsupported");
    assert.match(no.reason, /no extractor is written/);
  });

  test("html_scrape WITH an extractor becomes retrievable", () => {
    const yes = shouldFetch(
      {
        active: true,
        fetch_allowed: true,
        ingestion_method: "html_scrape",
        fetch_frequency: 60,
        last_attempt_at: null,
        domain: "apasbafa.bund.de",
      },
      Date.now(),
      true
    );
    assert.equal(yes.due, true);
  });

  test("an extractor never overrides permission", () => {
    // The gate that matters. Having written an extractor for a publisher says
    // nothing about whether we may fetch them.
    const unapproved = shouldFetch(
      {
        active: true,
        fetch_allowed: false,
        ingestion_method: "html_scrape",
        fetch_frequency: 60,
        last_attempt_at: null,
        domain: "apasbafa.bund.de",
      },
      Date.now(),
      true
    );
    assert.equal(unapproved.due, false);
    assert.equal(unapproved.outcome, "skipped_not_permitted");

    const inactive = shouldFetch(
      {
        active: false,
        fetch_allowed: true,
        ingestion_method: "html_scrape",
        fetch_frequency: 60,
        last_attempt_at: null,
        domain: "apasbafa.bund.de",
      },
      Date.now(),
      true
    );
    assert.equal(inactive.outcome, "skipped_inactive");
  });
});

/* ── The shared primitives ──────────────────────────────────────────────── */

describe("anchor parsing tolerates real-world markup", () => {
  test("quoted, single-quoted and unquoted hrefs are all read", () => {
    const anchors = findAnchors(
      `<a href="/a">A</a><a href='/b'>B</a><a href=/c class=x>C</a><a>no href</a>`
    );
    assert.deepEqual(anchors.map((a) => a.href), ["/a", "/b", "/c"]);
    assert.deepEqual(anchors.map((a) => a.text), ["A", "B", "C"]);
  });

  test("nested markup inside a link becomes plain text", () => {
    const [a] = findAnchors(`<a href="/x"><span>Zwei</span> <b>W&ouml;rter</b></a>`);
    assert.equal(a.text, "Zwei Wörter");
  });
});
