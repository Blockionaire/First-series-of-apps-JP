/**
 * What crawlers and AI assistants are told about this site.
 *
 * Two kinds of assertion, and they are testing two different kinds of
 * failure.
 *
 * The STRUCTURAL ones read the source. They exist because the canonical bug
 * they replace was invisible at runtime on every page that happened to be
 * correct: a canonical set on the root layout is inherited by every route
 * below it, so a page that forgets its own is not broken — it is silently
 * declared a duplicate of the homepage and dropped from the index. Nothing
 * fails, nothing logs, and you find out months later from a traffic chart.
 * The only way to catch the NEXT page that forgets is to assert that no page
 * forgets.
 *
 * The BEHAVIOURAL ones run the real server and read the real HTML, because
 * "the metadata helper returns the right object" is not the claim worth
 * making — "the page a crawler fetches carries the right tags" is.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = path.join(ROOT, "src/app");

// ─── Structural: the canonical trap cannot be re-set ──────────────────────

/** Every page.tsx under src/app, as repo-relative paths. */
function allPages(dir = APP, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allPages(p, out);
    else if (e.name === "page.tsx") out.push(path.relative(ROOT, p));
  }
  return out;
}

/**
 * Pages exempt from declaring a canonical, with the reason.
 *
 * Admin is disallowed in robots.txt and redirects unauthenticated visitors,
 * so it is never indexed. A page that only redirects never renders, so it has
 * no HTML to put a tag in — and the destination declares its own.
 */
function exemptReason(file, src) {
  if (file.includes("/admin/") || file.endsWith("app/admin/page.tsx")) return "admin, not indexable";
  if (/\b(permanentRedirect|redirect)\s*\(/.test(src)) return "redirect-only, renders nothing";
  return null;
}

describe("canonical URLs", () => {
  test("the root layout sets no site-wide canonical", () => {
    const src = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    // A canonical here is inherited by every route that does not override it.
    // That is how a new page silently becomes "a duplicate of the homepage".
    assert.ok(
      !/canonical\s*:/.test(src),
      "src/app/layout.tsx must not set alternates.canonical — every page declares its own"
    );
  });

  test("every indexable page declares its own canonical", () => {
    const offenders = [];
    for (const file of allPages()) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      if (exemptReason(file, src)) continue;
      const declares =
        /export\s+const\s+metadata\b/.test(src) || /export\s+(async\s+)?function\s+generateMetadata\b/.test(src);
      if (!declares) offenders.push(file);
    }
    assert.deepEqual(
      offenders,
      [],
      `these pages export no metadata, so they would inherit the layout's — each needs its own pageMeta({ path }):\n  ${offenders.join(
        "\n  "
      )}`
    );
  });

  test("the guard actually looks at something — there are pages to check", () => {
    // A filter bug that exempted everything would leave the test above
    // passing over an empty set, which is the classic vacuous green.
    const checked = allPages().filter((f) => !exemptReason(f, fs.readFileSync(path.join(ROOT, f), "utf8")));
    assert.ok(checked.length > 20, `expected the guard to cover the public pages, it covered ${checked.length}`);
  });
});

describe("publisher identity", () => {
  test("the Organization schema no longer carries a slogan as its legal name", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/seo.ts"), "utf8");
    assert.ok(
      !/Signal & Training for Audit Intelligence/.test(src),
      "the retired slogan must not survive anywhere in seo.ts"
    );
    assert.ok(
      /COMPANY\.legalName/.test(src),
      "legalName must come from lib/company.ts, the one record of the operator's registration"
    );
  });
});

// ─── Behavioural: against the real server ─────────────────────────────────

const PORT = Number(process.env.SEO_TEST_PORT ?? 3209);
const BASE = `http://127.0.0.1:${PORT}`;
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "seo-admin@test.eu";
const ADMIN_PASSWORD = "seo-admin-password";

let dataDir, server, cookie;

