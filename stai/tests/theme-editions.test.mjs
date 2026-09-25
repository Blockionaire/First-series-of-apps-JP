/**
 * The homepage's Paper and Night Editions.
 *
 * Two layers of check:
 *
 * 1. Static (always runs): the Night Edition remaps every token the Paper
 *    Edition declares, uses no pure black, and its text/background pairs meet
 *    WCAG AA — computed from the values in globals.css, so a palette tweak
 *    that costs readability fails here rather than in someone's browser.
 *
 * 2. In a browser (needs `npm run build` and the bundled Chromium): the
 *    toggle switches editions without a reload, persists the choice in the
 *    existing stai_theme cookie, the server renders that choice on the next
 *    request (no flash), and a reader who has chosen nothing still gets the
 *    approved Paper homepage and the unchanged dark site elsewhere.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSS = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

function block(selector) {
  const i = CSS.indexOf(`${selector} {`);
  assert.ok(i !== -1, `${selector} block should exist`);
  const body = CSS.slice(i, CSS.indexOf("}", i));
  const tokens = new Map();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) tokens.set(m[1], m[2].trim());
  return tokens;
}

const paper = block("html:has(.home-ed)");
const night = block('html[data-theme="dark"]:has(.home-ed)');

/** #rrggbb → relative luminance (WCAG 2.x). */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("Night Edition palette", () => {
  test("remaps every colour token the Paper Edition sets", () => {
    const colourTokens = [...paper.keys()].filter(
      (t) => t !== "--ed-serif" && !t.startsWith("--ed-plate-ink") && t !== "--ed-plate-line" && t !== "--ed-plate-rule"
    );
    const missing = colourTokens.filter((t) => !night.has(t));
    assert.deepEqual(missing, [], `set on paper but not remapped for night: ${missing.join(", ")}`);
  });

  test("uses no pure black", () => {
    for (const [t, v] of night) assert.doesNotMatch(v, /#000(000)?\b/i, `${t} is pure black`);
  });

  test("text on every Night surface meets WCAG AA", () => {
    const surfaces = ["--color-navy-900", "--color-navy-950", "--color-navy-850", "--ed-plate-bg"];
    const text = [
      ["--color-cream-100", 4.5],
      ["--color-cream-200", 4.5],
      ["--color-cream-400", 4.5],
      ["--ink-muted", 4.5],
      ["--ink-faint", 4.5],
    ];
    const failures = [];
    for (const s of surfaces) {
      for (const [t, min] of text) {
        const ratio = contrast(night.get(t), night.get(s));
        if (ratio < min) failures.push(`${t} on ${s}: ${ratio.toFixed(2)} < ${min}`);
      }
    }
    assert.deepEqual(failures, []);
  });

  test("the burgundy accent stays visible on the dark page (3:1, non-text)", () => {
    const ratio = contrast(night.get("--ed-accent"), night.get("--color-navy-900"));
    assert.ok(ratio >= 3, `accent on page: ${ratio.toFixed(2)}`);
  });

  test("the primary button and its hover are readable", () => {
    // Default: ivory button, page-colour label. Hover: burgundy surface, ivory label.
    assert.ok(contrast(night.get("--color-navy-900"), night.get("--color-cream-100")) >= 4.5);
    assert.ok(contrast(night.get("--ed-btn-hover-ink"), night.get("--ed-btn-hover-bg")) >= 4.5);
  });

  test("the manifesto band is a distinct step deeper than the page", () => {
    assert.ok(luminance(night.get("--ed-night")) < luminance(night.get("--color-navy-900")));
    assert.notEqual(night.get("--ed-night-edge"), "transparent");
  });
});

// ── In a browser ────────────────────────────────────────────────────────────
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const CHROMIUM = "/opt/pw-browsers/chromium";
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}
const skip =
  (!fs.existsSync(STANDALONE) && "needs `npm run build` first") ||
  ((!chromium || !fs.existsSync(CHROMIUM)) && "needs Playwright's Chromium");

const PORT = Number(process.env.THEME_TEST_PORT ?? 3231);
const BASE = `http://127.0.0.1:${PORT}`;
const PAPER = "rgb(246, 241, 232)"; // #f6f1e8
const NIGHT = "rgb(13, 19, 32)"; // #0d1320
const SITE_DARK = "rgb(14, 23, 38)"; // #0e1726, the site's own dark page

let server, dataDir, browser;

describe("theme toggle in a browser", { skip }, () => {
  before(async () => {
    // The standalone server serves /_next/static and /public from its own dir.
    fs.cpSync(path.join(ROOT, "public"), path.join(ROOT, ".next/standalone/public"), { recursive: true });
    fs.cpSync(path.join(ROOT, ".next/static"), path.join(ROOT, ".next/standalone/.next/static"), { recursive: true });
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-theme-"));
    server = spawn("node", [STANDALONE], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: "127.0.0.1", STAI_DATA_DIR: dataDir, APP_URL: BASE },
      stdio: "ignore",
    });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${BASE}/api/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    browser = await chromium.launch({ executablePath: CHROMIUM });
  });

  after(async () => {
    await browser?.close();
    if (server) {
      const exited = new Promise((r) => server.once("exit", r));
      server.kill("SIGTERM");
      await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
    }
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const pageBg = (p) => p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const toggle = (p) => p.locator("header button[aria-label^='Switch to']").first();

  test("no choice made: Paper homepage, dark site elsewhere, no data-theme rendered", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    assert.doesNotMatch(html.slice(0, html.indexOf(">", html.indexOf("<html")) + 1), /data-theme/);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`);
    assert.equal(await pageBg(p), PAPER);
    await p.goto(`${BASE}/about`);
    assert.equal(await pageBg(p), SITE_DARK);
    await ctx.close();
  });

  test("the toggle switches to Night without a reload and persists it", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`);
    await p.evaluate(() => (window.__sameDocument = true));
    await assert.doesNotReject(toggle(p).waitFor());
    assert.equal(await toggle(p).getAttribute("aria-label"), "Switch to dark theme");

    await toggle(p).click();
    assert.equal(await pageBg(p), NIGHT);
    assert.equal(await p.evaluate(() => window.__sameDocument), true, "no reload");
    const cookie = (await ctx.cookies()).find((c) => c.name === "stai_theme");
    assert.equal(cookie?.value, "dark");
    assert.equal(await toggle(p).getAttribute("aria-label"), "Switch to light theme");

    // The server renders the choice, so the next load paints Night first time.
    const res = await p.request.get(`${BASE}/`);
    assert.match(await res.text(), /<html[^>]*data-theme="dark"/);
    await p.reload();
    assert.equal(await pageBg(p), NIGHT);

    // And back to Paper.
    await toggle(p).click();
    assert.equal(await pageBg(p), PAPER);
    assert.equal((await ctx.cookies()).find((c) => c.name === "stai_theme")?.value, "light");
    await ctx.close();
  });
});
