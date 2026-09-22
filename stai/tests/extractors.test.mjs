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
  APAS_INDEX_URLS,
  acceptsApasIndex,
  extractApas,
  hasDatedPath,
  isApasDocument,
  isApasPublication,
} from "../src/lib/newsroom/extractors/apas.ts";
import {
  acceptsAnthropicIndex,
  extractAnthropic,
  isAnthropicNewsItem,
} from "../src/lib/newsroom/extractors/anthropic.ts";
import {
  acceptsCeaobPage,
  extractCeaob,
  isCeaobDocument,
  kindOf,
} from "../src/lib/newsroom/extractors/ceaob.ts";
import { extractorFor, EXTRACTORS } from "../src/lib/newsroom/extractors/index.ts";
import { parseGermanDate, findAnchors } from "../src/lib/newsroom/extractors/html.ts";
import { shouldFetch } from "../src/lib/newsroom/fetcher.ts";
import { canonicalUrl, normaliseItem } from "../src/lib/newsroom/normalise.ts";

const FIXTURE = fs.readFileSync(
  path.join(import.meta.dirname, "fixtures/apas-index.html"),
  "utf8"
);
/** The surface the first live test was wrongly pointed at. */
const APAS_HOME = fs.readFileSync(
  path.join(import.meta.dirname, "fixtures/apas-home.html"),
  "utf8"
);
const APAS_HOME_URL = "https://www.apasbafa.bund.de/APAS/DE/Home/home_node.html";
const PAGE = "https://www.apasbafa.bund.de/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html";

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

  test("a DATED SharedDocs page is a publication", () => {
    assert.equal(isApasPublication(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/2026/meldung.html`), true);
    assert.equal(isApasPublication(`${P}/SharedDocs/Bekanntmachungen/APAS/DE/2026/b.html`), true);
    // The year may be in the filename rather than a path segment.
    assert.equal(
      isApasPublication(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/bekanntmachung_2026_03.html`),
      true
    );
  });

  test("an UNDATED SharedDocs page is a reusable block, not a publication", () => {
    // The finding from the first live run. SharedDocs is a shared content
    // repository: slogans, teasers and contact blocks live there under the
    // same mandant and the same Kurzmeldungen type as real announcements.
    // slogan.html is the confirmed live example.
    assert.equal(isApasPublication(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/slogan.html`), false);
    for (const stem of ["teaser", "intro", "kontakt", "einleitung", "standardartikel"]) {
      assert.equal(
        isApasPublication(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/${stem}.html`),
        false,
        `${stem}.html was collected as a publication`
      );
    }
  });

  test("a dated address is what marks a publication", () => {
    assert.equal(hasDatedPath("/SharedDocs/Kurzmeldungen/APAS/DE/2026/x.html"), true);
    assert.equal(hasDatedPath("/SharedDocs/Kurzmeldungen/APAS/DE/bericht_2025.html"), true);
    assert.equal(hasDatedPath("/SharedDocs/Kurzmeldungen/APAS/DE/slogan.html"), false);
    // A four-digit document number is not a year.
    assert.equal(hasDatedPath("/SharedDocs/Downloads/APAS/DE/formular_1700.pdf"), false);
    assert.equal(hasDatedPath("/SharedDocs/Kurzmeldungen/APAS/DE/isa_3402.html"), false);
    // Nor is a year far enough out to be a typo.
    assert.equal(hasDatedPath("/SharedDocs/Kurzmeldungen/APAS/DE/2099/x.html"), false);
  });

  test("a _node.html section index is navigation, not a publication", () => {
    // The single most valuable rule here. These sit in the same lists as real
    // items and their titles read like plausible headlines.
    assert.equal(isApasPublication(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html`), false);
  });

  test("a session id does not disqualify a real publication", () => {
    // APAS is Java-backed and appends `;jsessionid=` for any client without a
    // session cookie, which a crawler permanently is. Rejecting these would
    // drop genuine Bekanntmachungen on most runs; canonicalUrl strips the id
    // so identity still collapses to one document.
    assert.equal(
      isApasPublication(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/2026/x.html;jsessionid=ABC`),
      true
    );
    assert.equal(
      canonicalUrl(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/2026/x.html;jsessionid=ABC`),
      canonicalUrl(`${P}/SharedDocs/Kurzmeldungen/APAS/DE/2026/x.html`),
      "the same page under two addresses must be one item"
    );
  });

  test("another domain is never an APAS publication", () => {
    assert.equal(isApasPublication("https://www.bafa.de/SharedDocs/Kurzmeldungen/APAS/DE/2026/x.html"), false);
    assert.equal(isApasPublication("https://evil.example.com/SharedDocs/Kurzmeldungen/APAS/DE/2026/x.html"), false);
    // The near-miss a naive suffix check would wave through.
    assert.equal(isApasPublication("https://apasbafa.bund.de.evil.com/SharedDocs/x.html"), false);
  });

  test("a path outside SharedDocs is not a publication", () => {
    assert.equal(isApasPublication(`${P}/APAS/DE/Service/Impressum/impressum.html`), false);
    assert.equal(isApasPublication(`${P}/SharedDocs/Kurzmeldungen/BAFA/DE/2026/x.html`), false);
  });

  test("documents are SharedDocs PDFs on the same domain", () => {
    assert.equal(isApasDocument(`${P}/SharedDocs/Downloads/APAS/DE/2026/b.pdf`), true);
    assert.equal(isApasDocument(`${P}/SharedDocs/Downloads/APAS/DE/2026/b.html`), false);
    assert.equal(isApasDocument("https://elsewhere.example/a.pdf"), false);
    assert.equal(isApasDocument(`${P}/SharedDocs/Downloads/BAFA/DE/2026/b.pdf`), false, "mandant");
    // A dated Downloads file is a publication in its own right.
    assert.equal(isApasPublication(`${P}/SharedDocs/Downloads/APAS/DE/2026/bericht.pdf`), true);
  });

  test("the extractor refuses pages it does not understand", () => {
    assert.equal(acceptsApasIndex(PAGE), true);
    assert.equal(acceptsApasIndex(`${P}/APAS/DE/Aktuelles/aktuelles_node.html`), true);
    // The surface the first live test was pointed at. It returns 200 and
    // links plenty of /SharedDocs/ URLs, which is exactly why refusing it by
    // name matters more than any markup check.
    assert.equal(acceptsApasIndex(APAS_HOME_URL), false, "the landing page is not a listing");
    assert.equal(acceptsApasIndex(`${P}/APAS/DE/Service/Impressum/impressum.html`), false);
    assert.equal(acceptsApasIndex("https://www.bafa.de/anything"), false, "another publisher");
    assert.equal(
      acceptsApasIndex(`${P}/SharedDocs/Kurzmeldungen/BAFA/DE/kurzmeldungen_node.html`),
      false,
      "the BAFA index on the same host is a different authority"
    );
    assert.equal(acceptsApasIndex(`http://www.apasbafa.bund.de/SharedDocs/Kurzmeldungen/APAS/DE/x.html`), false, "plain http");
    assert.equal(acceptsApasIndex("not a url"), false);
  });
});