function startServer(extraEnv = {}) {
  return spawn("node", [STANDALONE], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      STAI_DATA_DIR: dataDir,
      APP_URL: BASE,
      STRIPE_SECRET_KEY: "",
      ANTHROPIC_API_KEY: "",
      RESEND_API_KEY: "",
      STAI_ADMIN_EMAIL: ADMIN_EMAIL,
      STAI_ADMIN_PASSWORD: ADMIN_PASSWORD,
      // Deliberately absent, and the tests below depend on that: with no key
      // configured nothing may be submitted anywhere, which is also what keeps
      // this suite from talking to a third party.
      INDEXNOW_KEY: "",
      ...extraEnv,
    },
    stdio: "ignore",
  });
}

async function waitHealthy() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function stop() {
  if (!server) return;
  const exited = new Promise((r) => server.once("exit", r));
  server.kill("SIGTERM");
  await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  server = null;
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  return res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
}

const get = (p) => fetch(BASE + p, { redirect: "manual" });
const text = async (p) => (await get(p)).text();
const db = () => new Database(path.join(dataDir, "stai.db"), { readonly: true });

/** Every JSON-LD object on a page, flattened — the component may emit arrays. */
function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const parsed = JSON.parse(m[1].replace(/\\u003c/g, "<"));
    out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  return out;
}

/**
 * The canonical URL a crawler reads off the page.
 *
 * Next normalises a resolved canonical to have no trailing slash, so the
 * homepage renders as the bare origin. That is the same resource either way —
 * the comparison strips a trailing slash so the assertions are about which
 * PAGE is claimed, which is the thing that can be wrong.
 */
const canonicalOf = (html) =>
  html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]?.replace(/\/$/, "");

/**
 * One published article, straight from the database the server is using.
 *
 * Deliberately the OLDEST published piece: `dateModified` is the later of
 * publication and the last write, so a piece dated in the future would pin
 * `dateModified` to its publication date and the "editing moves it" assertion
 * would be testing nothing.
 */
function anArticle() {
  const d = db();
  const row = d
    .prepare("SELECT * FROM articles WHERE status='published' ORDER BY published_at ASC, id ASC LIMIT 1")
    .get();
  d.close();
  assert.ok(row, "the seed should have published articles");
  return row;
}

/** Save through the real admin route, preserving the row's own field values. */
async function saveArticle(row, overrides = {}) {
  const res = await fetch(`${BASE}/api/admin/article`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      id: row.id,
      slug: row.slug,
      title: row.title,
      dek: row.dek,
      category: row.category,
      kind: row.kind,
      tags: JSON.parse(row.tags).join(","),
      author: row.author,
      author_role: row.author_role,
      published_at: row.published_at,
      reading_min: row.reading_min,
      featured: row.featured,
      urgency: row.urgency,
      premium: !!row.premium,
      status: "published",
      body_md: row.body_md,
      ...overrides,
    }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-seo-"));
  server = startServer();
  await waitHealthy();
  cookie = await login();
});

