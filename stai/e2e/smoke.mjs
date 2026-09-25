/**
 * STAI end-to-end smoke suite — safe to run against production.
 *
 *   node e2e/smoke.mjs                          # https://stai-ahead.com
 *   node e2e/smoke.mjs http://127.0.0.1:3000    # a local build
 *   node e2e/smoke.mjs --json report.json       # also write machine-readable output
 *   node e2e/smoke.mjs --max-crawl 40           # shorten the link crawl
 *
 * What it does: opens every public page, clicks every visible navigation item,
 * call to action and card link, crawls the same-origin links it finds, and
 * checks each one is reachable, lands where it says it will, renders a title,
 * and produces no uncaught client-side error.
 *
 * What it will not do is in e2e/safety.mjs, which is the file to read before
 * pointing this at a live site. In short: GET only, no form is ever submitted,
 * the analytics beacon is blocked so the run does not appear in the Growth
 * dashboard, and nothing under /admin is opened.
 *
 * Exits non-zero if anything failed.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { Report } from "./report.mjs";
import { BLOCKED_REQUESTS, crawlable } from "./safety.mjs";

/* ── Arguments ──────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = (argv.find((a) => !a.startsWith("--") && /^https?:\/\//.test(a)) ?? "https://stai-ahead.com").replace(/\/+$/, "");
const ORIGIN = new URL(BASE).origin;
const MAX_CRAWL = Number(flag("max-crawl", 120));
const JSON_OUT = flag("json", null);
const ARTIFACTS = flag("artifacts", path.join(import.meta.dirname, "artifacts"));

const report = new Report({ artifactDir: ARTIFACTS });
const startedAt = Date.now();

/* ── Browser plumbing ───────────────────────────────────────────────────── */

const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? undefined;

const VIEWPORTS = [
  { id: "desktop", width: 1366, height: 900, isMobile: false },
  { id: "mobile", width: 390, height: 844, isMobile: true },
];

/**
 * Per-page collector for client-side trouble.
 *
 * `errors` carries only uncaught exceptions and genuine console errors.
 * Resource failures are collected separately in `assets`, because the browser
 * logs a console error for the navigation's own response too — so on a page
 * that is SUPPOSED to be a 404, scraping console text reports the 404 as a
 * client-side error. Listening to responses instead lets the main document be
 * excluded by construction.
 */
function watchErrors(page) {
  const errors = [];
  const assets = [];
  page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // A failed beacon is this suite's own doing — see safety.mjs. Resource
    // failures are counted in `assets`, from the response, not from here.
    if (/\/api\/track/.test(t)) return;
    if (/Failed to load resource/i.test(t)) return;
    errors.push(`console: ${t.slice(0, 160)}`);
  });
  page.on("response", (r) => {
    if (r.request().isNavigationRequest()) return; // the page's own status is checked directly
    if (r.status() >= 400) assets.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  page.on("requestfailed", (r) => {
    if (r.isNavigationRequest()) return;
    const u = new URL(r.url());
    if (u.pathname === "/api/track") return; // blocked on purpose — see safety.mjs
    // Next prefetches every link in the viewport. Navigating away cancels the
    // ones still in flight, which surfaces as ERR_ABORTED. Counting those
    // reported a broken link for every nav item on every page — a page with
    // ten links "broke" ten times by being left. A cancelled request is not a
    // failed one.
    const why = r.failure()?.errorText ?? "";
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(why)) return;
    const headers = r.headers();
    if (headers["next-router-prefetch"] || headers["purpose"] === "prefetch") return;
    assets.push(`failed ${u.pathname} (${why || "unknown"})`);
  });
  errors.assets = assets;
  return errors;
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: false,
  });
  // Safety rule 2: the beacon never leaves the browser.
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    const blocked = BLOCKED_REQUESTS.find((b) => {
      try {
        return b.match(url);
      } catch {
        return false;
      }
    });
    return blocked ? route.abort() : route.continue();
  });
  const page = await ctx.newPage();
  return { ctx, page, errors: watchErrors(page) };
}

/**
 * Click a link and wait for the URL to become what it promised.
 *
 * `waitForLoadState` is not enough. Next's <Link> performs a client-side
 * navigation — no new document — so waitForLoadState resolves immediately
 * against the page you are still on, and reading page.url() straight after a
 * click reports the OLD path. Four checks in the first run failed that way and
 * looked like broken links. waitForURL covers both soft and hard navigation.
 */
