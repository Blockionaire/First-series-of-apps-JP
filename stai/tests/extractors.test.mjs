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
  apas,
  detailApas,
  detailDate,
  detailTitle,
  extractApas,
  hasDatedPath,
  isApasDetailPage,
  isApasDocument,
  isApasPublication,
  plausibleTitle,
  seriesKind,
} from "../src/lib/newsroom/extractors/apas.ts";
import { hydrate } from "../src/lib/newsroom/extractors/hydrate.ts";
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
import {
  acceptsEnisaIndex,
  enisaCategory,
  extractEnisa,
  isEnisaNewsItem,
} from "../src/lib/newsroom/extractors/enisa.ts";
import {
  acceptsAiOfficePage,
  contentKind,
  extractAiOffice,
  namesAiSubject,
} from "../src/lib/newsroom/extractors/ai-office.ts";
import {
  acceptsCosoIndex,
  cosoCategory,
  extractCoso,
  isCosoNewsItem,
} from "../src/lib/newsroom/extractors/coso.ts";
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

/**
 * The Verlautbarungen surface, and the pages behind it.
 *
 * The second live test confirmed the index and the `vb_verlautbarung_NN.html`
 * addresses on it. Nobody has seen a detail page, so those fixtures are the
 * Government Site Builder's conventions rather than observation — see their
 * headers. The assertions below are about BEHAVIOUR (a title and a date must
 * come from the page; an entry without both is dropped), which is what should
 * survive those fixtures being replaced with real saved pages.
 */
const fixture = (name) =>
  fs.readFileSync(path.join(import.meta.dirname, `fixtures/${name}`), "utf8");

const VB_INDEX = fixture("apas-verlautbarungen.html");
// The URL actually registered, and the one the operator's live test
// confirmed: it returns 200 and lists the numbered series.
const VB_INDEX_URL =
  "https://www.apasbafa.bund.de/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html";
const VB_PAGES = {
  "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html": fixture("apas-vb-26.html"),
  "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_25.html": fixture("apas-vb-25.html"),
  "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_24.html": fixture("apas-vb-24.html"),
  "/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_22.html": fixture("apas-vb-22.html"),
  // 23 is deliberately absent: a live index routinely links a page that has
  // been withdrawn, and one 404 must not cost the other four.
};

const ENISA_HTML = fixture("enisa-news.html");
const ENISA_URL = "https://www.enisa.europa.eu/news";
const AI_OFFICE_HTML = fixture("ai-office-hub.html");
const AI_OFFICE_URL = "https://digital-strategy.ec.europa.eu/en/policies/ai-office";
const COSO_HTML = fixture("coso-news.html");
const COSO_URL = "https://www.coso.org/news";

/**
 * A fetch that serves the detail fixtures and records what was asked for.
 *
 * The recording is the point. Half of what these tests check is which
 * requests were NOT made — nothing off the domain, nothing under the BAFA
 * mandant, nothing beyond the cap.
 */
function detailFetch() {
  const asked = [];
  const fn = async (url) => {
    asked.push(url);
    const path = new URL(url).pathname.replace(/;jsessionid=[^/;?]*/gi, "");
    const body = VB_PAGES[path];
    if (!body) return new Response("not found", { status: 404, statusText: "Not Found" });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  };
  fn.asked = asked;
  return fn;
}

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

/* ── The Verlautbarungen series: two requests, one publication ───────────── */

