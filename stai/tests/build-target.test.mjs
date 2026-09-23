/**
 * The Node suites need the Node build in `.next`, and say so plainly.
 *
 * `npm run build` and `npm run cf:build` both write `.next` (OpenNext reads it
 * unconditionally; see next.config.ts). After a Workers build, `.next` holds
 * the stub that replaces the local database, and every server-backed suite
 * fails with 500s and "unable to open database file" — accurate, and no help
 * at all in finding the cause. This names it instead (CODE_AUDIT.md, L13).
 *
 * The marker is the stub's own error message: it is compiled into the server
 * output only when db.ts has been swapped for db-unavailable.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SERVER = path.join(ROOT, ".next/server");
const MARKER = "is not available on Cloudflare Workers";

function containsMarker(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (containsMarker(p)) return true;
    } else if (e.name.endsWith(".js") && fs.readFileSync(p, "utf8").includes(MARKER)) {
      return true;
    }
  }
  return false;
}

test("`.next` is a Node build, not a Workers build", { skip: !fs.existsSync(SERVER) && "no build yet" }, () => {
  assert.equal(
    containsMarker(SERVER),
    false,
    "`.next` holds the Cloudflare Workers build (from `npm run cf:build`). The Node test suites " +
      "need the Node build — run `npm run build`, then `npm test`. `npm run verify` runs both in " +
      "the right order."
  );
});
