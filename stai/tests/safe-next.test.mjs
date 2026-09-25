/**
 * `?next=` after sign-in may only point back into this site.
 *
 * Before the fix, /signup?next=https://attacker.example/phish sent a reader
 * who had just created an account straight to the attacker — confirmed in a
 * real browser (CODE_AUDIT.md, M1). The cases below are the spellings that
 * leave a site in a browser while looking like a path to a naive check.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { safeNext } from "../src/lib/safe-next.ts";

describe("safeNext", () => {
  test("keeps every destination the site itself links to", () => {
    for (const p of ["/account", "/ask", "/prompts/risk-assessment-memo", "/admin/editorial/sources", "/"]) {
      assert.equal(safeNext(p), p);
    }
    assert.equal(safeNext("/prompts?category=audit#top"), "/prompts?category=audit#top", "query and fragment survive");
  });

  test("refuses every way of naming another site", () => {
    for (const hostile of [
      "https://attacker.example/phish",
      "http://attacker.example",
      "//attacker.example/phish",
      "/\\attacker.example",
      "\\\\attacker.example",
      "/\t/attacker.example",
      "/\n/attacker.example",
      "https:attacker.example",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      " https://attacker.example",
    ]) {
      assert.equal(safeNext(hostile), "/account", `must refuse ${JSON.stringify(hostile)}`);
    }
  });

  test("falls back when there is nothing usable", () => {
    assert.equal(safeNext(null), "/account");
    assert.equal(safeNext(undefined), "/account");
    assert.equal(safeNext(""), "/account");
    assert.equal(safeNext("account"), "/account", "a bare relative path is not accepted");
    assert.equal(safeNext("//", "/"), "/", "the fallback is configurable");
  });

  test("the sign-in form routes through it", () => {
    // The helper is only a fix if the form uses it: a source check, because the
    // form is a client component with no server-side seam to call.
    const src = fs.readFileSync(path.join(import.meta.dirname, "../src/components/auth/AuthForm.tsx"), "utf8");
    assert.match(src, /const next = safeNext\(params\.get\("next"\)\)/);
    assert.doesNotMatch(src, /params\.get\("next"\)\s*\?\?/, "the raw parameter must not reach the router");
  });
});
