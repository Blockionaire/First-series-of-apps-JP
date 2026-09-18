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

    print("\nRATIO in src/components/Logo.tsx must match:")
    print(f"  s:        {s[0]} / {s[1]}")
    print(f"  sPlus:    {sp[0]} / {sp[1]}")
    print(f"  wordmark: {wm[0]} / {wm[1]}")


if __name__ == "__main__":
    main()
