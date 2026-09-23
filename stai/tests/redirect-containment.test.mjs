/**
 * Redirects never carry a request outside the publisher it was made for.
 *
 * A source is ingested at its registered domain's authority tier. When
 * redirects were followed blindly, a 301 from a Tier-1 regulator's feed path
 * to any other host would have filed that host's text under the regulator's
 * name (CODE_AUDIT.md, Phase C). Every hop is now checked against the
 * registered domain before it is requested — in the discovery fetcher, the
 * admin feed tester, and detail-page hydration.
 *
 * The test doubles record every URL asked for, so "not followed" is proven by
 * the off-domain host never being contacted, not by the result alone.
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

let containedFetch, MAX_REDIRECTS, fetchSource, FAILURE_OUTCOMES, probeFeed, hydrate;
before(async () => {
  ({ containedFetch, MAX_REDIRECTS } = await import("../src/lib/newsroom/contained-fetch.ts"));
  ({ fetchSource, FAILURE_OUTCOMES } = await import("../src/lib/newsroom/fetcher.ts"));
  ({ probeFeed } = await import("../src/lib/newsroom/probe.ts"));
  ({ hydrate } = await import("../src/lib/newsroom/extractors/hydrate.ts"));
});

const FEED = (host) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
  <item><title>Notice from ${host}</title><link>https://${host}/n/1</link><pubDate>Mon, 21 Sep 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

/**
 * A tiny web: `routes[url]` is either a Location to redirect to (string, with
 * an optional status via [status, location]) or a body to serve.
 */
function web(routes) {
  const asked = [];
  const fn = async (url, init = {}) => {
    asked.push(url);
    assert.equal(init.redirect, "manual", "every request follows redirects by hand");
    const r = routes[url];
    if (r === undefined) return new Response("not found", { status: 404 });
    if (typeof r === "object" && r.redirect) {
      return new Response(null, { status: r.status ?? 301, headers: r.redirect === true ? {} : { location: r.redirect } });
    }
    return new Response(r, { status: 200, headers: { "content-type": "application/rss+xml" } });
  };
  fn.asked = asked;
  fn.hosts = () => asked.map((u) => new URL(u).host);
  return fn;
}

const INIT = { headers: {} };

describe("containedFetch", () => {
  test("follows a redirect within the registered domain", async () => {
    const f = web({
      "https://www.eba.europa.eu/rss": { redirect: "https://www.eba.europa.eu/news/rss.xml" },
      "https://www.eba.europa.eu/news/rss.xml": FEED("www.eba.europa.eu"),
    });
    const r = await containedFetch(f, "https://www.eba.europa.eu/rss", INIT, "eba.europa.eu");
    assert.equal(r.ok, true);
    assert.equal(r.finalUrl, "https://www.eba.europa.eu/news/rss.xml");
    assert.equal(r.hops, 1);
  });

  test("follows into a subdomain of the registered domain, and resolves a relative Location", async () => {
    const f = web({
      "https://esma.europa.eu/feed": { redirect: "https://www.esma.europa.eu/feed/" },
      "https://www.esma.europa.eu/feed/": { redirect: "rss.xml", status: 302 },
      "https://www.esma.europa.eu/feed/rss.xml": FEED("esma"),
    });
    const r = await containedFetch(f, "https://esma.europa.eu/feed", INIT, "esma.europa.eu");
    assert.equal(r.ok, true);
    assert.equal(r.finalUrl, "https://www.esma.europa.eu/feed/rss.xml");
    assert.equal(r.hops, 2);
  });

  for (const [label, target] of [
    ["another host", "https://evil.example/feed.xml"],
    ["a lookalike that merely starts with the domain", "https://eba.europa.eu.evil.example/rss"],
    ["a lookalike that merely ends with it", "https://noteba.europa.eu/rss"],
    ["a parent of the registered domain", "https://europa.eu/rss"],
    ["a downgrade to plain http on the same host", "http://www.eba.europa.eu/rss.xml"],
  ]) {
    test(`does not follow a redirect to ${label}`, async () => {
      const f = web({
        "https://www.eba.europa.eu/rss": { redirect: target },
        [target]: FEED("attacker"),
      });
      const r = await containedFetch(f, "https://www.eba.europa.eu/rss", INIT, "eba.europa.eu");
      assert.equal(r.ok, false);
      assert.equal(r.kind, "off_domain");
      assert.equal(r.location, target);
      assert.match(r.error, /outside eba\.europa\.eu/);
      assert.deepEqual(f.asked, ["https://www.eba.europa.eu/rss"], "the target was never contacted");
    });
  }

  test("an off-domain hop later in a chain is caught at that hop", async () => {
    const f = web({
      "https://www.eba.europa.eu/a": { redirect: "https://www.eba.europa.eu/b" },
      "https://www.eba.europa.eu/b": { redirect: "https://cdn.other.example/b" },
      "https://cdn.other.example/b": FEED("other"),
    });
    const r = await containedFetch(f, "https://www.eba.europa.eu/a", INIT, "eba.europa.eu");
    assert.equal(r.kind, "off_domain");
    assert.equal(r.hops, 2);
    assert.ok(!f.hosts().includes("cdn.other.example"));
  });

  test("a redirect loop stops after the hop limit", async () => {
    const f = web({
      "https://www.eba.europa.eu/a": { redirect: "https://www.eba.europa.eu/b" },
      "https://www.eba.europa.eu/b": { redirect: "https://www.eba.europa.eu/a" },
    });
    const r = await containedFetch(f, "https://www.eba.europa.eu/a", INIT, "eba.europa.eu");
    assert.equal(r.ok, false);
    assert.equal(r.kind, "redirect_error");
    assert.ok(f.asked.length <= MAX_REDIRECTS + 1, `${f.asked.length} requests`);
  });

  test("a redirect without a Location is an error, not a success", async () => {
    const f = web({ "https://www.eba.europa.eu/a": { redirect: true } });
    const r = await containedFetch(f, "https://www.eba.europa.eu/a", INIT, "eba.europa.eu");
    assert.equal(r.kind, "redirect_error");
  });

  test("a runtime that followed anyway is held to the rule on its final address", async () => {
    const f = async () => {
      const res = new Response(FEED("attacker"), { status: 200 });
      Object.defineProperty(res, "url", { value: "https://evil.example/feed.xml" });
      return res;
    };
    const r = await containedFetch(f, "https://www.eba.europa.eu/rss", INIT, "eba.europa.eu");
    assert.equal(r.kind, "off_domain");
  });

  test("with no domain given, the starting host is the boundary", async () => {
    const f = web({ "https://efrag.org/rss": { redirect: "https://evil.example/rss" } });
    const r = await containedFetch(f, "https://efrag.org/rss", INIT);
    assert.equal(r.kind, "off_domain");
    assert.match(r.error, /outside efrag\.org/);
  });
});