async function clickTo(page, locator, expected, area, name) {
  if (!(await locator.isVisible().catch(() => false))) {
    report.fail(area, name, "link is present but not visible");
    return false;
  }
  await locator.click();
  try {
    await page.waitForURL((u) => new URL(u).pathname === expected, { timeout: 15_000 });
  } catch {
    /* fall through to the explicit comparison below, which reports properly */
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const landed = new URL(page.url()).pathname;
  if (landed !== expected) {
    const shot = await report.shotOnFailure(page, `${area}-${name}`);
    report.fail(area, name, `clicked ${expected}, landed on ${landed}`, { screenshot: shot });
    return false;
  }
  return true;
}

/**
 * Open a path and assert the basics every page owes a reader.
 * Returns the response status and the collected errors.
 */
async function openAndCheck(page, errors, pathname, area, { expectStatus = 200, expectPath = null } = {}) {
  errors.length = 0;
  let res;
  try {
    res = await page.goto(BASE + pathname, { waitUntil: "domcontentloaded", timeout: 30_000 });
  } catch (e) {
    report.fail(area, `GET ${pathname}`, e.message);
    return { status: 0, ok: false };
  }
  const status = res?.status() ?? 0;
  const landed = new URL(page.url()).pathname;

  const wanted = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  if (!wanted.includes(status)) {
    const shot = await report.shotOnFailure(page, `${area}-${pathname}`);
    report.fail(area, `GET ${pathname}`, `status ${status}, expected ${wanted.join("/")}`, { screenshot: shot });
    return { status, ok: false };
  }

  if (expectPath && landed !== expectPath) {
    report.fail(area, `GET ${pathname}`, `landed on ${landed}, expected ${expectPath}`);
    return { status, ok: false };
  }

  if (status === 200) {
    const title = (await page.title()).trim();
    if (!title) {
      report.fail(area, `${pathname} title`, "the page renders no <title>");
    } else {
      report.pass(area, `${pathname}`, `${status} · "${title.slice(0, 54)}"`);
    }
    const h1 = await page.locator("h1").count();
    if (h1 === 0) report.warn(area, `${pathname} heading`, "no <h1> on the page");
  } else {
    report.pass(area, `${pathname}`, `${status}`);
  }

  await page.waitForTimeout(220); // let hydration settle before reading errors
  if (errors.length) {
    const shot = await report.shotOnFailure(page, `err-${pathname}`);
    report.fail(area, `${pathname} client errors`, errors.slice(0, 3).join(" | "), { screenshot: shot });
  }
  if (errors.assets?.length) {
    for (const a of new Set(errors.assets)) report.broken(pathname, a, "subresource did not load");
    report.warn(area, `${pathname} assets`, `${new Set(errors.assets).size} subresource(s) failed`);
    errors.assets.length = 0;
  }
  return { status, ok: true };
}

/* ── The named public surface ───────────────────────────────────────────── */

const PUBLIC_PAGES = [
  ["/", "homepage"],
  ["/news", "News"],
  ["/insights", "Insights"],
  ["/prompts", "Prompts"],
  ["/podcast", "Podcast"],
  ["/plus", "STAI+"],
  ["/ai-act", "AI Act"],
  ["/training", "Training"],
  ["/firms", "For firms"],
  ["/assessment", "Assessment"],
  ["/research", "Research"],
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/login", "Login"],
  ["/signup", "Signup"],
  ["/legal/privacy", "Legal"],
  ["/legal/terms", "Legal"],
  ["/legal/company", "Legal"],
];

/* ── Runner ─────────────────────────────────────────────────────────────── */

const browser = await chromium.launch({ executablePath: EXECUTABLE });

/* 1. Redirects and refusals, checked at the request level. ---------------- */
{
  const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— redirects and refusals —");

  // www → apex. Only meaningful against a real domain.
  if (/^https:\/\/stai-ahead\.com$/.test(ORIGIN)) {
    try {
      const res = await page.request.get("https://www.stai-ahead.com/", { maxRedirects: 0 });
      const loc = res.headers()["location"] ?? "";
      if ([301, 302, 307, 308].includes(res.status()) && /stai-ahead\.com/.test(loc)) {
        report.pass("redirects", "www → apex", `${res.status()} → ${loc}`);
      } else {
        report.fail("redirects", "www → apex", `status ${res.status()}, location "${loc}"`);
      }
    } catch (e) {
      report.fail("redirects", "www → apex", e.message);
    }
  } else {
    report.untested("redirects", "www → apex", `only testable against the real domain; base is ${ORIGIN}`);
  }

  // The Briefing index moved to News.
  try {
    const res = await page.request.get(`${BASE}/briefing`, { maxRedirects: 0 });
    const loc = res.headers()["location"] ?? "";
    if ([301, 308].includes(res.status()) && loc.endsWith("/news")) {
      report.pass("redirects", "The Briefing → News", `${res.status()} → ${loc}`);
    } else {
      report.fail("redirects", "The Briefing → News", `status ${res.status()}, location "${loc}"`);
    }
  } catch (e) {
    report.fail("redirects", "The Briefing → News", e.message);
  }

  // Admin must refuse an anonymous caller.
  try {
    const res = await page.request.get(`${BASE}/admin`, { maxRedirects: 0 });
    const loc = res.headers()["location"] ?? "";
    if ([302, 303, 307, 308].includes(res.status()) && /\/login/.test(loc)) {
      report.pass("auth", "/admin refuses anonymous callers", `${res.status()} → ${loc}`);
    } else if (res.status() === 404) {
      report.pass("auth", "/admin refuses anonymous callers", "404");
    } else {
      report.fail("auth", "/admin refuses anonymous callers", `status ${res.status()}, location "${loc}"`);
    }
  } catch (e) {
    report.fail("auth", "/admin refuses anonymous callers", e.message);
  }

  // 404 handling.
  await openAndCheck(page, errors, "/this-page-does-not-exist-" + Date.now(), "404", { expectStatus: 404 });

  await ctx.close();
}

/* 2. Every public page, in both viewports. -------------------------------- */
for (const viewport of VIEWPORTS) {
  const { ctx, page, errors } = await newPage(browser, viewport);
  console.log(`\n— public pages · ${viewport.id} ${viewport.width}px —`);
  for (const [pathname, area] of PUBLIC_PAGES) {
    await openAndCheck(page, errors, pathname, `${area}/${viewport.id}`);
  }
  await ctx.close();
}

/* 3. Header navigation, clicked rather than fetched. ---------------------- */
{
  const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— header navigation (desktop, clicked) —");
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const items = await page.$$eval("header nav a", (as) =>
    as.map((a) => ({ href: a.getAttribute("href"), label: a.textContent.trim() }))
  );
  if (!items.length) report.fail("header", "navigation", "no nav links found in the header");

  for (const item of items) {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const link = page.locator(`header nav a[href="${item.href}"]`).first();
    if (!(await link.isVisible())) {
      report.fail("header", item.label, "link is present but not visible");
      continue;
    }
    errors.length = 0;
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.request().isNavigationRequest() && r.url().startsWith(BASE), { timeout: 20_000 }).catch(() => null),
      link.click(),
    ]);
    await page.waitForLoadState("domcontentloaded");
    const landed = new URL(page.url()).pathname;
    const status = res?.status() ?? 200;
    if (landed !== item.href) {
      report.fail("header", item.label, `clicked ${item.href}, landed on ${landed}`);
    } else if (status >= 400) {
      const shot = await report.shotOnFailure(page, `header-${item.label}`);
      report.fail("header", item.label, `status ${status}`, { screenshot: shot });
    } else {
      report.pass("header", item.label, `${item.href} · ${status}`);
    }
  }

  // Logo returns home from a deep page.
  await page.goto(BASE + "/prompts", { waitUntil: "domcontentloaded" });
  const logo = page.locator('header a[aria-label="STAI home"]').first();
  if (await clickTo(page, logo, "/", "header", "logo returns home")) {
    report.pass("header", "logo returns home", "/prompts → /");
  }
  await ctx.close();
}