describe("APAS numbered series URL rules", () => {
  const vb = "https://www.apasbafa.bund.de/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html";

  test("a numbered Verlautbarung is a detail page", () => {
    assert.equal(isApasDetailPage(vb), true);
    assert.equal(seriesKind(new URL(vb).pathname), "Verlautbarung");
  });

  test("it is NOT treated as a self-describing publication", () => {
    // The whole correction. The old rule demanded a date in the address and
    // this address has none — which is why it has to be opened rather than
    // read off the index.
    assert.equal(isApasPublication(vb), false);
    assert.equal(hasDatedPath(new URL(vb).pathname), false);
  });

  test("the same series name under the BAFA mandant is refused", () => {
    // The isolation that may never be relaxed. apasbafa.bund.de serves both
    // authorities, and a rule keyed on the file name alone would file an
    // export-control pronouncement as German audit oversight.
    const bafa =
      "https://www.apasbafa.bund.de/SharedDocs/Downloads/BAFA/DE/vb_verlautbarung_9.html";
    assert.equal(isApasDetailPage(bafa), false);
    assert.equal(isApasPublication(bafa), false);
  });

  test("a session id does not hide the series", () => {
    const withSession = `${vb};jsessionid=9F2C4A1B`;
    assert.equal(isApasDetailPage(withSession), true);
  });

  test("navigation and reusable blocks are still not detail pages", () => {
    for (const path of [
      "/SharedDocs/Kurzmeldungen/APAS/DE/slogan.html",
      "/SharedDocs/Kurzmeldungen/APAS/DE/teaser.html",
      "/SharedDocs/Downloads/APAS/DE/downloads_node.html",
      "/SharedDocs/Kurzmeldungen/APAS/DE/aufgaben-und-befugnisse.html",
    ]) {
      assert.equal(
        isApasDetailPage(`https://www.apasbafa.bund.de${path}`),
        false,
        `${path} was taken for a publication`
      );
    }
  });

  test("the series table does not degrade into 'anything with a number'", () => {
    // The generalisation this file refuses to make. A numbered reusable block
    // is exactly what a loose rule would swallow.
    assert.equal(
      isApasDetailPage("https://www.apasbafa.bund.de/SharedDocs/Kurzmeldungen/APAS/DE/teaser_2.html"),
      false
    );
  });

  test("a file name is not a headline", () => {
    assert.equal(plausibleTitle("vb_verlautbarung_26.html"), false);
    assert.equal(plausibleTitle("Verlautbarung Nr. 26 zur Berichterstattung"), true);
  });
});

describe("the Verlautbarungen index asks for pages rather than inventing items", () => {
  const out = extractApas(VB_INDEX, VB_INDEX_URL);

  test("it succeeds, and emits nothing from the index alone", () => {
    assert.equal(out.ok, true, out.ok ? "" : out.error);
    assert.equal(
      out.items.length,
      0,
      "the index carries no titles and no dates, so it can produce no items"
    );
  });

  test("every numbered APAS Verlautbarung is queued to be opened", () => {
    const paths = out.pending.map((p) => new URL(p.url).pathname);
    for (const n of [26, 25, 24, 23, 22]) {
      assert.ok(
        paths.some((p) => p.endsWith(`vb_verlautbarung_${n}.html`)),
        `Verlautbarung ${n} was not queued`
      );
    }
  });

  test("nothing else is queued", () => {
    assert.equal(out.pending.length, 5, JSON.stringify(out.pending, null, 1));
    const queued = out.pending.map((p) => p.url).join(" ");
    for (const unwanted of ["BAFA", "slogan", "teaser", "kontakt", "_node.html", "bafa.de"]) {
      assert.ok(!queued.includes(unwanted), `${unwanted} was queued for fetching`);
    }
  });

  test("the link text is carried for the error message, never as a title", () => {
    const first = out.pending.find((p) => p.url.endsWith("vb_verlautbarung_26.html"));
    assert.equal(first.linkText, "vb_verlautbarung_26.html");
  });
});

describe("a publication exists once its own page says so", () => {
  test("a metadata date is preferred over the page's rebuild date", () => {
    // og:updated_time on the fixture is five months later. An item dated by
    // its last rebuild arrives at the top of the Inbox looking like news.
    const r = detailApas(
      VB_PAGES["/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html"],
      "https://www.apasbafa.bund.de/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html"
    );
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    assert.equal(r.item.publishedAt.slice(0, 10), "2026-03-15");
    assert.equal(r.item.title, "Verlautbarung Nr. 26 zur Berichterstattung über Inspektionen");
    assert.match(r.item.documentUrl, /vb_verlautbarung_26\.pdf/);
    assert.equal(r.item.category, "Verlautbarung");
  });

  test("a labelled date in the body carries a page with no metadata", () => {
    const r = detailApas(
      VB_PAGES["/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_25.html"],
      "https://www.apasbafa.bund.de/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_25.html"
    );
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    assert.equal(r.item.publishedAt.slice(0, 10), "2026-02-04");
  });

  test("the site-wide footer date is not any publication's date", () => {
    // Every page on this site ends "Stand: 01.01.2026". A date parser that is
    // not scoped to the content region gives the whole series that date, and
    // nothing about the result looks broken.
    for (const [path, html] of Object.entries(VB_PAGES)) {
      const r = detailApas(html, `https://www.apasbafa.bund.de${path}`);
      if (!r.ok) continue;
      assert.notEqual(
        r.item.publishedAt.slice(0, 10),
        "2026-01-01",
        `${path} took its date from the footer`
      );
    }
  });

  test("the banner heading is not mistaken for the document title", () => {
    // Verlautbarung 25's only <h1> is the authority's name in the site header.
    const html = VB_PAGES["/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_25.html"];
    // Exact, not a substring. A substring assertion passes on anything that
    // merely CONTAINS the headline, which is what a swallowed comment or a
    // whole <title> element produces — and is how this very defect survived
    // its own test until a sabotage run found the test toothless.
    assert.equal(
      detailTitle(html),
      "Verlautbarung Nr. 25 zur Unabhängigkeit bei Nichtprüfungsleistungen"
    );
  });

  test("a page with no date is not a publication, however real the address", () => {
    // The rule that makes the whole two-phase design worth having: the
    // address is genuine, the title is genuine, and it is still dropped.
    const html = VB_PAGES["/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_22.html"];
    assert.equal(detailDate(html), null);
    const r = detailApas(
      html,
      "https://www.apasbafa.bund.de/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_22.html"
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /no publication date/i);
  });

  test("a page with no title is not a publication either", () => {
    const stripped = VB_PAGES["/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html"]
      .replace(/<h1[\s\S]*?<\/h1>/i, "")
      .replace(/<meta property="og:title"[^>]*>/i, "")
      .replace(/<title\b[\s\S]*?<\/title>/i, "<title>APAS</title>");
    const r = detailApas(
      stripped,
      "https://www.apasbafa.bund.de/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html"
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /no usable title/i);
  });

  test("a detail parser pointed off the mandant refuses", () => {
    const r = detailApas(
      VB_PAGES["/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html"],
      "https://www.apasbafa.bund.de/SharedDocs/Downloads/BAFA/DE/vb_verlautbarung_26.html"
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /not an APAS page/i);
  });
});