describe("the discovery fetcher", () => {
  const source = {
    feed_url: "https://www.eba.europa.eu/rss",
    ingestion_method: "rss",
    etag: "",
    last_modified_header: "",
    domain: "eba.europa.eu",
  };

  test("an off-domain redirect ingests nothing and is recorded as a failure", async () => {
    const f = web({
      "https://www.eba.europa.eu/rss": { redirect: "https://evil.example/rss" },
      "https://evil.example/rss": FEED("evil.example"),
    });
    const r = await fetchSource(source, { fetch: f });
    assert.equal(r.outcome, "off_domain_redirect");
    assert.deepEqual(r.items, []);
    assert.match(r.error, /evil\.example/);
    assert.ok(FAILURE_OUTCOMES.includes("off_domain_redirect"), "the source's health shows it");
    assert.ok(!f.hosts().includes("evil.example"));
  });

  test("a moved feed on the same domain is still read", async () => {
    const f = web({
      "https://www.eba.europa.eu/rss": { redirect: "https://www.eba.europa.eu/rss.xml", status: 308 },
      "https://www.eba.europa.eu/rss.xml": FEED("www.eba.europa.eu"),
    });
    const r = await fetchSource(source, { fetch: f });
    assert.equal(r.outcome, "ok");
    assert.equal(r.items.length, 1);
  });
});

describe("Test source (the probe)", () => {
  test("reports an off-domain redirect with where it pointed, without going there", async () => {
    const f = web({
      "https://efrag.org/rss": { redirect: "https://feeds.thirdparty.example/efrag" },
      "https://feeds.thirdparty.example/efrag": FEED("thirdparty"),
    });
    const p = await probeFeed("https://efrag.org/rss", { fetch: f, domain: "efrag.org" });
    assert.equal(p.ok, false);
    assert.equal(p.redirected, true);
    assert.equal(p.finalUrl, "https://feeds.thirdparty.example/efrag");
    assert.match(p.error, /outside efrag\.org/);
    assert.equal(p.itemCount, 0);
    assert.ok(!f.hosts().includes("feeds.thirdparty.example"));
  });

  test("an in-domain redirect is followed and reported", async () => {
    const f = web({
      "https://efrag.org/rss": { redirect: "https://www.efrag.org/news/feed.xml" },
      "https://www.efrag.org/news/feed.xml": FEED("efrag.org"),
    });
    const p = await probeFeed("https://efrag.org/rss", { fetch: f, domain: "efrag.org" });
    assert.equal(p.ok, true);
    assert.equal(p.redirected, true);
    assert.equal(p.finalUrl, "https://www.efrag.org/news/feed.xml");
  });
});

describe("detail-page hydration", () => {
  const extractor = {
    name: "Test publisher",
    domain: "apasbafa.bund.de",
    detail: (html, url) => ({ ok: true, item: { url, title: html.match(/<h1>(.*?)<\/h1>/)?.[1] ?? "", publishedAt: "2026-09-21T00:00:00.000Z", lead: "" } }),
  };
  const pending = (...urls) => ({ ok: true, items: [], rejected: [], pending: urls.map((url) => ({ url })) });

  test("a publication page that redirects off-domain is not read", async () => {
    const f = web({
      "https://www.apasbafa.bund.de/a": "<h1>Genuine</h1>",
      "https://www.apasbafa.bund.de/b": { redirect: "https://evil.example/b" },
      "https://evil.example/b": "<h1>Planted</h1>",
    });
    const { result } = await hydrate(extractor, pending("https://www.apasbafa.bund.de/a", "https://www.apasbafa.bund.de/b"), { fetch: f });
    assert.equal(result.ok, true);
    assert.deepEqual(result.items.map((i) => i.title), ["Genuine"]);
    assert.ok(result.rejected.some((r) => /evil\.example.*outside apasbafa\.bund\.de/.test(r)), result.rejected.join("\n"));
    assert.ok(!f.hosts().includes("evil.example"));
  });

  test("a publication page moved within the domain is read at its new address", async () => {
    const f = web({
      "https://www.apasbafa.bund.de/a": { redirect: "/a-moved" },
      "https://www.apasbafa.bund.de/a-moved": "<h1>Moved</h1>",
    });
    const { result } = await hydrate(extractor, pending("https://www.apasbafa.bund.de/a"), { fetch: f });
    assert.deepEqual(result.items.map((i) => [i.title, i.url]), [["Moved", "https://www.apasbafa.bund.de/a-moved"]]);
  });
});