/* 4. Mobile navigation. --------------------------------------------------- */
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
  console.log("\n— mobile navigation —");
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const menu = page.getByRole("button", { name: /^menu$/i }).first();
  if (!(await menu.isVisible().catch(() => false))) {
    report.fail("mobile nav", "Menu button", "not visible at 390px");
  } else {
    await menu.click();
    await page.waitForTimeout(350);
    const panel = page.locator("#mobile-menu");
    const box = await panel.boundingBox().catch(() => null);
    if (!box || box.height < 200) {
      const shot = await report.shotOnFailure(page, "mobile-nav-panel");
      report.fail("mobile nav", "panel opens", box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "no panel", { screenshot: shot });
    } else {
      report.pass("mobile nav", "panel opens", `${Math.round(box.width)}×${Math.round(box.height)}`);

      const links = await panel.locator("a[href^='/']").evaluateAll((as) =>
        as.map((a) => ({ href: a.getAttribute("href"), label: a.textContent.trim() }))
      );
      report.pass("mobile nav", "panel links", `${links.length} found`);

      const first = panel.locator("a[href^='/']").nth(1); // 0 is the logo
      const href = await first.getAttribute("href");
      if (await clickTo(page, first, href, "mobile nav", "a menu link navigates")) {
        report.pass("mobile nav", "a menu link navigates", `${href}`);
      }

      // And the panel closes behind it.
      if ((await page.locator("#mobile-menu").count()) === 0) {
        report.pass("mobile nav", "panel closes after navigation");
      } else {
        report.fail("mobile nav", "panel closes after navigation", "panel still in the DOM");
      }
    }
  }
  await ctx.close();
}

