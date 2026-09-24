/**
 * Links from the Inbox to original articles: only http(s) is ever an href.
 *
 * Item addresses come from other people's feeds and pages, and the Inbox is
 * read in a signed-in admin session. A `javascript:` URL rendered as a link
 * would run there on click.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { externalHref, hostOf } from "../src/lib/newsroom/links.ts";

describe("externalHref", () => {
  test("http and https addresses are linked", () => {
    assert.equal(externalHref("https://www.eba.europa.eu/publications/x"), "https://www.eba.europa.eu/publications/x");
    assert.equal(externalHref("  http://iaasb.org/a  "), "http://iaasb.org/a");
  });

  for (const bad of [
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example/x",
    "/admin/people",
    "not a url",
    "",
    null,
    undefined,
  ]) {
    test(`${JSON.stringify(bad)} is not a link`, () => {
      assert.equal(externalHref(bad), null);
    });
  }
});

describe("hostOf", () => {
  test("names the site without www", () => {
    assert.equal(hostOf("https://www.eba.europa.eu/a"), "eba.europa.eu");
    assert.equal(hostOf("https://iaasb.org/a"), "iaasb.org");
    assert.equal(hostOf("nonsense"), "");
  });
});
