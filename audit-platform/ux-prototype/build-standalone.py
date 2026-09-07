#!/usr/bin/env python3
"""
Bundle the prototype into one self-contained HTML file that opens from file://.

Why this exists: the app is written as ES modules, and every browser refuses to
load those over file:// under CORS. Design partners should not have to run a
web server to look at a prototype, so this produces a single file that can be
emailed, downloaded and double-clicked.

How it works: rather than concatenating the modules — which would collide on
names the modules legitimately reuse (`S`, `act`, `evidence`, `state`) — each
module is wrapped in its own function and registered in a tiny CommonJS-style
registry. Module scope is preserved exactly, so the bundle behaves like the
real thing.

Usage:  python3 build-standalone.py
Output: audit-ai-prototype.html
"""

import os
import re
import posixpath
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENTRY = "js/app.js"
OUT = "audit-ai-prototype.html"

# import { a, b as c } from "./x.js";   ·   import * as ns from "./x.js";
RE_NAMED = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*["\']([^"\']+)["\']\s*;?\s*$', re.M)
RE_STAR = re.compile(r'^import\s*\*\s*as\s+(\w+)\s+from\s*["\']([^"\']+)["\']\s*;?\s*$', re.M)
RE_BARE = re.compile(r'^import\s+["\']([^"\']+)["\']\s*;?\s*$', re.M)
RE_DYNAMIC = re.compile(r'\bimport\s*\(')

RE_EXPORT_CONST = re.compile(r'^export\s+(const|let|var)\s+(\w+)', re.M)
RE_EXPORT_FUNC = re.compile(r'^export\s+(async\s+function|function|class)\s+(\w+)', re.M)
RE_EXPORT_OTHER = re.compile(r'^export\s+(?!const|let|var|async|function|class)', re.M)


def resolve(spec, importer):
    """Resolve a relative specifier against the importing module's directory."""
    if not spec.startswith("."):
        raise SystemExit(f"bare specifier {spec!r} in {importer} — no CDN imports allowed")
    return posixpath.normpath(posixpath.join(posixpath.dirname(importer), spec))


def transform(path, src):
    """Rewrite one module's import/export syntax to the registry's calling
    convention, and return (code, dependency paths)."""
    if RE_DYNAMIC.search(src):
        raise SystemExit(f"{path}: dynamic import() cannot be bundled for file://")
    if RE_EXPORT_OTHER.search(src):
        raise SystemExit(f"{path}: unsupported export form (export default / export {{ }})")

    deps = []

    def named(m):
        clause, spec = m.group(1), m.group(2)
        dep = resolve(spec, path)
        deps.append(dep)
        # `a, b as c` -> `a, b: c`
        parts = []
        for raw in clause.split(","):
            raw = raw.strip()
            if not raw:
                continue
            if " as " in raw:
                orig, alias = [x.strip() for x in raw.split(" as ")]
                parts.append(f"{orig}: {alias}")
            else:
                parts.append(raw)
        return f'const {{ {", ".join(parts)} }} = __req({dep!r});'

    def star(m):
        ns, spec = m.group(1), m.group(2)
        dep = resolve(spec, path)
        deps.append(dep)
        return f'const {ns} = __req({dep!r});'

    def bare(m):
        dep = resolve(m.group(1), path)
        deps.append(dep)
        return f'__req({dep!r});'

    code = RE_NAMED.sub(named, src)
    code = RE_STAR.sub(star, code)
    code = RE_BARE.sub(bare, code)

    # Collect exported bindings, then strip the keyword.
    names = [m.group(2) for m in RE_EXPORT_CONST.finditer(code)]
    names += [m.group(2) for m in RE_EXPORT_FUNC.finditer(code)]
    code = RE_EXPORT_CONST.sub(r"\1 \2", code)
    code = RE_EXPORT_FUNC.sub(r"\1 \2", code)

    if names:
        # Assigned at the end of the module body so every binding is initialised.
        # Safe here because the dependency graph is acyclic (asserted below).
        code += "\n\n__exp(exports, { " + ", ".join(f"{n}: () => {n}" for n in names) + " });\n"

    return code, deps


def collect(entry):
    """Depth-first walk of the module graph, checking for cycles."""
    order, seen, stack = [], {}, []

    def visit(path):
        if seen.get(path) == "done":
            return
        if seen.get(path) == "visiting":
            raise SystemExit(f"import cycle: {' -> '.join(stack + [path])}")
        seen[path] = "visiting"
        stack.append(path)
        full = os.path.join(HERE, path)
        if not os.path.exists(full):
            raise SystemExit(f"missing module: {path}")
        code, deps = transform(path, open(full, encoding="utf-8").read())
        for d in deps:
            visit(d)
        stack.pop()
        seen[path] = "done"
        order.append((path, code))

    visit(entry)
    return order


def main():
    css = open(os.path.join(HERE, "app.css"), encoding="utf-8").read()
    modules = collect(ENTRY)

    # A closing </script> anywhere in the payload would end the script element.
    guard = lambda s: s.replace("</script", "<\\/script").replace("<!--", "<\\!--")

    bundle = [
        "(function () {",
        '"use strict";',
        "var __defs = {}, __cache = {};",
        "function __exp(exports, getters) {",
        "  for (var k in getters) Object.defineProperty(exports, k, { get: getters[k], enumerable: true });",
        "}",
        "function __req(id) {",
        "  if (__cache[id]) return __cache[id].exports;",
        "  var m = __cache[id] = { exports: {} };",
        "  __defs[id](m.exports, __req, __exp);",
        "  return m.exports;",
        "}",
    ]
    for path, code in modules:
        bundle.append(f"__defs[{path!r}] = function (exports, __req, __exp) {{")
        bundle.append(guard(code))
        bundle.append("};")
    bundle.append(f"__req({ENTRY!r});")
    bundle.append("})();")

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit AI — Interim Platform (UX prototype)</title>
<meta name="description" content="Self-contained clickable prototype of the Audit AI interim platform. Fictional data, no network.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%231b2430'/><path d='M9 21V11h3.2c2.6 0 4.3 1.9 4.3 5s-1.7 5-4.3 5H9zm13 0v-4' stroke='%23a8bed6' stroke-width='2.2' fill='none' stroke-linecap='round'/></svg>">
<style>
{guard(css)}
</style>
</head>
<body>
<div id="app"></div>
<div id="overlay"></div>
<noscript style="display:block;padding:40px;font:15px system-ui;max-width:60ch;margin:0 auto">
  <h1 style="font-size:20px">JavaScript is required</h1>
  <p>This prototype runs entirely in your browser. It makes no network requests and stores
  nothing — but it does need JavaScript enabled.</p>
</noscript>
<script>
{chr(10).join(bundle)}
</script>
</body>
</html>
"""

    out = os.path.join(HERE, OUT)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html)

    size = os.path.getsize(out)
    print(f"{OUT}  ·  {len(modules)} modules  ·  {size / 1024:.0f} KB")
    for path, _ in modules:
        print(f"    {path}")


if __name__ == "__main__":
    main()