describe("hydrating the Verlautbarungen index end to end", () => {
  test("it returns finished publications with titles, dates and documents", async () => {
    const fetchFn = detailFetch();
    const { result, fetched, listed } = await hydrate(
      apas,
      extractApas(VB_INDEX, VB_INDEX_URL),
      { fetch: fetchFn }
    );

    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.equal(listed, 5);
    assert.equal(fetched, 5);
    // 23 is a 404 and 22 carries no date. Three survive, and every one of
    // them has both facts that make an item publishable.
    assert.equal(result.items.length, 3, JSON.stringify(result.items.map((i) => i.title), null, 1));
    for (const item of result.items) {
      assert.ok(item.title.length > 12, `no title: ${item.url}`);
      assert.ok(item.publishedAt, `no date: ${item.url}`);
      assert.equal(item.category, "Verlautbarung");
    }
  });

  test("the items are dated from their own pages, not from the index", async () => {
    const { result } = await hydrate(apas, extractApas(VB_INDEX, VB_INDEX_URL), {
      fetch: detailFetch(),
    });
    const dates = Object.fromEntries(
      result.items.map((i) => [i.url.match(/_(\d+)\.html/)[1], i.publishedAt.slice(0, 10)])
    );
    assert.deepEqual(dates, { 26: "2026-03-15", 25: "2026-02-04", 24: "2025-11-18" });
  });

  test("a withdrawn page and an undated one are recorded, not silently lost", async () => {
    const { result } = await hydrate(apas, extractApas(VB_INDEX, VB_INDEX_URL), {
      fetch: detailFetch(),
    });
    const why = result.rejected.join("\n");
    assert.match(why, /vb_verlautbarung_23\.html — 404/);
    assert.match(why, /vb_verlautbarung_22\.html — no publication date/i);
  });

  test("it never requests anything but APAS publication pages", async () => {
    const fetchFn = detailFetch();
    await hydrate(apas, extractApas(VB_INDEX, VB_INDEX_URL), { fetch: fetchFn });
    for (const url of fetchFn.asked) {
      assert.match(url, /^https:\/\/www\.apasbafa\.bund\.de\//, url);
      assert.equal(isApasDetailPage(url), true, `requested a non-publication: ${url}`);
    }
    assert.ok(!fetchFn.asked.join(" ").includes("/BAFA/"), "requested BAFA content");
  });

  test("the cap bounds how many pages one retrieval opens", async () => {
    const fetchFn = detailFetch();
    const { fetched, listed } = await hydrate(
      apas,
      extractApas(VB_INDEX, VB_INDEX_URL),
      { fetch: fetchFn, limit: 2 }
    );
    assert.equal(listed, 5);
    assert.equal(fetched, 2);
    assert.equal(fetchFn.asked.length, 2);
  });

  test("every detail page failing is an outage, not an empty week", async () => {
    // The site is up, the index is intact, and the template changed. Zero
    // items here would read as "APAS published nothing", which is a plausible
    // sentence and a month of blindness.
    const gone = async () => new Response("", { status: 500, statusText: "Server Error" });
    const { result } = await hydrate(apas, extractApas(VB_INDEX, VB_INDEX_URL), { fetch: gone });
    assert.equal(result.ok, false);
    assert.match(result.error, /none yielded both a title and a date|structure has probably changed/i);
  });

  test("a queued URL off the publisher's domain is never requested", async () => {
    // The guard that survives an extractor being wrong. `pending` is built by
    // the extractor, so if a redesign ever put a third-party address where a
    // publication used to be, this is the thing standing between that and an
    // outbound request to it.
    const fetchFn = detailFetch();
    const { result } = await hydrate(
      apas,
      {
        ok: true,
        items: [],
        rejected: [],
        pending: [
          { url: "https://evil.example.com/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_1.html" },
          { url: "https://www.apasbafa.bund.de/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html" },
        ],
      },
      { fetch: fetchFn }
    );
    assert.equal(fetchFn.asked.length, 1, `requested: ${fetchFn.asked.join(", ")}`);
    assert.match(fetchFn.asked[0], /apasbafa\.bund\.de/);
    assert.ok(result.ok);
    assert.match(
      result.rejected.join("\n"),
      /evil\.example\.com[^\n]* — outside apasbafa\.bund\.de, not opened/
    );
  });

  test("hydrate is a no-op for an extractor that reads one page", async () => {
    let called = 0;
    const counted = async () => {
      called += 1;
      return new Response("", { status: 200 });
    };
    const single = extractApas(FIXTURE, PAGE);
    const { result, fetched } = await hydrate(apas, single, { fetch: counted });
    assert.equal(fetched, 0);
    assert.equal(called, 0, "a single-page extract must cost no extra requests");
    assert.equal(result.ok, true);
    assert.equal(result.items.length, single.items.length);
  });
});

/* ── ENISA ──────────────────────────────────────────────────────────────── */

describe("ENISA URL rules", () => {
  test("only the news index is an eligible surface", () => {
    assert.equal(acceptsEnisaIndex("https://www.enisa.europa.eu/news"), true);
    assert.equal(acceptsEnisaIndex("https://www.enisa.europa.eu/news/"), true);
    assert.equal(acceptsEnisaIndex("https://www.enisa.europa.eu/en/news"), true);
    // Other sections of a genuine ENISA site are not the news index.
    assert.equal(acceptsEnisaIndex("https://www.enisa.europa.eu/publications"), false);
    assert.equal(acceptsEnisaIndex("https://www.enisa.europa.eu/"), false);
    assert.equal(acceptsEnisaIndex("https://www.enisa.europa.eu/topics/nis2"), false);
    // Another agency entirely.
    assert.equal(acceptsEnisaIndex("https://www.europol.europa.eu/news"), false);
  });

  test("an entry is one slug under /news, and nothing else", () => {
    assert.equal(isEnisaNewsItem("https://www.enisa.europa.eu/news/threat-landscape-2026"), true);
    assert.equal(isEnisaNewsItem("https://www.enisa.europa.eu/news"), false, "the index itself");
    assert.equal(
      isEnisaNewsItem("https://www.enisa.europa.eu/news/press-releases/archive"),
      false,
      "a section under news is not an entry"
    );
    assert.equal(
      isEnisaNewsItem("https://www.enisa.europa.eu/publications/ai-and-cybersecurity"),
      false
    );
  });

  test("a tracking query does not make a second story", () => {
    // The identity is the slug. This is what collapses the featured panel and
    // the list row for one story into one item.
    assert.equal(
      isEnisaNewsItem("https://www.enisa.europa.eu/news/x-y-z?utm_source=homepage"),
      true
    );
  });

  test("the category is read, and absent rather than guessed", () => {
    assert.equal(enisaCategory("<span>Press Release</span> ENISA publishes"), "Press Release");
    assert.equal(enisaCategory("<span>Report</span> Threat Landscape"), "Report");
    assert.equal(enisaCategory("nothing recognisable here"), "");
  });
});

describe("extracting ENISA news", () => {
  const result = extractEnisa(ENISA_HTML, ENISA_URL);

  test("it returns the genuine news items and nothing else", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.deepEqual(
      result.items.map((i) => new URL(i.url).pathname),
      [
        "/news/enisa-publishes-nis2-technical-implementation-guidance",
        "/news/threat-landscape-2026-published",
        "/news/eucc-scheme-first-certificates-issued",
      ]
    );
  });

  test("the featured panel and the list row are one item", () => {
    // The commonest duplicate on a page like this: the same story twice, once
    // with a tracking query. Two rows in the Inbox for one publication is a
    // story that looks corroborated by a second source and is not.
    const lead = result.items.filter((i) => i.url.includes("nis2-technical-implementation"));
    assert.equal(lead.length, 1);
    assert.ok(!lead[0].url.includes("?"), "the canonical URL still carries the query");
  });

  test("filters and pagination are not stories", () => {
    const urls = result.items.map((i) => i.url).join(" ");
    for (const control of ["?page=", "?topic=", "?year="]) {
      assert.ok(!urls.includes(control), `a control was collected: ${control}`);
    }
  });

  test("other sections of the same site are not news", () => {
    const urls = result.items.map((i) => i.url).join(" ");
    for (const section of ["/publications/", "/topics/", "/about-enisa", "/privacy-policy"]) {
      assert.ok(!urls.includes(section), `${section} was collected as news`);
    }
  });

  test("another agency's newsroom is never in scope", () => {
    assert.ok(!result.items.some((i) => i.url.includes("europol")));
  });

  test("an undated entry is dropped, not dated today", () => {
    assert.ok(
      !result.items.some((i) => i.url.includes("undated-entry")),
      "an undated item would rank as breaking news on every poll"
    );
    assert.match(result.rejected.join("\n"), /undated-entry[^\n]*no date/);
  });

  test("dates, categories and teasers come off the right card", () => {
    const [nis2, threat, eucc] = result.items;
    assert.equal(nis2.publishedAt.slice(0, 10), "2026-09-15");
    assert.equal(nis2.category, "Press Release");
    assert.match(nis2.lead, /NIS2 implementing act/);
    assert.match(nis2.documentUrl, /fullReport\.pdf$/);

    assert.equal(threat.publishedAt.slice(0, 10), "2026-08-28");
    assert.equal(threat.category, "Report");
    // The neighbour's PDF must not travel: only the first card links one.
    assert.equal(threat.documentUrl, undefined, "a neighbouring card's document bled across");

    assert.equal(eucc.publishedAt.slice(0, 10), "2026-07-09");
  });

  test("a page with no /news/<slug> links says what it found instead", () => {
    // The refusal that turns a wrong guess into one round trip. If ENISA
    // files news somewhere else, the error names the shapes actually present.
    const moved = ENISA_HTML.replace(/\/news\//g, "/newsroom/");
    const r = extractEnisa(moved, ENISA_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /none matches \/news\/<slug>/);
    assert.match(r.error, /\/newsroom\//, `the shapes should be named: ${r.error}`);
  });

  test("an index that lost its dates is an outage, not a quiet week", () => {
    const undated = ENISA_HTML.replace(/<time[^>]*>[^<]*<\/time>/gi, "");
    const r = extractEnisa(undated, ENISA_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /index structure has probably changed/i);
  });

  test("a page with no links at all is an error", () => {
    const r = extractEnisa("<html><body><p>Maintenance</p></body></html>", ENISA_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /no links/i);
  });
});

/* ── European AI Office ─────────────────────────────────────────────────── */

describe("AI Office scoping", () => {
  test("only the AI Office hub on Digital Strategy is eligible", () => {
    assert.equal(acceptsAiOfficePage(AI_OFFICE_URL), true);
    assert.equal(
      acceptsAiOfficePage("https://digital-strategy.ec.europa.eu/en/policies/ai-office/faq"),
      true
    );
    // The host is the whole of DG CONNECT. Every one of these is a real page
    // on it and none is the AI Office.
    for (const other of [
      "https://digital-strategy.ec.europa.eu/en/policies/broadband-connectivity",
      "https://digital-strategy.ec.europa.eu/en/news/gigabit-act",
      "https://digital-strategy.ec.europa.eu/en",
    ]) {
      assert.equal(acceptsAiOfficePage(other), false, other);
    }
  });

  test("only news and library addresses are updates", () => {
    assert.equal(contentKind("/en/news/commission-publishes-guidelines"), "News");
    assert.equal(contentKind("/en/library/code-practice-gpai"), "Publication");
    // Evergreen descriptions. They never stop existing, so they would arrive
    // on every poll dated by whatever sat nearest them in the markup.
    assert.equal(contentKind("/en/policies/regulatory-framework-ai"), null);
    assert.equal(contentKind("/en/factpages/ai-in-europe"), null);
    assert.equal(contentKind("/en/news"), null, "the index is not an item");
  });

  test("the subject list is specific, and excludes the bare word AI", () => {
    assert.equal(namesAiSubject("Guidelines on general-purpose AI models"), true);
    assert.equal(namesAiSubject("The AI Act service desk"), true);
    assert.equal(namesAiSubject("AI Board holds first meeting"), true);
    // The thing the list exists to keep out: other units' work that merely
    // mentions artificial intelligence in passing.
    assert.equal(namesAiSubject("Gigabit Infrastructure Act enters application"), false);
    assert.equal(namesAiSubject("Digital Skills Indicator 2026"), false);
  });
});

describe("extracting AI Office updates", () => {
  const result = extractAiOffice(AI_OFFICE_HTML, AI_OFFICE_URL);

  test("it returns the AI Office updates", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.deepEqual(
      result.items.map((i) => new URL(i.url).pathname),
      [
        "/en/news/commission-publishes-guidelines-general-purpose-ai-models",
        "/en/library/code-practice-general-purpose-ai",
        "/en/news/first-meeting-ai-board-scientific-panel",
      ]
    );
  });

  test("unrelated Commission content is not filed under the AI Office", () => {
    // The whole reason this extractor is scoped the way it is. Every one of
    // these is a real /en/news/ or /en/library/ address with a real date and
    // a plausible headline — the only thing separating them is the subject.
    const urls = result.items.map((i) => i.url).join(" ");
    for (const unrelated of [
      "gigabit-infrastructure-act",
      "submarine-cable",
      "digital-skills-indicator",
      "media-pluralism-monitor",
      // The one that actually tests the subject list. A genuine funding
      // announcement from another unit that says "AI" in so many words: only
      // a list of SPECIFIC phrases keeps it out, and admitting the bare word
      // broke no test at all until this case existed.
      "ai-skills-training-smes",
    ]) {
      assert.ok(!urls.includes(unrelated), `${unrelated} was filed as an AI Office source`);
    }
  });

  test("the bare word AI is not an AI Office subject", () => {
    // Stated directly as well as through the fixture, because this is the
    // single rule keeping other directorates' work out of a Tier-1 slot.
    assert.equal(
      namesAiSubject("Digital Europe Programme funds AI skills training for small businesses"),
      false
    );
    assert.equal(namesAiSubject("Our AI strategy for Europe"), false);
    // And the specific phrases still match.
    assert.equal(namesAiSubject("obligations for general-purpose AI models"), true);
  });

  test("the hub cannot return itself or its policy furniture", () => {
    const urls = result.items.map((i) => i.url).join(" ");
    assert.ok(!urls.includes("/policies/"), "a policy page was collected as an update");
  });

  test("an undated AI Office item is dropped", () => {
    assert.ok(!result.items.some((i) => i.url.includes("ai-act-service-desk")));
    assert.match(result.rejected.join("\n"), /ai-act-service-desk[^\n]*no date/);
  });

  test("category and document come from the entry", () => {
    const [guidelines, code] = result.items;
    assert.equal(guidelines.category, "News");
    assert.equal(guidelines.publishedAt.slice(0, 10), "2026-09-10");
    assert.match(guidelines.documentUrl, /gpai-guidelines\.pdf$/);
    assert.equal(code.category, "Publication");
    assert.equal(code.publishedAt.slice(0, 10), "2026-07-22");
  });

  test("a hub that stops linking AI updates says so specifically", () => {
    // Distinguished from "nothing recognisable at all": only one of those
    // means the subject list needs a phrase adding.
    const stripped = AI_OFFICE_HTML.replace(/<ul class="updates">[\s\S]*?<\/ul>/i, "");
    const r = extractAiOffice(stripped, AI_OFFICE_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /none names an AI Office subject/i);
  });

  test("a page with no Digital Strategy content links names the shapes", () => {
    const moved = AI_OFFICE_HTML.replace(/\/en\/news\//g, "/en/stories/").replace(
      /\/en\/library\//g,
      "/en/docs/"
    );
    const r = extractAiOffice(moved, AI_OFFICE_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /none is a news or library address/i);
    assert.match(r.error, /\/en\/stories\/|\/en\/docs\//, r.error);
  });
});

/* ── COSO ───────────────────────────────────────────────────────────────── */

describe("COSO URL rules", () => {
  test("only the news index is an eligible surface", () => {
    assert.equal(acceptsCosoIndex(COSO_URL), true);
    assert.equal(acceptsCosoIndex("https://www.coso.org/news/"), true);
    // The page the source used to point at: a catalogue of evergreen
    // frameworks, not a stream.
    assert.equal(acceptsCosoIndex("https://www.coso.org/guidance"), false);
    assert.equal(acceptsCosoIndex("https://www.coso.org/"), false);
  });

  test("guidance landing pages are never news items", () => {
    assert.equal(
      isCosoNewsItem("https://www.coso.org/guidance/internal-control-integrated-framework"),
      false
    );
    assert.equal(isCosoNewsItem("https://www.coso.org/store/erm-framework-pdf"), false);
    assert.equal(isCosoNewsItem("https://www.coso.org/news/coso-names-new-board-chair"), true);
    assert.equal(isCosoNewsItem("https://www.coso.org/news"), false, "the index itself");
  });

  test("the category is read, and absent rather than guessed", () => {
    assert.equal(cosoCategory("<span>Press Release</span> COSO releases"), "Press release");
    assert.equal(cosoCategory("a research study of fraud risk"), "Research");
    assert.equal(cosoCategory("nothing recognisable"), "");
  });
});

describe("extracting COSO news", () => {
  const result = extractCoso(COSO_HTML, COSO_URL);

  test("it returns the genuine releases and nothing else", () => {
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.deepEqual(
      result.items.map((i) => new URL(i.url).pathname),
      [
        "/news/coso-releases-ai-internal-control-supplement",
        "/news/fraud-risk-management-study-published",
        "/news/coso-names-new-board-chair",
      ]
    );
  });

  test("the framework a release announces does not arrive as a second item", () => {
    // The specific failure the old /guidance URL would have produced: an
    // evergreen landing page collected beside the announcement, carrying the
    // announcement's date, on every poll and again at the next release.
    const urls = result.items.map((i) => i.url).join(" ");
    assert.ok(!urls.includes("/guidance/"), "a guidance landing page was collected");
    assert.ok(!urls.includes("/store/"), "a store page was collected");
  });

  test("the feature panel and the list row are one item", () => {
    const lead = result.items.filter((i) => i.url.includes("ai-internal-control-supplement"));
    assert.equal(lead.length, 1);
    assert.ok(!lead[0].url.includes("utm_campaign"));
  });

  test("an undated release is dropped", () => {
    assert.ok(!result.items.some((i) => i.url.includes("entry-with-no-date")));
    assert.match(result.rejected.join("\n"), /entry-with-no-date[^\n]*no date/);
  });

  test("dates, categories, teasers and documents come off the right card", () => {
    const [supplement, study, chair] = result.items;
    assert.equal(supplement.publishedAt.slice(0, 10), "2026-09-09");
    assert.equal(supplement.category, "Press release");
    assert.match(supplement.lead, /five components/);
    assert.match(supplement.documentUrl, /coso-ai-supplement-2026\.pdf$/);

    assert.equal(study.publishedAt.slice(0, 10), "2026-07-21");
    assert.equal(study.category, "Research");
    assert.equal(study.documentUrl, undefined, "a neighbouring card's document bled across");

    assert.equal(chair.publishedAt.slice(0, 10), "2026-05-14");
  });

  test("another body's newsroom is never in scope", () => {
    assert.ok(!result.items.some((i) => i.url.includes("aicpa")));
  });

  test("a page with no /news/<slug> links says what it found instead", () => {
    const moved = COSO_HTML.replace(/\/news\//g, "/press/");
    const r = extractCoso(moved, COSO_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /none matches \/news\/<slug>/);
    assert.match(r.error, /\/press\//, r.error);
  });

  test("an index that lost its dates is an outage, not a quiet week", () => {
    const undated = COSO_HTML.replace(/<span class="date">[^<]*<\/span>/gi, "");
    const r = extractCoso(undated, COSO_URL);
    assert.equal(r.ok, false);
    assert.match(r.error, /index structure has probably changed/i);
  });
});

/* ── The block boundary these three depend on ───────────────────────────── */

describe("an entry's date comes from its own block", () => {
  test("a container that closes right after the link still encloses it", () => {
    // Found while building the AI Office fixture. `</a></li>` with no
    // whitespace between made `enclosingBlock` reject its own block on an
    // off-by-one, so the search fell back to a character radius and swept in
    // the NEXT entry's date. Pretty-printed templates hid it; minified ones
    // would not have.
    const html =
      '<ul>' +
      '<li><a href="/news/undated-one">An entry with no date of its own</a></li>' +
      '<li><time datetime="2026-09-10">10 September 2026</time>' +
      '<a href="/news/dated-one">An entry that does carry a date</a></li>' +
      '</ul>';
    const r = extractCoso(html, COSO_URL);
    // The undated entry must not borrow the dated one's date.
    if (r.ok) {
      assert.ok(
        !r.items.some((i) => i.url.includes("undated-one")),
        "an undated entry took its neighbour's date"
      );
    }
    assert.match(r.ok ? r.rejected.join("\n") : r.error, /undated-one|no date/i);
  });
});

/* ── Comments are not content ───────────────────────────────────────────── */

describe("commented-out markup is not read as a page", () => {
  // Found by sabotaging a passing test: a comment in a fixture contained the
  // text "<h1>", the matcher opened it there and closed it on the next real
  // </h1>, and an extracted title came back containing the comment. The same
  // mechanism collects a commented-out <a href> as a live link, which brings
  // a withdrawn publication back on the next poll.

  test("a withdrawn APAS publication left in a comment is not collected", () => {
    const withGhost = VB_INDEX.replace(
      "</ul>",
      `<!-- withdrawn, kept for reference
         <li><a href="/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_99.html">Verlautbarung Nr. 99</a></li>
       --></ul>`
    );
    const out = extractApas(withGhost, VB_INDEX_URL);
    assert.ok(out.ok, out.ok ? "" : out.error);
    assert.ok(
      !out.pending.some((p) => p.url.includes("vb_verlautbarung_99")),
      "a commented-out publication was queued for fetching"
    );
  });

  test("a comment cannot swallow the element after it", () => {
    const html = `<!doctype html><html><body>
      <!-- the <h1> below is the real one -->
      <main><h1>Verlautbarung Nr. 31 zur Aktenführung bei Inspektionen</h1>
      <p>Stand: 03.03.2026</p></main></body></html>`;
    assert.equal(detailTitle(html), "Verlautbarung Nr. 31 zur Aktenführung bei Inspektionen");
    assert.equal(detailDate(html).slice(0, 10), "2026-03-03");
  });

  test("every extractor strips comments, not just the one that was caught", () => {
    // The defect was in a shared parsing assumption, so the fix has to be
    // shared too. Each extractor is given its own fixture with a publication
    // link commented out, and none of them may return it.
    // Read here rather than from the module-level constants further down the
    // file, which are not initialised yet when this suite is defined.
    const cases = [
      {
        name: "Anthropic",
        run: () =>
          extractAnthropic(
            fixture("anthropic-news.html").replace(
              "</body>",
              '<!-- <a href="/news/ghost-post">Ghost post that was pulled</a> --></body>'
            ),
            "https://www.anthropic.com/news"
          ),
        ghost: "ghost-post",
      },
      {
        name: "CEAOB",
        run: () =>
          extractCeaob(
            fixture("ceaob-page.html").replace(
              "</body>",
              '<!-- <a href="/ceaob-ghost-report_en">Ghost report (withdrawn)</a> --></body>'
            ),
            "https://finance.ec.europa.eu/regulation-and-supervision/expert-groups-comitology-and-other-committees/committee-european-auditing-oversight-bodies_en"
          ),
        ghost: "ghost",
      },
    ];
    for (const c of cases) {
      const out = c.run();
      assert.ok(out.ok, `${c.name}: ${out.ok ? "" : out.error}`);
      assert.ok(
        !out.items.some((i) => i.url.includes(c.ghost)),
        `${c.name} collected a commented-out link`
      );
    }
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
    enisa: { feed_url: ENISA_URL, jurisdictions: ["EU"] },
    aiOffice: { feed_url: AI_OFFICE_URL, jurisdictions: ["EU"] },
    coso: { feed_url: COSO_URL, jurisdictions: ["GLOBAL"] },
  };
  const RESULTS = {
    apas: extractApas(FIXTURE, PAGE),
    anthropic: extractAnthropic(ANTHROPIC, NEWS),
    ceaob: extractCeaob(CEAOB_HTML, CEAOB_PAGE),
    enisa: extractEnisa(ENISA_HTML, ENISA_URL),
    aiOffice: extractAiOffice(AI_OFFICE_HTML, AI_OFFICE_URL),
    coso: extractCoso(COSO_HTML, COSO_URL),
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
      const again = {
        apas: extractApas(FIXTURE, PAGE),
        anthropic: extractAnthropic(ANTHROPIC, NEWS),
        ceaob: extractCeaob(CEAOB_HTML, CEAOB_PAGE),
        enisa: extractEnisa(ENISA_HTML, ENISA_URL),
        aiOffice: extractAiOffice(AI_OFFICE_HTML, AI_OFFICE_URL),
        coso: extractCoso(COSO_HTML, COSO_URL),
      }[name];
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
