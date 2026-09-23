/**
 * The Markdown sanitiser is the only thing between an article body and
 * `dangerouslySetInnerHTML` on a public page.
 *
 * Article bodies are written by the admin, so this is defence in depth rather
 * than the front door — but it is the ONLY depth there is, and before this file
 * no test touched lib/markdown.ts at all: widening the allowlist to permit
 * `javascript:` links and script-capable tags passed all 723 tests
 * (CODE_AUDIT.md, sabotage S9).
 *
 * Each case below is something a paste from a hostile or careless source could
 * carry. The assertion is always about the OUTPUT: whatever the input, the
 * rendered HTML must not contain a way to run script.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// lib/markdown.ts imports "./config" without an extension, as Next resolves it.
// Node's type stripping does not, so retry relative specifiers with ".ts".
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

let renderMarkdown;
before(async () => {
  ({ renderMarkdown } = await import("../src/lib/markdown.ts"));
});

const html = (md) => renderMarkdown(md).html;

/** Nothing in the output may be able to execute. */
function assertInert(out, what) {
  assert.doesNotMatch(out, /<script/i, `${what}: a <script> survived`);
  assert.doesNotMatch(out, /javascript:/i, `${what}: a javascript: URL survived`);
  assert.doesNotMatch(out, /\son[a-z]+\s*=/i, `${what}: an inline event handler survived`);
  assert.doesNotMatch(out, /<(iframe|object|embed|svg|math|img|style|form|input|base|meta|link)\b/i, `${what}: a tag outside the allowlist survived`);
  assert.doesNotMatch(out, /\b(href|src)\s*=\s*"?\s*data:/i, `${what}: a data: URL survived`);
}

describe("the Markdown sanitiser", () => {
  test("drops raw <script>", () => {
    assertInert(html("Hello\n\n<script>alert(1)</script>"), "script block");
    assertInert(html("Inline <script>alert(1)</script> here"), "inline script");
  });

  test("drops javascript: links, however they are spelled", () => {
    for (const href of ["javascript:alert(1)", "JavaScript:alert(1)", "java\tscript:alert(1)", " javascript:alert(1)"]) {
      assertInert(html(`[click](${href})`), `markdown link ${JSON.stringify(href)}`);
      assertInert(html(`<a href="${href}">click</a>`), `html link ${JSON.stringify(href)}`);
    }
  });

  test("drops inline event handlers", () => {
    assertInert(html('<img src="x" onerror="alert(1)">'), "img onerror");
    assertInert(html('<p onclick="alert(1)">text</p>'), "p onclick");
    assertInert(html('<a href="https://example.com" onmouseover="alert(1)">x</a>'), "a onmouseover");
  });

  test("drops SVG, including the SMIL href trick", () => {
    assertInert(
      html('<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text y="20">x</text></a></svg>'),
      "svg smil"
    );
  });

  test("drops data: URLs and embedding tags", () => {
    assertInert(html('<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'), "data link");
    assertInert(html('<iframe src="https://example.com"></iframe>'), "iframe");
    assertInert(html('<object data="x.swf"></object><embed src="x.swf">'), "object/embed");
    assertInert(html("<style>body{background:url(javascript:alert(1))}</style>"), "style");
  });

  test("drops protocol-relative links", () => {
    const out = html('<a href="//evil.example/path">x</a>');
    assert.doesNotMatch(out, /href="\/\//, "a //host link survived");
  });

  test("drops style attributes", () => {
    const out = html('<p style="position:fixed;inset:0">overlay</p>');
    assert.doesNotMatch(out, /style=/i);
    assert.match(out, /overlay/, "the text itself is kept");
  });

  // The other half: a sanitiser that strips everything also passes the tests
  // above. These pin down that ordinary editorial Markdown still renders.
  test("keeps ordinary editorial Markdown", () => {
    const { html: out, toc } = renderMarkdown(
      "## What changed\n\nThe **FRC** published [its guidance](https://www.frc.org.uk/news).\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |"
    );
    assert.match(out, /<h2 id="what-changed">What changed<\/h2>/);
    assert.match(out, /<strong>FRC<\/strong>/);
    assert.match(out, /<a href="https:\/\/www\.frc\.org\.uk\/news"[^>]*>its guidance<\/a>/);
    assert.match(out, /<ul>\s*<li>one<\/li>/);
    assert.match(out, /<table>/);
    assert.deepEqual(toc, [{ id: "what-changed", text: "What changed" }]);
  });

  test("external links open safely", () => {
    const out = html("[x](https://example.com)");
    assert.match(out, /rel="noopener noreferrer nofollow"/);
    assert.match(out, /target="_blank"/);
  });

  test("mailto links are kept", () => {
    assert.match(html("[mail](mailto:editor@example.com)"), /href="mailto:editor@example\.com"/);
  });
});