/* ── The extractor on a page ────────────────────────────────────────────── */

describe("extracting APAS publications", () => {
  const result = extractApas(FIXTURE, PAGE);

  test("it succeeds and returns only genuine publications", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.equal(result.items.length, 5, JSON.stringify(result.items.map((i) => i.title), null, 1));
  });

  test("a dated file under Downloads is a publication in its own right", () => {
    // The operator confirmed genuine publications live under
    // /SharedDocs/Downloads/APAS/DE/ as well as under Kurzmeldungen.
    const report = result.items.find((i) => i.url.includes("taetigkeitsbericht_2025"));
    assert.ok(report, "a Downloads publication was dropped");
    assert.match(report.title, /T\u00e4tigkeitsbericht 2025/);
    assert.equal(report.publishedAt.slice(0, 10), "2025-11-04");
    assert.equal(report.documentUrl, report.url, "for a file, the page IS the document");
  });

  test("reusable blocks in the listing are refused even when dated nearby", () => {
    // teaser.html and kontakt.html sit in the list with a date beside them.
    // Only the undated ADDRESS separates them from real announcements.
    const urls = result.items.map((i) => i.url).join(" ");
    for (const stem of ["slogan", "teaser", "kontakt"]) {
      assert.ok(!urls.includes(`/${stem}.html`), `${stem}.html was collected`);
    }
  });

  test("a block whose name nobody anticipated is refused too", () => {
    // The test that makes the dated-path rule load-bearing rather than
    // decorative. This entry has a plausible headline, a date beside it in
    // the listing, and a name no denylist would contain — only its undated
    // address marks it as a reusable block.
    const urls = result.items.map((i) => i.url).join(" ");
    assert.ok(
      !urls.includes("aufgaben-und-befugnisse"),
      "an undated reusable block was collected as a publication"
    );
    assert.ok(
      !result.items.some((i) => /Aufgaben und Befugnisse/i.test(i.title)),
      "an undated reusable block was collected as a publication"
    );
  });

  test("the landing page is refused outright, with somewhere to go instead", () => {
    // Refused before parsing, so the operator is told the surface is wrong
    // rather than being handed an empty list from a page that returned 200.
    assert.equal(acceptsApasIndex(APAS_HOME_URL), false);
    const r = extractApas(APAS_HOME, APAS_HOME_URL);
    assert.equal(r.ok, false, "the landing page yielded items");
    assert.match(r.error, /reusable content blocks|not an APAS publications listing/i);
    // And it names where publications actually live.
    assert.ok(
      APAS_INDEX_URLS.some((u) => r.error.includes(u)),
      `the error should name a real index: ${r.error}`
    );
  });

  test("the landing page's own links are named in the refusal", () => {
    const r = extractApas(APAS_HOME, APAS_HOME_URL);
    assert.match(r.error, /slogan\.html|teaser\.html|intro\.html/, r.error);
  });

  test("BAFA content on the same host is not collected as APAS", () => {
    // apasbafa.bund.de serves two authorities under one taxonomy, separated
    // only by the mandant segment. Filing an export-control notice as German
    // audit oversight is not a missed item — it is a wrong citation with a
    // regulator's authority attached, which is the worst thing this pipeline
    // can produce.
    const urls = result.items.map((i) => i.url);
    assert.ok(!urls.some((u) => /\/BAFA\//.test(u)), "a BAFA item was collected as APAS");
    assert.ok(
      !result.items.some((i) => /Dual-Use/i.test(i.title)),
      "export control was filed as audit oversight"
    );
    assert.ok(
      urls.every((u) => /\/SharedDocs\/[^/]+\/APAS\//.test(u)),
      "every item must carry the APAS mandant"
    );
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
    assert.match(withPdf.documentUrl, /\/SharedDocs\/Downloads\/APAS\/DE\/2026\/bekanntmachung_2026_03\.pdf/);
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
    assert.match(r.error, /not an APAS publications listing/i);
    assert.ok(
      APAS_INDEX_URLS.some((u) => r.error.includes(u)),
      "a structural failure should still say where to look"
    );
  });

  test("a page where every date disappeared is an error", () => {
    // Dates stripped from the ENTRIES while the addresses stay dated: the
    // listing still looks like a listing and carries nothing rankable.
    const undated = FIXTURE.replace(/<span class=["']?date["']?>[^<]*<\/span>/gi, "");
    const r = extractApas(undated, PAGE);
    assert.equal(r.ok, false);
    assert.match(r.error, /listing structure has probably changed/i);
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

/* ── Anthropic ──────────────────────────────────────────────────────────── */

const ANTHROPIC = fs.readFileSync(
  path.join(import.meta.dirname, "fixtures/anthropic-news.html"),
  "utf8"
);
const NEWS = "https://www.anthropic.com/news";

describe("Anthropic newsroom URL rules", () => {
  test("/news/<slug> is an entry", () => {
    assert.equal(isAnthropicNewsItem("https://www.anthropic.com/news/claude-opus-5"), true);
    assert.equal(isAnthropicNewsItem("https://www.anthropic.com/news/claude-opus-5/"), true);
    assert.equal(isAnthropicNewsItem("https://anthropic.com/en/news/claude-opus-5"), true);
  });

  test("the index itself and deeper paths are not entries", () => {
    assert.equal(isAnthropicNewsItem("https://www.anthropic.com/news"), false);
    assert.equal(isAnthropicNewsItem("https://www.anthropic.com/news/archive/2024"), false);
  });

  test("the rest of the site is not the newsroom", () => {
    for (const p of ["/pricing", "/careers", "/legal/privacy", "/supported-countries", "/"]) {
      assert.equal(isAnthropicNewsItem(`https://www.anthropic.com${p}`), false, p);
    }
    assert.equal(isAnthropicNewsItem("https://docs.anthropic.com/news/x"), true, "subdomains count");
    assert.equal(isAnthropicNewsItem("https://anthropic.com.evil.com/news/x"), false, "lookalike");
  });

  test("it refuses pages that are not the news index", () => {
    assert.equal(acceptsAnthropicIndex(NEWS), true);
    assert.equal(acceptsAnthropicIndex("https://www.anthropic.com/news/"), true);
    assert.equal(acceptsAnthropicIndex("https://www.anthropic.com/pricing"), false);
    assert.equal(acceptsAnthropicIndex("https://www.anthropic.com/news/claude-opus-5"), false);
    assert.equal(acceptsAnthropicIndex("https://example.com/news"), false);
  });
});

describe("extracting Anthropic newsroom entries", () => {
  const result = extractAnthropic(ANTHROPIC, NEWS);

  test("it succeeds and returns only newsroom entries", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    const urls = result.items.map((i) => i.url);
    assert.ok(urls.every((u) => /\/news\/[^/]+$/.test(u)), JSON.stringify(urls, null, 1));
  });

  test("site chrome is not collected", () => {
    const urls = result.items.map((i) => i.url).join(" ");
    for (const junk of ["/pricing", "/careers", "/legal/", "docs.anthropic.com", "/news/archive"]) {
      assert.ok(!urls.includes(junk), `${junk} was collected as a newsroom entry`);
    }
  });

  test("one entry linked three times is one item", () => {
    // The index links the same announcement from a hero card, a featured
    // strip and a list row. Without dedup it would arrive three times and
    // read as corroboration.
    const opus = result.items.filter((i) => i.url.includes("claude-opus-5"));
    assert.equal(opus.length, 1, "the hero, featured and list links did not collapse");
  });

  test("a trailing slash is the same entry", () => {
    const dep = result.items.filter((i) => i.url.includes("a-note-on-model-deprecations"));
    assert.equal(dep.length, 1);
  });

  test("dates come from the machine-readable attribute", () => {
    const byUrl = Object.fromEntries(result.items.map((i) => [i.url, i.publishedAt]));
    const at = (frag) => byUrl[Object.keys(byUrl).find((u) => u.includes(frag))]?.slice(0, 10);
    assert.equal(at("claude-opus-5"), "2026-09-15");
    assert.equal(at("eu-ai-act-code-of-practice"), "2026-08-28");
    assert.equal(at("economic-index-2026"), "2026-07-02");
  });

  test("the category is captured where the card shows one", () => {
    const byUrl = Object.fromEntries(result.items.map((i) => [i.url, i.category]));
    const cat = (frag) => byUrl[Object.keys(byUrl).find((u) => u.includes(frag))];
    assert.equal(cat("eu-ai-act-code-of-practice"), "Policy");
    assert.equal(cat("economic-index-2026"), "Societal Impacts");
    assert.equal(cat("claude-for-financial-services"), "Product");
  });

  test("an image-only card still yields a readable title", () => {
    // Hero cards wrap artwork, so the anchor's text is empty while the entry
    // is perfectly real. Dropping it would lose the biggest story on the page.
    const opus = result.items.find((i) => i.url.includes("claude-opus-5"));
    assert.ok(opus, "the hero entry was dropped");
    assert.ok(opus.title.length > 5, `unusable title: "${opus.title}"`);
  });

  test("an undated entry is kept, not dated today", () => {
    // Unlike APAS: a regulator's undated notice is a broken page, a newsroom
    // card may simply not show a date. A null ranks low rather than wrong.
    const dep = result.items.find((i) => i.url.includes("a-note-on-model-deprecations"));
    assert.ok(dep, "a dateless entry was dropped");
    assert.equal(dep.publishedAt, null, "a date was invented");
  });

  test("a changed newsroom structure is an error, not an empty week", () => {
    const moved = ANTHROPIC.replace(/\/news\//g, "/blog/");
    const r = extractAnthropic(moved, NEWS);
    assert.equal(r.ok, false);
    assert.match(r.error, /structure has probably changed/i);
  });
});

/* ── CEAOB ──────────────────────────────────────────────────────────────── */

const CEAOB_HTML = fs.readFileSync(
  path.join(import.meta.dirname, "fixtures/ceaob-page.html"),
  "utf8"
);
const CEAOB_PAGE =
  "https://finance.ec.europa.eu/regulation-and-supervision/expert-groups-comitology-and-other-committees/committee-european-auditing-oversight-bodies_en";

describe("CEAOB scoping", () => {
  test("only the CEAOB page on DG FISMA is eligible", () => {
    // The host is the whole of DG FISMA. Accepting any page on it would let
    // this be aimed at the sanctions index and return items filed under a
    // committee that had nothing to do with them.
    assert.equal(acceptsCeaobPage(CEAOB_PAGE), true);
    assert.equal(acceptsCeaobPage(`${CEAOB_PAGE}/ceaob-sub-groups_en`), true, "children count");
    assert.equal(
      acceptsCeaobPage("https://finance.ec.europa.eu/eu-and-world/sanctions-restrictive-measures_en"),
      false,
      "another DG FISMA area"
    );
    assert.equal(acceptsCeaobPage("https://finance.ec.europa.eu/en"), false, "the section home");
    assert.equal(acceptsCeaobPage("https://ec.europa.eu/anything"), false, "another host");
  });

  test("documents are Commission-hosted files", () => {
    assert.equal(isCeaobDocument("https://finance.ec.europa.eu/document/download/x.pdf"), true);
    assert.equal(isCeaobDocument("https://ec.europa.eu/a/b.docx"), true);
    assert.equal(isCeaobDocument("https://finance.ec.europa.eu/page_en"), false);
    assert.equal(isCeaobDocument("https://example.com/x.pdf"), false, "off-host");
  });

  test("content kinds are named from the Commission's own words", () => {
    assert.equal(kindOf("CEAOB work programme 2026"), "Work programme");
    assert.equal(kindOf("Conclusions of the 24th CEAOB plenary meeting"), "Plenary meeting");
    assert.equal(kindOf("Public consultation on sustainability assurance"), "Consultation");
    assert.equal(kindOf("CEAOB report on audit market monitoring"), "Report");
    assert.equal(kindOf("Members and observers"), "", "no kind rather than a guess");
  });
});

describe("extracting CEAOB publications", () => {
  const result = extractCeaob(CEAOB_HTML, CEAOB_PAGE);

  test("it succeeds and finds the official material", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.ok(result.items.length >= 4, JSON.stringify(result.items.map((i) => i.title), null, 1));
  });

  test("all four kinds of publication are recognised", () => {
    const byKind = Object.fromEntries(result.items.map((i) => [i.category, i.title]));
    for (const kind of ["Work programme", "Plenary meeting", "Report", "Consultation"]) {
      assert.ok(byKind[kind], `no ${kind} was captured`);
    }
  });

  test("documents carry their document URL", () => {
    const wp = result.items.find((i) => i.category === "Work programme");
    assert.match(wp.documentUrl, /ceaob-work-programme-2026\.pdf$/);
    assert.equal(wp.url, wp.documentUrl, "for a file, the page IS the document");
  });

  test("a page publication has no invented document", () => {
    const report = result.items.find((i) => i.category === "Report");
    assert.ok(!report.documentUrl, "invented an attachment");
    assert.match(report.url, /ceaob-report-audit-market-monitoring_en$/);
  });

  test("dates are captured from both attributes and prose", () => {
    const byKind = Object.fromEntries(result.items.map((i) => [i.category, i.publishedAt]));
    assert.equal(byKind["Work programme"].slice(0, 10), "2026-01-20", "from <time datetime>");
    assert.equal(byKind["Plenary meeting"].slice(0, 10), "2025-11-14", "from '14 November 2025'");
  });

  test("cookie banners, legal chrome and navigation are refused", () => {
    const urls = result.items.map((i) => i.url).join(" ");
    for (const junk of ["cookies_en", "legal-notice", "ceaob-members_en", "/en\"", "expert-groups-comitology-and-other-committees_en"]) {
      assert.ok(!urls.includes(junk), `${junk} was collected as a publication`);
    }
  });

  test("an undated page naming no kind is treated as navigation", () => {
    assert.ok(
      !result.items.some((i) => /Members and observers/i.test(i.title)),
      "a membership page was filed as a publication"
    );
  });

  test("an off-host summary is not a CEAOB publication", () => {
    assert.ok(
      !result.items.some((i) => i.url.includes("accountancyeurope")),
      "a third party's summary was filed as primary material"
    );
  });

  test("a page with no Commission links at all is an error", () => {
    const r = extractCeaob(
      '<html><body><a href="https://example.com/a">Something</a></body></html>',
      CEAOB_PAGE
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /structure has probably changed/i);
  });

  test("a page where every publication lost its date and kind is an error", () => {
    const stripped = CEAOB_HTML
      .replace(/<time[^>]*>[^<]*<\/time>/gi, "")
      .replace(/<span class="date">[^<]*<\/span>/gi, "")
      .replace(/\.pdf/gi, "_en")
      .replace(/work programme|plenary|report|consultation|guidance|statement|sub-group/gi, "page");
    const r = extractCeaob(stripped, CEAOB_PAGE);
    assert.equal(r.ok, false);
    assert.match(r.error, /structure has probably changed/i);
  });
});

/* ── Into the pipeline, exactly like an RSS item ────────────────────────── */

describe("extractor output is an ordinary feed item", () => {
  /**
   * The integration claim, tested at the seam rather than by assertion.
   *
   * Whatever an extractor returns is handed to `normaliseItem`, the same
   * function every RSS entry goes through. If it survives that with a
   * canonical URL, a hash and jurisdictions, it deduplicates and clusters
   * identically — there is no second path for scraped items to drift down.
   */
  const SOURCES = {
    apas: { feed_url: PAGE, jurisdictions: ["DE"] },
    anthropic: { feed_url: NEWS, jurisdictions: ["GLOBAL"] },
    ceaob: { feed_url: CEAOB_PAGE, jurisdictions: ["EU"] },
  };
  const RESULTS = {
    apas: extractApas(FIXTURE, PAGE),
    anthropic: extractAnthropic(ANTHROPIC, NEWS),
    ceaob: extractCeaob(CEAOB_HTML, CEAOB_PAGE),
  };

  for (const [name, result] of Object.entries(RESULTS)) {
    test(`${name}: every item normalises`, async () => {
      assert.equal(result.ok, true);
      for (const item of result.items) {
        const n = await normaliseItem(item, SOURCES[name]);
        assert.ok(n, `dropped in normalisation: ${item.url}`);
        assert.match(n.url, /^https:\/\//, "canonical URL");
        assert.equal(n.urlHash.length, 64, "sha-256 hex");
        assert.ok(n.title.length > 0);
        assert.ok(n.jurisdictions.length > 0, "always filed somewhere");
        assert.equal(typeof n.documentUrl, "string");
        assert.equal(typeof n.category, "string");
      }
    });

    test(`${name}: canonical URLs are unique within one page`, async () => {
      // Deduplication keys on this. Two items sharing a canonical URL would
      // be one document arriving twice and reading as corroboration.
      const urls = [];
      for (const item of result.items) {
        const n = await normaliseItem(item, SOURCES[name]);
        urls.push(n.url);
      }
      assert.equal(new Set(urls).size, urls.length, `duplicate canonical URL in ${name}`);
    });

    test(`${name}: re-reading the page yields the same canonical URLs`, async () => {
      // Discovery re-reads every cadence. Drift here would create a second
      // story for the same publication on every run.
      const again = { apas: extractApas(FIXTURE, PAGE), anthropic: extractAnthropic(ANTHROPIC, NEWS), ceaob: extractCeaob(CEAOB_HTML, CEAOB_PAGE) }[name];
      assert.deepEqual(
        again.items.map((i) => i.url),
        result.items.map((i) => i.url)
      );
    });
  }

  test("the category reaches the normalised row", async () => {
    const ceaobItems = RESULTS.ceaob.items;
    const wp = ceaobItems.find((i) => i.category === "Work programme");
    const n = await normaliseItem(wp, SOURCES.ceaob);
    assert.equal(n.category, "Work programme");
  });

  test("a category is capped, not stored unbounded", async () => {
    const n = await normaliseItem(
      { url: "https://x.eu/a", title: "T", lead: "", publishedAt: null, category: "x".repeat(500) },
      { feed_url: "https://x.eu/", jurisdictions: ["EU"] }
    );
    assert.ok(n.category.length <= 80);
  });
});
