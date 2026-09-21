import fs from "node:fs";
import path from "node:path";

/**
 * The four buckets, and how a result gets into one.
 *
 * `untested` is a first-class outcome rather than a silent omission. A smoke
 * suite against production cannot sign in and cannot submit a form, and a
 * report that simply does not mention those flows reads as if they passed.
 * Naming them, with the reason, is the difference between "we checked
 * everything we could" and "we checked everything".
 */
export class Report {
  constructor({ artifactDir }) {
    this.rows = [];
    this.artifactDir = artifactDir;
    this.brokenLinks = [];
    this.crawled = 0;
  }

  #add(status, area, name, detail, extra = {}) {
    this.rows.push({ status, area, name, detail, ...extra });
    const mark = { pass: "  ok  ", fail: "FAIL  ", warn: " warn ", untested: " skip " }[status];
    const line = `${mark}${area ? `[${area}] ` : ""}${name}${detail ? ` — ${detail}` : ""}`;
    console.log(line);
  }

  pass(area, name, detail = "") {
    this.#add("pass", area, name, detail);
  }
  fail(area, name, detail = "", extra = {}) {
    this.#add("fail", area, name, detail, extra);
  }
  warn(area, name, detail = "") {
    this.#add("warn", area, name, detail);
  }
  untested(area, name, reason) {
    this.#add("untested", area, name, reason);
  }

  broken(from, href, detail) {
    this.brokenLinks.push({ from, href, detail });
  }

  /** Screenshot, but only when something failed — successes produce no files. */
  async shotOnFailure(page, label) {
    try {
      fs.mkdirSync(this.artifactDir, { recursive: true });
      const file = path.join(this.artifactDir, `${label.replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}.png`);
      await page.screenshot({ path: file, fullPage: false });
      return file;
    } catch {
      return null;
    }
  }

  counts() {
    const c = { pass: 0, fail: 0, warn: 0, untested: 0 };
    for (const r of this.rows) c[r.status]++;
    return c;
  }

  print(baseUrl, startedAt) {
    const c = this.counts();
    const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
    const bar = "─".repeat(66);

    console.log(`\n${bar}`);
    console.log(`STAI end-to-end smoke — ${baseUrl}`);
    console.log(`${this.rows.length} checks, ${this.crawled} URLs crawled, ${secs}s`);
    console.log(bar);
    console.log(`  Passed    ${String(c.pass).padStart(4)}`);
    console.log(`  Failed    ${String(c.fail).padStart(4)}`);
    console.log(`  Warning   ${String(c.warn).padStart(4)}`);
    console.log(`  Untested  ${String(c.untested).padStart(4)}   (authentication or destructive action required)`);
    console.log(bar);

    const section = (title, status) => {
      const rows = this.rows.filter((r) => r.status === status);
      if (!rows.length) return;
      console.log(`\n${title}`);
      for (const r of rows) {
        console.log(`  · ${r.area ? `[${r.area}] ` : ""}${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
        if (r.screenshot) console.log(`      screenshot: ${r.screenshot}`);
      }
    };

    section("FAILED", "fail");
    section("WARNINGS", "warn");
    section("UNTESTED — authentication or destructive action required", "untested");

    if (this.brokenLinks.length) {
      console.log(`\nBROKEN LINKS (${this.brokenLinks.length})`);
      for (const b of this.brokenLinks) {
        console.log(`  · ${b.href}`);
        console.log(`      found on ${b.from} — ${b.detail}`);
      }
    } else {
      console.log("\nBROKEN LINKS  none");
    }

    console.log(`\n${c.fail === 0 ? "No failures." : `${c.fail} failure(s) — see above.`}\n`);
    return c.fail;
  }

  toJson() {
    return {
      counts: this.counts(),
      crawled: this.crawled,
      rows: this.rows,
      brokenLinks: this.brokenLinks,
    };
  }
}