/* 5. Footer navigation. --------------------------------------------------- */
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— footer navigation —");
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const links = await page.$$eval("footer a[href^='/']", (as) =>
    as.map((a) => ({ href: a.getAttribute("href"), label: a.textContent.trim() }))
  );
  if (!links.length) report.fail("footer", "navigation", "no internal links found in the footer");
  for (const l of links) {
    const res = await page.request.get(BASE + l.href, { maxRedirects: 5 });
    if (res.status() >= 400) {
      report.fail("footer", l.label || l.href, `${l.href} · status ${res.status()}`);
    } else {
      report.pass("footer", l.label || l.href, `${l.href} · ${res.status()}`);
    }
  }
  await ctx.close();
}

/* 6. Cards into detail pages. --------------------------------------------- */
{
  const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— cards into detail pages —");

  for (const [index, sel, area] of [
    ["/news", "a[href^='/briefing/']", "article"],
    ["/prompts", "a[href^='/prompts/']", "prompt"],
  ]) {
    await page.goto(BASE + index, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const cards = page.locator(sel);
    const n = await cards.count();
    if (n === 0) {
      report.warn(area, `${index} cards`, "no cards on the index — nothing published in this section?");
      continue;
    }
    report.pass(area, `${index} cards`, `${n} found`);

    const first = cards.first();
    const href = await first.getAttribute("href");
    errors.length = 0;
    if (!(await clickTo(page, first, href, area, "card → detail"))) continue;
    const title = (await page.title()).trim();
    const h1 = await page.locator("h1").count();
    if (!title) report.fail(area, "detail title", `${href} renders no <title>`);
    else if (h1 === 0) report.fail(area, "detail heading", `${href} renders no <h1>`);
    else report.pass(area, "card → detail", `${href} · "${title.slice(0, 44)}"`);
    if (errors.length) report.fail(area, "detail client errors", errors.slice(0, 2).join(" | "));
  }
  await ctx.close();
}

/* 7. Calls to action across the key pages. -------------------------------- */
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— calls to action —");
  const seen = new Set();
  for (const pathname of ["/", "/news", "/prompts", "/plus", "/ai-act", "/firms", "/training", "/podcast"]) {
    await page.goto(BASE + pathname, { waitUntil: "domcontentloaded" });
    const ctas = await page.$$eval("a.btn", (as) =>
      as.map((a) => ({
        href: a.getAttribute("href"),
        label: a.textContent.trim(),
        visible: !!(a.offsetWidth || a.offsetHeight || a.getClientRects().length),
        inForm: !!a.closest("form"),
      }))
    );
    for (const cta of ctas) {
      if (!cta.href || !cta.href.startsWith("/")) continue;
      const key = `${cta.href}|${cta.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!cta.visible) {
        report.warn("CTA", cta.label || cta.href, `on ${pathname} — present but not visible`);
        continue;
      }
      const res = await page.request.get(BASE + cta.href, { maxRedirects: 5 });
      if (res.status() >= 400) {
        report.fail("CTA", cta.label || cta.href, `${cta.href} · status ${res.status()} (on ${pathname})`);
      } else {
        report.pass("CTA", cta.label || cta.href, `${cta.href} · ${res.status()}`);
      }
    }
  }
  await ctx.close();
}

/* 8. Form entry points — rendered, never submitted. ----------------------- */
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— form entry points (not submitted) —");
  const FORMS = [
    ["/login", "Sign in", "submitting would attempt authentication"],
    ["/signup", "Create account", "submitting would create a real user"],
    ["/plus", "STAI+ early access", "submitting would add a row to the waiting list"],
    ["/contact", "Contact", "submitting would send a real enquiry"],
    ["/training", "Training enquiry", "submitting would send a real enquiry"],
    ["/firms", "Firm enquiry", "submitting would send a real enquiry"],
    ["/assessment", "AI-readiness assessment", "submitting would store a real assessment"],
    ["/", "Brief waitlist", "submitting would subscribe a real address"],
  ];
  for (const [pathname, name, why] of FORMS) {
    await page.goto(BASE + pathname, { waitUntil: "domcontentloaded" });
    const forms = await page.locator("form").count();
    const inputs = await page.locator("form input, form textarea, form select").count();
    const submits = await page.locator("form button[type=submit], form button:not([type])").count();
    if (forms === 0) {
      report.warn("forms", `${name} (${pathname})`, "no form found on the page");
    } else {
      report.pass("forms", `${name} (${pathname})`, `${forms} form(s), ${inputs} field(s), ${submits} submit control(s)`);
    }
    report.untested("forms", `${name} submission`, why);
  }
  report.untested("auth", "Signed-in flows", "the suite never signs in: account, bookmarks, saved answers, Ask STAI quota and every /admin screen are unverified");
  report.untested("admin", "Back office", "not opened by design — only the /admin redirect is checked");
  await ctx.close();
}

/* 9. Same-origin link crawl. ---------------------------------------------- */
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  console.log("\n— link crawl —");
  const queue = PUBLIC_PAGES.map(([p]) => p);
  const seenPages = new Set();
  const checked = new Map(); // href → status
  let opened = 0;

  while (queue.length && opened < MAX_CRAWL) {
    const pathname = queue.shift();
    if (seenPages.has(pathname)) continue;
    seenPages.add(pathname);

    let res;
    try {
      res = await page.goto(BASE + pathname, { waitUntil: "domcontentloaded", timeout: 25_000 });
    } catch (e) {
      report.broken("(crawl)", pathname, e.message);
      continue;
    }
    opened++;
    if ((res?.status() ?? 0) >= 400) continue;

    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const href of hrefs) {
      if (!href || href.startsWith("#")) continue;
      if (!crawlable(href, ORIGIN)) continue;
      const target = new URL(href, ORIGIN).pathname;
      if (!checked.has(target)) {
        const r = await page.request.get(BASE + target, { maxRedirects: 5 }).catch(() => null);
        const status = r?.status() ?? 0;
        checked.set(target, status);
        if (status === 0 || status >= 400) {
          report.broken(pathname, target, status === 0 ? "request failed" : `status ${status}`);
        }
      }
      if (!seenPages.has(target) && queue.length + opened < MAX_CRAWL) queue.push(target);
    }
  }

  report.crawled = checked.size;
  const bad = [...checked.values()].filter((s) => s === 0 || s >= 400).length;
  if (bad === 0) report.pass("crawl", "same-origin links", `${checked.size} unique URLs, all reachable`);

  else report.fail("crawl", "same-origin links", `${bad} of ${checked.size} unreachable — see BROKEN LINKS`);
  if (queue.length) {
    report.warn("crawl", "crawl budget", `stopped at ${MAX_CRAWL} pages, ${queue.length} still queued — raise with --max-crawl`);
  }
  await ctx.close();
}

await browser.close();

const failures = report.print(BASE, startedAt);
if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify(report.toJson(), null, 2));
  console.log(`JSON written to ${JSON_OUT}\n`);
}
process.exit(failures ? 1 : 0);
