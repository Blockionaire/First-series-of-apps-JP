/**
 * Every CSS variable a component references must actually exist.
 *
 * ── The bug this exists to stop ─────────────────────────────────────────
 * The source registry's review dropdown shipped with
 * `style={{ background: "var(--ink-bg, #14110e)" }}` on its <option>
 * elements. `--ink-bg` was never defined anywhere, so the literal fallback
 * applied — in BOTH themes. On the dark page it looked deliberate; on the
 * light one it rendered near-black behind dark navy text, and the menu was
 * unreadable.
 *
 * The same shape was in four other places, all with plausible-looking
 * fallbacks pinned to the dark theme: `var(--danger, #d88)` and
 * `var(--gold-300, #c9a84c)`, the latter defeating the light theme's
 * deliberate deepening of gold to #8f7326 for contrast on beige.
 *
 * A fallback makes this invisible. Nothing errors, nothing looks wrong in the
 * theme you happen to be developing in, and the failure only appears for
 * somebody using the other one. So the rule is simply: reference tokens that
 * exist, and let them remap.
 *
 * This runs on source text rather than a browser because the defect is
 * static — it is a name that was never declared — and a test that needs a
 * build, a server and a login to catch a typo would not be run.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSS = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

/** Every `--name:` declared anywhere in globals.css, including @theme. */
function declared() {
  const names = new Set();
  for (const m of CSS.matchAll(/(--[a-z0-9-]+)\s*:/gi)) names.add(m[1]);
  return names;
}

/** Every .tsx under src/, recursively. */
function components(dir = path.join(ROOT, "src"), out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) components(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("theme tokens", () => {
  const defined = declared();
  const files = components();

  test("globals.css was found and parsed", () => {
    // Guards the guard: a regex that silently matched nothing would make every
    // assertion below vacuously pass.
    assert.ok(files.length > 20, `expected many components, found ${files.length}`);
    assert.ok(defined.size > 20, `expected many tokens, found ${defined.size}`);
    assert.ok(defined.has("--ink-faint"), "a known token should be found");
    assert.ok(defined.has("--color-gold-300"), "including Tailwind @theme tokens");
    assert.ok(!defined.has("--ink-bg"), "and the invented one should not be");
  });

  test("every var() a component uses is defined in globals.css", () => {
    const missing = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
        if (!defined.has(m[1])) {
          missing.push(`${path.relative(ROOT, file)}: ${m[1]}`);
        }
      }
    }
    assert.deepEqual(
      missing,
      [],
      `undefined CSS variables — these fall back to a literal that cannot follow the theme:\n  ${missing.join("\n  ")}`
    );
  });

  test("no component pins a colour that the theme cannot remap", () => {
    // A literal hex in a style prop is the same defect wearing a different
    // hat: it is correct in one theme by construction and wrong in the other.
    // rgba() washes are allowed — they composite over whatever is beneath.
    const pinned = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/style=\{\{[^}]*?(#[0-9a-f]{3,8})\b/gi)) {
        pinned.push(`${path.relative(ROOT, file)}: ${m[1]}`);
      }
    }
    assert.deepEqual(pinned, [], `hard-coded colours in style props:\n  ${pinned.join("\n  ")}`);
  });

  test("both themes define the same token set", () => {
    // Light mode is a remap, so a token defined only in one theme is a token
    // that silently disappears in the other.
    const block = (re) => {
      const m = CSS.match(re);
      if (!m) return null;
      return new Set([...m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
    };
    const light = block(/html\[data-theme="light"\]\s*\{([^}]*)\}/);
    assert.ok(light, "the light theme block should exist");

    // The dark defaults live in :root. Everything :root remaps for ink and
    // hairlines must have a light counterpart.
    const root = block(/:root\s*\{([^}]*)\}/);
    assert.ok(root, ":root should exist");

    const onlyDark = [...root].filter((t) => !light.has(t) && t !== "--color-scheme");
    assert.deepEqual(
      onlyDark,
      [],
      `defined for dark but not light — these keep their dark value on the beige page: ${onlyDark.join(", ")}`
    );
  });
});