after(async () => {
  await stop();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const skip = hasBuild ? false : "no standalone build";

describe("rendered canonicals", { skip }, () => {
  test("the homepage canonicalises to itself", async () => {
    assert.equal(canonicalOf(await text("/")), BASE);
  });

  test("a section page canonicalises to the section, not to the homepage", async () => {
    // This is the regression the structural test exists to prevent; here it
    // is observed in the HTML a crawler actually receives.
    assert.equal(canonicalOf(await text("/news")), `${BASE}/news`);
    assert.equal(canonicalOf(await text("/plus")), `${BASE}/plus`);
  });

  test("an article canonicalises to the article", async () => {
    const a = anArticle();
    assert.equal(canonicalOf(await text(`/briefing/${a.slug}`)), `${BASE}/briefing/${a.slug}`);
  });
});

describe("article structured data", { skip }, () => {
  test("carries both dates, and never a dateModified before publication", async () => {
    const a = anArticle();
    const schema = jsonLd(await text(`/briefing/${a.slug}`)).find((s) => /NewsArticle/.test(String(s["@type"])));
    assert.ok(schema, "the article page should emit an article schema");

    assert.match(schema.datePublished, /^\d{4}-\d{2}-\d{2}T/, "datePublished should be a full ISO instant");
    assert.match(schema.dateModified, /^\d{4}-\d{2}-\d{2}T/, "dateModified should be a full ISO instant");
    assert.ok(
      Date.parse(schema.dateModified) >= Date.parse(schema.datePublished),
      `dateModified (${schema.dateModified}) must not precede datePublished (${schema.datePublished})`
    );
  });

  test("names the card that the share preview already uses", async () => {
    const a = anArticle();
    const schema = jsonLd(await text(`/briefing/${a.slug}`)).find((s) => /NewsArticle/.test(String(s["@type"])));
    assert.equal(schema.image?.["@type"], "ImageObject");
    assert.equal(schema.image?.url, `${BASE}/briefing/${a.slug}/opengraph-image`);
    assert.equal(schema.image?.width, 1200);
    assert.equal(schema.image?.height, 630);
  });

  test("editing a piece moves dateModified and the sitemap's lastmod with it", async () => {
    const a = anArticle();
    const url = `/briefing/${a.slug}`;
    const before = jsonLd(await text(url)).find((s) => /NewsArticle/.test(String(s["@type"])));
    const lastmodBefore = lastmodFor(await text("/sitemap.xml"), `${BASE}${url}`);

    // A save, through the real route, with the publication date untouched.
    const { status, json } = await saveArticle(a, { dek: `${a.dek} ` });
    assert.equal(status, 200, `the save should succeed: ${JSON.stringify(json)}`);

    const after = jsonLd(await text(url)).find((s) => /NewsArticle/.test(String(s["@type"])));
    assert.equal(after.datePublished, before.datePublished, "publication is an editorial fact and must not move");
    assert.ok(
      Date.parse(after.dateModified) > Date.parse(before.dateModified),
      `dateModified should advance on a save (was ${before.dateModified}, now ${after.dateModified})`
    );

    const lastmodAfter = lastmodFor(await text("/sitemap.xml"), `${BASE}${url}`);
    assert.ok(lastmodAfter, "the article should carry a lastmod in the sitemap");
    assert.notEqual(lastmodAfter, lastmodBefore, "the sitemap must show the change, or a crawler has no reason to return");
    assert.equal(Date.parse(lastmodAfter), Date.parse(after.dateModified), "both must state the same instant");
  });
});

/** The `<lastmod>` belonging to one `<url>` entry. */
function lastmodFor(xml, loc) {
  const entry = xml.split("<url>").find((u) => u.includes(`<loc>${loc}</loc>`));
  return entry?.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null;
}

describe("IndexNow", { skip }, () => {
  test("with no key configured, nothing is served and nothing is submitted", async () => {
    assert.equal((await get("/indexnow.txt")).status, 404, "there is no key, so there is nothing to prove");

    const a = anArticle();
    const { status, json } = await saveArticle(a);
    assert.equal(status, 200, "an unconfigured IndexNow must never fail a publish");
    assert.equal(json.ok, true);
    assert.equal(json.indexnow?.ok, false);
    assert.match(json.indexnow.reason, /INDEXNOW_KEY/);
  });

  test("a draft is never submitted", async () => {
    const a = anArticle();
    const { json } = await saveArticle(a, { status: "draft" });
    assert.match(json.indexnow.reason, /draft/, "asking a crawler to come and find a 404 costs credibility");
    await saveArticle(a, { status: "published" });
  });
});

describe("IndexNow key file", { skip }, () => {
  const KEY = "stai-indexnow-test-key-0123456789";

  before(async () => {
    await stop();
    server = startServer({ INDEXNOW_KEY: KEY });
    await waitHealthy();
  });

  test("serves exactly the key, as the protocol's ownership proof", async () => {
    const res = await get("/indexnow.txt");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/plain/);
    assert.equal((await res.text()).trim(), KEY, "the body is the whole contract — the key, nothing else");
  });

  test("a malformed key is treated as no key at all", async () => {
    // Restarted with a value the protocol would reject; a typo in the
    // environment must look like "off", not like submissions vanishing into
    // 403s nobody reads.
    await stop();
    server = startServer({ INDEXNOW_KEY: "short" });
    await waitHealthy();
    assert.equal((await get("/indexnow.txt")).status, 404);
  });
});
