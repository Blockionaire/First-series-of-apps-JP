"""
Turn the supplied brand artwork into the alpha masks the site renders.

    python3 scripts/extract-brand.py        # brand/source/ -> public/brand/

Requires Pillow (`pip install Pillow`). It is not a project dependency: this
runs when the artwork changes, which is approximately never, and adding a
Python toolchain to a Node app's install for that would be a poor trade.

── Why masks rather than the files as supplied ──────────────────────────────
The artwork arrived as flat tiles with baked-in backgrounds: the S and the S+
on navy, the wordmark on cream. Used directly they would each put a visible
rectangle on the page, because the artwork's navy (#0a2540) is not the site's
navy (#0e1726), and they would be locked to one theme — the cream S invisible
on the light theme, the navy wordmark invisible on the dark one.

Extracting the ink to an alpha mask lets src/components/Logo.tsx paint the
exact supplied shapes in `currentColor`, so they follow the theme the way the
placeholder SVGs they replace did.

── Why a luminance ramp and not a colour match ──────────────────────────────
s-mark.png is a generated image whose "flat" navy is not flat at all — it runs
from #152436 to #17273a. Matching a background colour would leave a halo of
near-misses. Thresholding on luminance ignores that noise entirely, and taking
the ramp between the two cut-offs as the alpha value preserves the antialiased
edges instead of producing a jagged cutout.
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "source"
OUT = ROOT / "public" / "brand"

# Above HI is solid ink, below LO is background, between is the antialiased
# edge. Inverted for dark-on-light artwork by passing LO > HI.
INK_ON_DARK = (90.0, 200.0)
INK_ON_LIGHT = (200.0, 90.0)

# The cream ink sits at B~0xec and the gold at B~0x59, so blueness separates
# the two-tone S+ cleanly without needing to know either exact colour.
GOLD_BLUE_MAX = 150


def luminance(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def ramp(lo, hi):
    return lambda p: max(0, min(255, int(255 * (luminance(p) - lo) / (hi - lo))))


def mask_of(path, alpha_fn):
    im = Image.open(path).convert("RGB")
    px = im.load()
    w, h = im.size
    m = Image.new("L", (w, h), 0)
    md = m.load()
    for y in range(h):
        for x in range(w):
            md[x, y] = alpha_fn(px[x, y])
    return m


def write(mask, name, bbox=None):
    m = mask.crop(bbox or mask.getbbox())
    rgba = Image.new("RGBA", m.size, (255, 255, 255, 0))
    rgba.putalpha(m)
    OUT.mkdir(parents=True, exist_ok=True)
    rgba.save(OUT / name, optimize=True)
    print(f"  public/brand/{name}  {m.size[0]}x{m.size[1]}")
    return m.size


def main():
    print("extracting brand masks")
    s = write(mask_of(SRC / "s-mark.png", ramp(*INK_ON_DARK)), "s-mark.png")
    wm = write(mask_of(SRC / "wordmark.png", ramp(*INK_ON_LIGHT)), "wordmark.png")

    # The S+ layers MUST share one bounding box. Cropping each to its own ink
    # silently slides the plus out of position relative to the S, and the two
    # are only ever drawn stacked.
    r = ramp(*INK_ON_DARK)
    src = SRC / "s-plus.jpg"
    ink = mask_of(src, lambda p: r(p) if p[2] >= GOLD_BLUE_MAX else 0)
    gold = mask_of(src, lambda p: r(p) if p[2] < GOLD_BLUE_MAX else 0)
    a, b = ink.getbbox(), gold.getbbox()
    union = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
    sp = write(ink, "s-plus-s.png", union)
    write(gold, "s-plus-gold.png", union)

    trace_all()


# ── Tracing ─────────────────────────────────────────────────────────────────
# The masks above are an intermediate: what the site actually draws is inline
# SVG, because a CSS mask whose image fails to load renders as nothing at all
# and the logo disappears with no error to explain it. See src/components/Logo.tsx.

PATHS_TS = ROOT / "src" / "components" / "brand-paths.ts"

NAMES = {
    "s-mark.png": "S_MARK",
    "wordmark.png": "WORDMARK",
    "s-plus-s.png": "S_PLUS_INK",
    "s-plus-gold.png": "S_PLUS_GOLD",
}


def trace_all():
    try:
        import numpy as np
        import potrace
    except ImportError:
        sys.exit("tracing needs numpy and potracer:  pip install numpy potracer")

    def point(p):
        return (p.x, p.y)

    out = {}
    print("\ntracing to outlines")
    for fname, const in NAMES.items():
        a = np.array(Image.open(OUT / fname).convert("RGBA").getchannel("A"))
        h, w = a.shape
        # `a <= 128`, not `a > 128`. potracer treats a True cell as BACKGROUND,
        # so passing the ink mask directly traces the negative: the first
        # attempt rendered a filled slab with the S knocked out of it, in
        # both themes, and no fill-rule fixes that because the outline itself
        # is the wrong shape.
        curves = potrace.Bitmap(a <= 128).trace(turdsize=2, alphamax=1.0, opticurve=True,
                                                opttolerance=0.2)
        d, n = [], 0
        for curve in curves:
            n += 1
            x, y = point(curve.start_point)
            d.append(f"M{x:.1f} {y:.1f}")
            for seg in curve:
                ex, ey = point(seg.end_point)
                if seg.is_corner:
                    cx, cy = point(seg.c)
                    d.append(f"L{cx:.1f} {cy:.1f}L{ex:.1f} {ey:.1f}")
                else:
                    c1x, c1y = point(seg.c1)
                    c2x, c2y = point(seg.c2)
                    d.append(f"C{c1x:.1f} {c1y:.1f} {c2x:.1f} {c2y:.1f} {ex:.1f} {ey:.1f}")
            d.append("Z")
        out[const] = (w, h, "".join(d))
        print(f"  {const}: {w}x{h}, {n} contours, {len(out[const][2])} chars")

    header = (
        "/**\n"
        " * GENERATED by scripts/extract-brand.py — do not edit by hand.\n"
        " *\n"
        " * The supplied brand artwork, traced from brand/source/ to outlines.\n"
        " * Inline paths rather than an <img> or a CSS mask because a logo must not\n"
        " * depend on a second network request: a mask whose image fails to load\n"
        " * renders as nothing at all, so the mark would vanish silently.\n"
        " *\n"
        " * Every shape has two contours or more (the counter inside the S, the bowls\n"
        " * in the wordmark), so anything drawing these needs fill-rule=\"evenodd\".\n"
        " */\n\n"
        "export type BrandPath = { w: number; h: number; d: string };\n\n"
    )
    body = "\n".join(
        f'export const {k}: BrandPath = {{\n  w: {v[0]},\n  h: {v[1]},\n  d: "{v[2]}",\n}};\n'
        for k, v in out.items()
    )
    PATHS_TS.write_text(header + body)
    print(f"  -> src/components/brand-paths.ts")


if __name__ == "__main__":
    main()
